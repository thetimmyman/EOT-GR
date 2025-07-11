'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { addCalculatedFields, addPowerBIIndexing, CalculatedData } from '../lib/calculations'
import { 
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from './RechartsWrapper'
import { formatBossName, formatNumber } from '../lib/themeUtils'

interface PlayerPerformancePageProps {
  selectedGuild: string
  selectedSeason: string
}

interface PlayerBossStats {
  displayName: string
  bossName: string
  overallTokenUsage: string
  playerAvg: number
  clusterAvg: number
  guildAvg: number
  vsClusterPct: number
  vsGuildPct: number
  battleCount: number
  weightedContribution: number
}

interface PlayerSummary {
  displayName: string
  avgVsCluster: number
  avgVsGuild: number
  totalBattles: number
  bossesPlayed: number
}

interface RadarData {
  boss: string
  playerAvg: number // Now represents Guild Average (reusing existing field)
  guildAvg: number  // Now represents Cluster Average (reusing existing field)
  tier: number
}

// Simplified SpecialCases logic - handle missing fields gracefully
const getSpecialCases = (entry: any, allData: any[]) => {
  if (!entry.damageDealt || entry.damageDealt === 0) return "Crash"
  
  // If any required fields are missing, treat as Standard
  if (entry.loopIndex === null || entry.loopIndex === undefined ||
      entry.tier === null || entry.tier === undefined ||
      !entry.Name || !entry.Season || !entry.Guild) {
    return "Standard"
  }
  
  // Find all entries for this specific boss encounter
  const sameEncounterData = allData.filter(d => 
    d.loopIndex === entry.loopIndex &&
    d.Name === entry.Name &&
    d.tier === entry.tier &&
    d.Season === entry.Season &&
    d.Guild === entry.Guild &&
    d.damageDealt > 0
  )
  
  if (sameEncounterData.length === 0) return "Standard"
  
  // Find minimum remaining HP for this encounter
  const remainingHps = sameEncounterData.map(d => d.remainingHp || 0).filter(hp => hp >= 0)
  if (remainingHps.length === 0) return "Standard"
  
  const minRemainingHp = Math.min(...remainingHps)
  const totalHits = sameEncounterData.length
  
  // Check if this is a last hit (minimum remaining HP AND Battle damage type)
  const isLastHit = (entry.remainingHp === minRemainingHp && entry.damageType === 'Battle')
  
  // Check if this is a one shot (last hit with only 1 total hit)
  const isOneShot = (isLastHit && totalHits === 1)
  
  if (isOneShot) return "One Shot"
  if (isLastHit) return "Last Hit"
  return "Standard"
}

export default function PlayerPerformancePage({ selectedGuild, selectedSeason }: PlayerPerformancePageProps) {
  const [playerBossStats, setPlayerBossStats] = useState<PlayerBossStats[]>([])
  const [playerSummaries, setPlayerSummaries] = useState<PlayerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cluster' | 'guild' | 'cluster-bosses' | 'guild-bosses'>('guild')
  const [showBossDetail, setShowBossDetail] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const [radarData, setRadarData] = useState<RadarData[]>([])

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchPlayerPerformance()
    }
  }, [selectedGuild, selectedSeason, viewMode])

  const fetchPlayerPerformance = async () => {
    setLoading(true)
    
    if (!selectedGuild || !selectedSeason) {
      setLoading(false)
      return
    }
    
    console.log('Fetching data for:', selectedGuild, selectedSeason)
    
    try {
      // Get ALL battle data for the season - more permissive query
      const { data: allData, error } = await supabase
        .from('EOT_GR_data')
        .select(`
          id, displayName, damageDealt, Name, encounterId, loopIndex, tier, Season, 
          remainingHp, damageType, Guild, rarity, set, enemyHp, enemyHpLeft, 
          startedOn, completedOn, timestamp, userId, encounterIndex
        `)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .gt('damageDealt', 0)
        .not('displayName', 'is', null)
        .not('Name', 'is', null)
        .limit(100000)

      if (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
        return
      }

      if (!allData || allData.length === 0) {
        console.log('No data found')
        setLoading(false)
        return
      }

      console.log('Raw data loaded:', allData.length, 'records')
      console.log('Sample record:', allData[0])

      // Apply PowerBI-style calculations
      const calculatedData = addCalculatedFields(allData)
      const indexedData = addPowerBIIndexing(calculatedData)
      
      console.log('After calculations:', indexedData.length, 'records')
      console.log('Sample calculated record:', indexedData[0])

      // Filter out last hits and crashes (like PowerBI)
      let filteredData = indexedData.filter(d => 
        d.SpecialCases !== 'Last Hit' && d.SpecialCases !== 'Crash'
      )

      // For boss-only modes, filter out primes (encounterId > 0)
      if (viewMode === 'cluster-bosses' || viewMode === 'guild-bosses') {
        filteredData = filteredData.filter(d => d.encounterId === 0)
        console.log('After boss-only filtering:', filteredData.length, 'records')
      }

      console.log('After filtering (no last hits/crashes):', filteredData.length, 'records')

      if (filteredData.length === 0) {
        console.log('No records after filtering')
        setLoading(false)
        return
      }

      // Group by boss and overallTokenUsage for averages
      const bossStats = new Map<string, {
        clusterTotal: number
        clusterCount: number
        guildTotal: number
        guildCount: number
        playerStats: Map<string, { total: number, count: number, weightedTotal: number }>
      }>()

      filteredData.forEach(entry => {
        const key = `${entry.Name}_${entry.overallTokenUseage}`
        
        if (!bossStats.has(key)) {
          bossStats.set(key, {
            clusterTotal: 0,
            clusterCount: 0,
            guildTotal: 0,
            guildCount: 0,
            playerStats: new Map()
          })
        }
        
        const stats = bossStats.get(key)!
        const damage = entry.damageDealt || 0
        const weightedContribution = entry.WeightedContribution || 0
        
        // Cluster stats (all guilds)
        stats.clusterTotal += damage
        stats.clusterCount += 1
        
        // Guild stats (selected guild only)
        if (entry.Guild === selectedGuild) {
          stats.guildTotal += damage
          stats.guildCount += 1
          
          // Player stats within guild
          if (!stats.playerStats.has(entry.displayName)) {
            stats.playerStats.set(entry.displayName, { total: 0, count: 0, weightedTotal: 0 })
          }
          const playerStat = stats.playerStats.get(entry.displayName)!
          playerStat.total += damage
          playerStat.count += 1
          playerStat.weightedTotal += weightedContribution
        }
      })

      console.log('Boss stats computed for', bossStats.size, 'boss/token combinations')

      // Calculate per-boss performance for each player
      const playerBossResults: PlayerBossStats[] = []
      
      bossStats.forEach((stats, key) => {
        const [bossName, tokenUsage] = key.split('_')
        const clusterAvg = stats.clusterCount > 0 ? stats.clusterTotal / stats.clusterCount : 0
        const guildAvg = stats.guildCount > 0 ? stats.guildTotal / stats.guildCount : 0
        
        stats.playerStats.forEach((playerStat, playerName) => {
          if (playerStat.count >= 2) { // Only players with 2+ battles on this boss
            const playerAvg = playerStat.total / playerStat.count
            const weightedContribution = playerStat.weightedTotal / playerStat.count
            
            // Calculate percentage vs averages
            const vsClusterPct = clusterAvg > 0 ? ((playerAvg / clusterAvg) - 1) * 100 : 0
            const vsGuildPct = guildAvg > 0 ? ((playerAvg / guildAvg) - 1) * 100 : 0
            
            playerBossResults.push({
              displayName: playerName,
              bossName,
              overallTokenUsage: tokenUsage,
              playerAvg,
              clusterAvg,
              guildAvg,
              weightedContribution,
              vsClusterPct,
              vsGuildPct,
              battleCount: playerStat.count
            })
          }
        })
      })

      console.log('Player boss results:', playerBossResults.length, 'entries')

      // Calculate overall player summaries
      const playerSummaryMap = new Map<string, {
        clusterPerfs: number[]
        guildPerfs: number[]
        totalBattles: number
        bossesPlayed: number
      }>()

      playerBossResults.forEach(boss => {
        if (!playerSummaryMap.has(boss.displayName)) {
          playerSummaryMap.set(boss.displayName, {
            clusterPerfs: [],
            guildPerfs: [],
            totalBattles: 0,
            bossesPlayed: 0
          })
        }
        
        const summary = playerSummaryMap.get(boss.displayName)!
        summary.clusterPerfs.push(boss.vsClusterPct)
        summary.guildPerfs.push(boss.vsGuildPct)
        summary.totalBattles += boss.battleCount
        summary.bossesPlayed += 1
      })

      const playerSummaryResults: PlayerSummary[] = Array.from(playerSummaryMap.entries())
        .map(([name, data]) => ({
          displayName: name,
          avgVsCluster: data.clusterPerfs.length > 0 ? data.clusterPerfs.reduce((sum, p) => sum + p, 0) / data.clusterPerfs.length : 0,
          avgVsGuild: data.guildPerfs.length > 0 ? data.guildPerfs.reduce((sum, p) => sum + p, 0) / data.guildPerfs.length : 0,
          totalBattles: data.totalBattles,
          bossesPlayed: data.bossesPlayed
        }))
        .sort((a, b) => {
          const aValue = (viewMode === 'cluster' || viewMode === 'cluster-bosses') ? a.avgVsCluster : a.avgVsGuild
          const bValue = (viewMode === 'cluster' || viewMode === 'cluster-bosses') ? b.avgVsCluster : b.avgVsGuild
          return bValue - aValue
        })

      console.log('Final player summaries:', playerSummaryResults.length, 'players')
      console.log('Above average (cluster):', playerSummaryResults.filter(p => p.avgVsCluster > 0).length)
      console.log('Above average (guild):', playerSummaryResults.filter(p => p.avgVsGuild > 0).length)

      // Log sample data for debugging
      if (playerSummaryResults.length > 0) {
        console.log('Sample player result:', playerSummaryResults[0])
      }
      if (playerBossResults.length > 0) {
        console.log('Sample boss result:', playerBossResults[0])
      }

      // Prepare radar chart data for Guild vs Cluster Average for each boss
      const radarChartData: RadarData[] = []
      
      // Group boss stats by boss name to get tier information and averages
      const bossData = new Map<string, { tier: number, guildAvg: number, clusterAvg: number }>()
      
      playerBossResults.forEach(boss => {
        if (!bossData.has(boss.bossName)) {
          bossData.set(boss.bossName, {
            tier: Math.floor(Math.random() * 5) + 1, // We'll get the actual tier from the data
            guildAvg: boss.guildAvg,
            clusterAvg: boss.clusterAvg
          })
        }
      })
      
      // Get actual tier information from filteredData
      const bossTiers = new Map<string, number>()
      filteredData.forEach(d => {
        if (d.encounterId === 0 && d.Name) {
          bossTiers.set(d.Name, d.tier || 5)
        }
      })
      
      // Create radar data for each boss with sufficient data
      bossData.forEach((data, bossName) => {
        if (data.guildAvg > 0 && data.clusterAvg > 0) { // Only include bosses with valid averages
          const tier = bossTiers.get(bossName) || 5
          
          radarChartData.push({
            boss: `L${tier} ${bossName}`,
            playerAvg: Math.round(data.guildAvg / 1000), // Using playerAvg field for guild avg (convert to K)
            guildAvg: Math.round(data.clusterAvg / 1000), // Using guildAvg field for cluster avg (convert to K)
            tier
          })
        }
      })
      
      // Sort by tier for consistent ordering
      radarChartData.sort((a, b) => a.tier - b.tier || a.boss.localeCompare(b.boss))
      
      console.log('Radar chart data:', radarChartData)

      setPlayerBossStats(playerBossResults)
      setPlayerSummaries(playerSummaryResults)
      setRadarData(radarChartData)
      setLoading(false)

    } catch (error) {
      console.error('Error in fetchPlayerPerformance:', error)
      setLoading(false)
    }
  }

  const getPerformanceValue = (player: PlayerSummary) => {
    return (viewMode === 'cluster' || viewMode === 'cluster-bosses') ? player.avgVsCluster : player.avgVsGuild
  }

  const getBarColor = (value: number) => {
    if (value >= 30) return 'bg-green-500'
    if (value >= 20) return 'bg-green-400' 
    if (value >= 10) return 'bg-yellow-400'
    if (value >= 0) return 'bg-yellow-300'
    if (value >= -10) return 'bg-orange-400'
    if (value >= -20) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getTextColor = (value: number) => {
    if (value >= 30) return 'text-green-700'
    if (value >= 20) return 'text-green-600' 
    if (value >= 10) return 'text-yellow-700'
    if (value >= 0) return 'text-yellow-600'
    if (value >= -10) return 'text-orange-600'
    if (value >= -20) return 'text-orange-700'
    return 'text-red-600'
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="spinner-modern"></div></div>
  }

  const maxAbsValue = playerSummaries.length > 0 ? 
    Math.max(...playerSummaries.map(p => Math.abs(getPerformanceValue(p)))) : 0
  const chartMax = Math.max(maxAbsValue, 40)
  const topPlayer = playerSummaries.length > 0 ? playerSummaries[0] : null

  return (
    <div className="container-modern py-6 space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-accent-wh40k">Player Performance vs Average (Per Boss)</h2>
        <p className="text-sm text-secondary-wh40k">Season {selectedSeason} - {selectedGuild}</p>
        <p className="text-xs text-secondary-wh40k">Legendary Tier Only • No Last Hits • No Bombs • 2+ Battles per Boss</p>
      </div>

      {/* Controls */}
      <div className="card-wh40k p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2 text-accent-wh40k">Compare Against:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setViewMode('guild')}
                className={`px-3 py-2 rounded text-sm font-medium transition-all duration-300 border ${
                  viewMode === 'guild'
                    ? 'bg-accent-wh40k text-black border-accent-wh40k'
                    : 'text-primary-wh40k hover:text-accent-wh40k border-primary-wh40k hover:border-accent-wh40k'
                }`}
              >
                Guild Average
              </button>
              <button
                onClick={() => setViewMode('guild-bosses')}
                className={`px-3 py-2 rounded text-sm font-medium transition-all duration-300 border ${
                  viewMode === 'guild-bosses'
                    ? 'bg-accent-wh40k text-black border-accent-wh40k'
                    : 'text-primary-wh40k hover:text-accent-wh40k border-primary-wh40k hover:border-accent-wh40k'
                }`}
              >
                Guild Average (Bosses Only)
              </button>
              <button
                onClick={() => setViewMode('cluster')}
                className={`px-3 py-2 rounded text-sm font-medium transition-all duration-300 border ${
                  viewMode === 'cluster'
                    ? 'bg-accent-wh40k text-black border-accent-wh40k'
                    : 'text-primary-wh40k hover:text-accent-wh40k border-primary-wh40k hover:border-accent-wh40k'
                }`}
              >
                Cluster Average
              </button>
              <button
                onClick={() => setViewMode('cluster-bosses')}
                className={`px-3 py-2 rounded text-sm font-medium transition-all duration-300 border ${
                  viewMode === 'cluster-bosses'
                    ? 'bg-accent-wh40k text-black border-accent-wh40k'
                    : 'text-primary-wh40k hover:text-accent-wh40k border-primary-wh40k hover:border-accent-wh40k'
                }`}
              >
                Cluster Average (Bosses Only)
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showBossDetail}
                onChange={(e) => setShowBossDetail(e.target.checked)}
                className="rounded border-primary-wh40k bg-card-bg text-accent-wh40k"
              />
              <span className="text-sm font-medium text-primary-wh40k">Show Boss-by-Boss Detail</span>
            </label>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      {playerSummaries.length === 0 && !loading && (
        <div className="card-wh40k p-4 border border-accent-wh40k glow-accent">
          <h3 className="font-medium text-accent-wh40k mb-2">Debug Information</h3>
          <p className="text-sm text-secondary-wh40k">
            No qualified players found. Check the browser console for detailed logs about data filtering.
          </p>
        </div>
      )}

      {/* Performance Chart */}
      {playerSummaries.length > 0 && (
        <div className="card-wh40k p-4">
          <h3 className="heading-wh40k">
            Average Performance vs {
              viewMode === 'cluster' ? "Cluster" : 
              viewMode === 'cluster-bosses' ? "Cluster (Bosses Only)" :
              viewMode === 'guild' ? "Guild" : 
              "Guild (Bosses Only)"
            } [%]
          </h3>
          
          {/* Column Headers */}
          <div className="flex items-center gap-2 pb-2 border-b border-primary-wh40k mb-2">
            <div className="w-24 flex-shrink-0">
              <span className="text-xs font-medium text-accent-wh40k">Player</span>
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs font-medium text-accent-wh40k">Performance Chart</span>
            </div>
            <div className="w-12 flex-shrink-0 text-center">
              <span className="text-xs font-medium text-accent-wh40k">%</span>
            </div>
            <div className="w-16 flex-shrink-0 text-center">
              <span className="text-xs font-medium text-accent-wh40k">Battles</span>
            </div>
            <div className="w-16 flex-shrink-0 text-center">
              <span className="text-xs font-medium text-accent-wh40k">vs Cluster</span>
            </div>
            <div className="w-16 flex-shrink-0 text-center">
              <span className="text-xs font-medium text-accent-wh40k">vs Guild</span>
            </div>
          </div>
          
          <div className="space-y-1">
            {playerSummaries
              .sort((a, b) => getPerformanceValue(b) - getPerformanceValue(a)) // Sort highest to lowest
              .map((player) => {
              const value = getPerformanceValue(player)
              const barWidth = Math.abs(value) / chartMax * 100
              const isPositive = value >= 0
              
              return (
                <div key={player.displayName} className="flex items-center gap-2 py-0.5">
                  {/* Player name - fixed width */}
                  <div className="w-24 flex-shrink-0">
                    <span className="text-xs font-medium truncate block text-primary-wh40k">{player.displayName}</span>
                  </div>
                  
                  {/* Chart area - flexible */}
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 flex justify-center">
                      <div className="w-px bg-primary-wh40k h-full"></div>
                    </div>
                    
                    <div className="relative flex items-center justify-center h-4">
                      {isPositive ? (
                        <div className="flex w-full">
                          <div className="w-1/2"></div>
                          <div className="w-1/2 flex">
                            <div 
                              className={`h-2 ${getBarColor(value)} transition-all duration-300`}
                              style={{ width: `${barWidth}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex w-full">
                          <div className="w-1/2 flex justify-end">
                            <div 
                              className={`h-2 ${getBarColor(value)} transition-all duration-300`}
                              style={{ width: `${barWidth}%` }}
                            ></div>
                          </div>
                          <div className="w-1/2"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Performance value - fixed width */}
                  <div className="w-12 flex-shrink-0 text-center">
                    <span className={`text-xs font-mono ${getTextColor(value)} block`}>
                      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Stats column - fixed width */}
                  <div className="w-16 flex-shrink-0 text-center text-xs text-secondary-wh40k">
                    <div>{player.bossesPlayed}b•{player.totalBattles} battles</div>
                  </div>
                  
                  {/* vs Cluster column - fixed width */}
                  <div className="w-16 flex-shrink-0 text-center text-xs text-secondary-wh40k">
                    <div>{player.avgVsCluster >= 0 ? '+' : ''}{player.avgVsCluster.toFixed(0)}%</div>
                  </div>
                  
                  {/* vs Guild column - fixed width */}
                  <div className="w-16 flex-shrink-0 text-center text-xs text-secondary-wh40k">
                    <div>{player.avgVsGuild >= 0 ? '+' : ''}{player.avgVsGuild.toFixed(0)}%</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-primary-wh40k">
            <div className="flex justify-between text-xs text-secondary-wh40k">
              <span>-{chartMax.toFixed(0)}%</span>
              <span>0%</span>
              <span>+{chartMax.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Boss Detail Table */}
      {showBossDetail && playerBossStats.length > 0 && (
        <div className="card-wh40k p-4">
          <h3 className="heading-wh40k">Boss-by-Boss Performance Detail</h3>
          <div className="overflow-x-auto">
            <table className="table-wh40k">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Boss</th>
                  <th>Type</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">Avg Damage</th>
                  <th className="text-right">Weighted Contrib</th>
                  <th className="text-right">vs Cluster</th>
                  <th className="text-right">vs Guild</th>
                </tr>
              </thead>
              <tbody>
                {playerBossStats
                  .sort((a, b) => {
                    const isClusterMode = (viewMode === 'cluster' || viewMode === 'cluster-bosses')
                    return (isClusterMode ? b.vsClusterPct : b.vsGuildPct) - (isClusterMode ? a.vsClusterPct : a.vsGuildPct)
                  })
                  .map((stat, i) => {
                    // Get tier from boss name or default to 5
                    const bossNameParts = stat.bossName.split(' ')
                    const tier = bossNameParts[0]?.startsWith('L') ? bossNameParts[0] : 'L5'
                    const cleanBossName = bossNameParts[0]?.startsWith('L') ? bossNameParts.slice(1).join(' ') : stat.bossName
                    const displayBossName = tier.startsWith('L') ? `${tier} ${cleanBossName}` : `L5 ${stat.bossName}`
                    
                    // Format damage with comma if over 1000K
                    const formatDamage = (damage: number) => {
                      const millions = damage / 1000000
                      if (millions >= 1000) {
                        return `${(millions / 1000).toFixed(1).replace(/\.0$/, '')},${String(Math.round(millions % 1000)).padStart(3, '0')}M`
                      }
                      return `${millions.toFixed(2)}M`
                    }
                    
                    // Format token usage
                    const tokenText = stat.battleCount === 1 ? 'token' : 'tokens'
                    
                    return (
                    <tr key={i}>
                      <td className="font-medium">{stat.displayName}</td>
                      <td>{displayBossName}</td>
                      <td className="text-xs">{stat.overallTokenUsage}</td>
                      <td className="text-right">{stat.battleCount}</td>
                      <td className="text-right">{formatDamage(stat.playerAvg)}</td>
                      <td className="text-right">{formatDamage(stat.weightedContribution)}</td>
                      <td className={`text-right ${
                        stat.vsClusterPct >= 30 ? 'text-green-400' :
                        stat.vsClusterPct >= 20 ? 'text-green-300' : 
                        stat.vsClusterPct >= 10 ? 'text-yellow-400' :
                        stat.vsClusterPct >= 0 ? 'text-yellow-300' :
                        stat.vsClusterPct >= -10 ? 'text-orange-400' :
                        stat.vsClusterPct >= -20 ? 'text-orange-500' :
                        'text-red-400'
                      }`}>
                        {stat.vsClusterPct >= 0 ? '+' : ''}{stat.vsClusterPct.toFixed(1)}%
                      </td>
                      <td className={`text-right ${
                        stat.vsGuildPct >= 30 ? 'text-green-400' :
                        stat.vsGuildPct >= 20 ? 'text-green-300' : 
                        stat.vsGuildPct >= 10 ? 'text-yellow-400' :
                        stat.vsGuildPct >= 0 ? 'text-yellow-300' :
                        stat.vsGuildPct >= -10 ? 'text-orange-400' :
                        stat.vsGuildPct >= -20 ? 'text-orange-500' :
                        'text-red-400'
                      }`}>
                        {stat.vsGuildPct >= 0 ? '+' : ''}{stat.vsGuildPct.toFixed(1)}%
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance vs Averages */}
      {playerSummaries.length > 0 && (
        <div className="card-wh40k p-4">
          <h3 className="heading-wh40k">Performance vs Averages</h3>
          
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <div className="text-green-400 font-medium">Above Average</div>
              <div className="text-lg font-bold text-accent-wh40k">
                {playerSummaries.filter(p => getPerformanceValue(p) > 0).length}
              </div>
            </div>
            <div>
              <div className="text-red-400 font-medium">Below Average</div>
              <div className="text-lg font-bold text-accent-wh40k">
                {playerSummaries.filter(p => getPerformanceValue(p) < 0).length}
              </div>
            </div>
          </div>
          
          {/* Radar Chart: Guild vs Cluster Average Performance by Boss */}
          {radarData && radarData.length > 0 && (
            <div className="mb-6">
              <div className="bg-slate-900/80 rounded-lg p-2">
                <ResponsiveContainer width="100%" height={450}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                    <PolarGrid 
                      stroke="#374151" 
                      strokeWidth={1}
                      radialLines={true}
                    />
                    <PolarAngleAxis 
                      dataKey="boss" 
                      tick={{ fontSize: 11, fill: '#e2e8f0', fontWeight: 500 }}
                      className="text-slate-200"
                    />
                    <PolarRadiusAxis 
                      tick={{ fontSize: 9, fill: '#94a3b8' }} 
                      tickCount={6}
                      domain={[0, 'dataMax + 10']}
                      angle={90}
                    />
                    <Radar
                      name="Guild Average"
                      dataKey="playerAvg"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.4}
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#047857' }}
                    />
                    <Radar
                      name="Cluster Average"
                      dataKey="guildAvg"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      fillOpacity={0.15}
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      dot={{ r: 4, fill: '#F59E0B', strokeWidth: 2, stroke: '#D97706' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '15px' }}
                      iconType="line"
                      contentStyle={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '500' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-primary-wh40k">
            <div className="text-xs text-secondary-wh40k space-y-1">
              {topPlayer && (
                <div>Top Performer: <span className="font-medium text-primary-wh40k">{topPlayer.displayName}</span> ({getPerformanceValue(topPlayer) >= 0 ? '+' : ''}{getPerformanceValue(topPlayer).toFixed(1)}%)</div>
              )}
              <div>Qualified Players: {playerSummaries.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
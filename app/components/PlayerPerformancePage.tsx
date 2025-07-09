'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
}

interface PlayerSummary {
  displayName: string
  avgVsCluster: number
  avgVsGuild: number
  totalBattles: number
  bossesPlayed: number
}

// Helper function to identify last hits (replicate DAX SpecialCases logic)
const isLastHit = (entry: any, allData: any[]) => {
  const sameEncounterData = allData.filter(d => 
    d.loopIndex === entry.loopIndex &&
    d.Name === entry.Name &&
    d.tier === entry.tier &&
    d.Season === entry.Season &&
    d.Guild === entry.Guild
  )
  
  const minRemainingHp = Math.min(...sameEncounterData.map(d => d.remainingHp || 0))
  
  return entry.remainingHp === minRemainingHp && entry.damageType === 'Battle'
}

// Calculate overallTokenUsage equivalent
const getOverallTokenUsage = (entry: any) => {
  if (entry.tier >= 4) {
    return entry.encounterId === 0 ? entry.Name : "Leg. Primes"
  }
  return "Non-Leg."
}

export default function PlayerPerformancePage({ selectedGuild, selectedSeason }: PlayerPerformancePageProps) {
  const [playerBossStats, setPlayerBossStats] = useState<PlayerBossStats[]>([])
  const [playerSummaries, setPlayerSummaries] = useState<PlayerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cluster' | 'guild'>('cluster')
  const [showBossDetail, setShowBossDetail] = useState(false)

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchPlayerPerformance()
    }
  }, [selectedGuild, selectedSeason])

  const fetchPlayerPerformance = async () => {
    setLoading(true)
    
    if (!selectedGuild || !selectedSeason) {
      setLoading(false)
      return
    }
    
    // Get all battle data for the season (all guilds for cluster comparison)
    const { data: allData, error } = await supabase
      .from('EOT_GR_data')
      .select(`
        displayName, damageDealt, Name, encounterId, loopIndex, tier, Season, 
        remainingHp, damageType, Guild, rarity, set
      `)
      .eq('Season', selectedSeason)
      .eq('damageType', 'Battle')
      .gte('tier', 4)  // Legendary only
      .eq('rarity', 'Legendary')  

    if (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
      return
    }

    if (!allData) {
      setLoading(false)
      return
    }

    // Filter out last hits
    const filteredData = allData.filter(d => !isLastHit(d, allData))
    
    // Add overallTokenUsage to each entry
    const dataWithTokenUsage = filteredData.map(d => ({
      ...d,
      overallTokenUsage: getOverallTokenUsage(d)
    }))

    // Group by boss and overallTokenUsage for averages
    const bossStats = new Map<string, {
      clusterTotal: number
      clusterCount: number
      guildTotal: number
      guildCount: number
      playerStats: Map<string, { total: number, count: number }>
    }>()

    dataWithTokenUsage.forEach(entry => {
      const key = `${entry.Name}_${entry.overallTokenUsage}`
      
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
      
      // Cluster stats (all guilds)
      stats.clusterTotal += damage
      stats.clusterCount += 1
      
      // Guild stats (selected guild only)
      if (entry.Guild === selectedGuild) {
        stats.guildTotal += damage
        stats.guildCount += 1
        
        // Player stats within guild
        if (!stats.playerStats.has(entry.displayName)) {
          stats.playerStats.set(entry.displayName, { total: 0, count: 0 })
        }
        const playerStat = stats.playerStats.get(entry.displayName)!
        playerStat.total += damage
        playerStat.count += 1
      }
    })

    // Calculate per-boss performance for each player
    const playerBossResults: PlayerBossStats[] = []
    
    bossStats.forEach((stats, key) => {
      const [bossName, tokenUsage] = key.split('_')
      const clusterAvg = stats.clusterCount > 0 ? stats.clusterTotal / stats.clusterCount : 0
      const guildAvg = stats.guildCount > 0 ? stats.guildTotal / stats.guildCount : 0
      
      stats.playerStats.forEach((playerStat, playerName) => {
        if (playerStat.count > 1) { // Only players with multiple battles on this boss
          const playerAvg = playerStat.total / playerStat.count
          const vsClusterPct = clusterAvg > 0 ? ((playerAvg / clusterAvg) - 1) * 100 : 0
          const vsGuildPct = guildAvg > 0 ? ((playerAvg / guildAvg) - 1) * 100 : 0
          
          playerBossResults.push({
            displayName: playerName,
            bossName,
            overallTokenUsage: tokenUsage,
            playerAvg,
            clusterAvg,
            guildAvg,
            vsClusterPct,
            vsGuildPct,
            battleCount: playerStat.count
          })
        }
      })
    })

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
        avgVsCluster: data.clusterPerfs.reduce((sum, p) => sum + p, 0) / data.clusterPerfs.length,
        avgVsGuild: data.guildPerfs.reduce((sum, p) => sum + p, 0) / data.guildPerfs.length,
        totalBattles: data.totalBattles,
        bossesPlayed: data.bossesPlayed
      }))
      .sort((a, b) => {
        const aValue = viewMode === 'cluster' ? a.avgVsCluster : a.avgVsGuild
        const bValue = viewMode === 'cluster' ? b.avgVsCluster : b.avgVsGuild
        return bValue - aValue
      })

    setPlayerBossStats(playerBossResults)
    setPlayerSummaries(playerSummaryResults)
    setLoading(false)
  }

  const getPerformanceValue = (player: PlayerSummary) => {
    return viewMode === 'cluster' ? player.avgVsCluster : player.avgVsGuild
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
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  const maxAbsValue = playerSummaries.length > 0 ? 
    Math.max(...playerSummaries.map(p => Math.abs(getPerformanceValue(p)))) : 0
  const chartMax = Math.max(maxAbsValue, 40)
  const topPlayer = playerSummaries.length > 0 ? playerSummaries[0] : null

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Player Performance vs Average (Per Boss)</h2>
        <p className="text-sm text-gray-600">Season {selectedSeason} - {selectedGuild}</p>
        <p className="text-xs text-gray-500">Legendary Tier Only • No Last Hits • No Bombs • 2+ Battles per Boss</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Compare Against:</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cluster')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                  viewMode === 'cluster'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Cluster Average
              </button>
              <button
                onClick={() => setViewMode('guild')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                  viewMode === 'guild'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Guild Average
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showBossDetail}
                onChange={(e) => setShowBossDetail(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">Show Boss-by-Boss Detail</span>
            </label>
          </div>
        </div>
      </div>

      {/* No Data Message */}
      {playerSummaries.length === 0 && !loading && (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p className="text-gray-500">No qualified players found</p>
        </div>
      )}

      {/* Performance Chart */}
      {playerSummaries.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-4">
            Average Performance vs {viewMode === 'cluster' ? "Cluster" : "Guild"} [%]
          </h3>
          
          <div className="space-y-3">
            {playerSummaries.map((player) => {
              const value = getPerformanceValue(player)
              const barWidth = Math.abs(value) / chartMax * 100
              const isPositive = value >= 0
              
              return (
                <div key={player.displayName} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{player.displayName}</span>
                    <span className={`text-sm font-mono ${getTextColor(value)}`}>
                      {value >= 0 ? '+' : ''}{value.toFixed(1)}
                    </span>
                  </div>
                  
                  {/* Horizontal Bar Chart */}
                  <div className="relative">
                    <div className="absolute inset-0 flex justify-center">
                      <div className="w-px bg-gray-300 h-full"></div>
                    </div>
                    
                    <div className="relative flex items-center justify-center h-6">
                      {isPositive ? (
                        <div className="flex w-full justify-center">
                          <div className="w-1/2"></div>
                          <div 
                            className={`h-4 ${getBarColor(value)} transition-all duration-300`}
                            style={{ width: `${barWidth / 2}%` }}
                          ></div>
                        </div>
                      ) : (
                        <div className="flex w-full justify-center">
                          <div 
                            className={`h-4 ${getBarColor(value)} transition-all duration-300`}
                            style={{ width: `${barWidth / 2}%`, marginLeft: `${50 - (barWidth / 2)}%` }}
                          ></div>
                          <div className="w-1/2"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{player.bossesPlayed} bosses • {player.totalBattles} battles</span>
                    <span>Cluster: {player.avgVsCluster >= 0 ? '+' : ''}{player.avgVsCluster.toFixed(1)}% • Guild: {player.avgVsGuild >= 0 ? '+' : ''}{player.avgVsGuild.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-500">
              <span>-{chartMax.toFixed(0)}%</span>
              <span>0%</span>
              <span>+{chartMax.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Boss Detail Table */}
      {showBossDetail && playerBossStats.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-4">Boss-by-Boss Performance Detail</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Player</th>
                  <th className="text-left p-2">Boss</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-right p-2">Battles</th>
                  <th className="text-right p-2">Avg Damage</th>
                  <th className="text-right p-2">vs Cluster</th>
                  <th className="text-right p-2">vs Guild</th>
                </tr>
              </thead>
              <tbody>
                {playerBossStats
                  .sort((a, b) => (viewMode === 'cluster' ? b.vsClusterPct : b.vsGuildPct) - (viewMode === 'cluster' ? a.vsClusterPct : a.vsGuildPct))
                  .map((stat, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 font-medium">{stat.displayName}</td>
                      <td className="p-2">{stat.bossName}</td>
                      <td className="p-2 text-xs">{stat.overallTokenUsage}</td>
                      <td className="p-2 text-right">{stat.battleCount}</td>
                      <td className="p-2 text-right">{(stat.playerAvg / 1000000).toFixed(2)}M</td>
                      <td className={`p-2 text-right ${getTextColor(stat.vsClusterPct)}`}>
                        {stat.vsClusterPct >= 0 ? '+' : ''}{stat.vsClusterPct.toFixed(1)}%
                      </td>
                      <td className={`p-2 text-right ${getTextColor(stat.vsGuildPct)}`}>
                        {stat.vsGuildPct >= 0 ? '+' : ''}{stat.vsGuildPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Summary */}
      {playerSummaries.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Performance Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-green-600 font-medium">Above Average</div>
              <div className="text-lg font-bold">
                {playerSummaries.filter(p => getPerformanceValue(p) > 0).length}
              </div>
            </div>
            <div>
              <div className="text-red-600 font-medium">Below Average</div>
              <div className="text-lg font-bold">
                {playerSummaries.filter(p => getPerformanceValue(p) < 0).length}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600 space-y-1">
              {topPlayer && (
                <div>Top Performer: <span className="font-medium">{topPlayer.displayName}</span> ({getPerformanceValue(topPlayer) >= 0 ? '+' : ''}{getPerformanceValue(topPlayer).toFixed(1)}%)</div>
              )}
              <div>Qualified Players: {playerSummaries.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
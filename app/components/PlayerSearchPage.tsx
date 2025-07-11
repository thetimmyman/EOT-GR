'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { addCalculatedFields, addPowerBIIndexing, CalculatedData } from '../lib/calculations'
import { 
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from './RechartsWrapper'
import { formatBossName } from '../lib/themeUtils'

interface PlayerSearchPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface PlayerStats {
  totalDamage: number
  avgDamagePerHit: number
  tokensUsed: number
  bombsUsed: number
  vsClusterAvg: number
  vsGuildAvg: number
  weightedContribution: number
  bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number, weightedContribution: number}}
  primeStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number, weightedContribution: number, set?: number}}
  historicalTokens: {[key: string]: number}
  radarData: Array<{boss: string, playerAvg: number, guildAvg: number}>
}

export default function PlayerSearchPage({ selectedGuild, selectedSeason }: PlayerSearchPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [clusterAvg, setClusterAvg] = useState(0)
  const [guildAvg, setGuildAvg] = useState(0)
  const [clusterBossAvgs, setClusterBossAvgs] = useState<{[key: string]: number}>({})
  const [guildBossAvgs, setGuildBossAvgs] = useState<{[key: string]: number}>({})
  const [clusterPrimeAvgs, setClusterPrimeAvgs] = useState<{[key: string]: number}>({})
  const [guildPrimeAvgs, setGuildPrimeAvgs] = useState<{[key: string]: number}>({})

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchAvailablePlayers()
    }
  }, [selectedGuild, selectedSeason])

  useEffect(() => {
    if (selectedPlayer && selectedSeason && selectedGuild) {
      fetchPlayerStats()
    }
  }, [selectedPlayer, selectedSeason, selectedGuild])

  const fetchAvailablePlayers = async () => {
    if (!selectedGuild || !selectedSeason) return
    
    const { data, error } = await supabase
      .from('EOT_GR_data')
      .select('displayName')
      .eq('Guild', selectedGuild)
      .eq('Season', selectedSeason)
      .not('displayName', 'is', null)
      .limit(10000)

    if (error) {
      console.error('Error fetching players:', error)
      return
    }

    if (data) {
      const uniqueNames = new Set(data.map(d => d.displayName))
      const players = Array.from(uniqueNames).sort()
      console.log('Found players:', players.length)
      setAvailablePlayers(players)
    }
  }

  const fetchPlayerStats = async () => {
    if (!selectedPlayer || !selectedGuild || !selectedSeason) return
    
    setLoading(true)
    console.log('Fetching stats for:', selectedPlayer, selectedGuild, selectedSeason)

    try {
      // Get ALL cluster data - include all fields needed for calculations
      const { data: allClusterData } = await supabase
        .from('EOT_GR_data')
        .select('id, damageDealt, damageType, Name, encounterId, remainingHp, rarity, loopIndex, tier, Season, Guild, displayName, set, enemyHp, enemyHpLeft, startedOn, completedOn, timestamp, userId, encounterIndex')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .gt('damageDealt', 0)
        .not('Name', 'is', null)
        .limit(100000)

      // Get ALL guild data - include all fields needed for calculations
      const { data: allGuildData } = await supabase
        .from('EOT_GR_data')
        .select('id, damageDealt, damageType, Name, encounterId, remainingHp, rarity, loopIndex, tier, Season, Guild, displayName, set, enemyHp, enemyHpLeft, startedOn, completedOn, timestamp, userId, encounterIndex')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .gt('damageDealt', 0)
        .not('Name', 'is', null)
        .limit(100000)

      // Get ALL player data
      const { data: allPlayerData, error: playerError } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('displayName', selectedPlayer)
        .gte('tier', 4)
        .limit(10000)

      console.log('Data loaded - Cluster:', allClusterData?.length, 'Guild:', allGuildData?.length, 'Player:', allPlayerData?.length)

      if (playerError) {
        console.error('Error fetching player data:', playerError)
        setLoading(false)
        return
      }

      if (!allPlayerData || allPlayerData.length === 0) {
        console.log('No data found for player')
        setLoading(false)
        return
      }

      // Get historical data for past 5 completed seasons (excluding current)
      const currentSeasonNum = parseInt(selectedSeason)
      const pastSeasons = []
      for (let i = 1; i <= 5; i++) {
        pastSeasons.push((currentSeasonNum - i).toString())
      }

      const { data: historicalData } = await supabase
        .from('EOT_GR_data')
        .select('Season, damageType')
        .eq('Guild', selectedGuild)
        .eq('displayName', selectedPlayer)
        .in('Season', pastSeasons)
        .limit(10000)

      // Apply PowerBI-style calculations with indexing
      const calculatedClusterData = allClusterData ? addPowerBIIndexing(addCalculatedFields(allClusterData)) : []
      const calculatedGuildData = allGuildData ? addPowerBIIndexing(addCalculatedFields(allGuildData)) : []
      const calculatedPlayerData = addPowerBIIndexing(addCalculatedFields(allPlayerData))
      
      // Filter out last hits and crashes (like PowerBI)
      const filteredClusterData = calculatedClusterData.filter(d => 
        d.SpecialCases !== 'Last Hit' && d.SpecialCases !== 'Crash'
      )
      
      const filteredGuildData = calculatedGuildData.filter(d => 
        d.SpecialCases !== 'Last Hit' && d.SpecialCases !== 'Crash'
      )
      
      const filteredPlayerBattleData = calculatedPlayerData.filter(d => 
        d.damageType === 'Battle' && d.SpecialCases !== 'Last Hit' && d.SpecialCases !== 'Crash'
      )

      console.log('Filtered data counts - Cluster:', filteredClusterData.length, 'Guild:', filteredGuildData.length, 'Player Battle:', filteredPlayerBattleData.length)

      // Calculate cluster and guild averages by boss/prime using overallTokenUsage grouping
      const clusterBossAverages: {[key: string]: number} = {}
      const clusterPrimeAverages: {[key: string]: number} = {}
      const guildBossAverages: {[key: string]: number} = {}
      const guildPrimeAverages: {[key: string]: number} = {}

      // Process cluster data with proper grouping by boss and overallTokenUsage
      if (filteredClusterData.length > 0) {
        const clusterBossData: {[key: string]: {[rank: string]: number[]}} = {}
        const clusterPrimeData: {[key: string]: {[rank: string]: number[]}} = {}
        
        filteredClusterData.forEach(d => {
          const bossName = d.Name || 'Unknown'
          const bossRank = d.overallTokenUseage || 'Unknown'
          
          if (d.encounterId === 0) {
            if (!clusterBossData[bossName]) clusterBossData[bossName] = {}
            if (!clusterBossData[bossName][bossRank]) clusterBossData[bossName][bossRank] = []
            clusterBossData[bossName][bossRank].push(d.damageDealt || 0)
          } else {
            if (!clusterPrimeData[bossName]) clusterPrimeData[bossName] = {}
            if (!clusterPrimeData[bossName][bossRank]) clusterPrimeData[bossName][bossRank] = []
            clusterPrimeData[bossName][bossRank].push(d.damageDealt || 0)
          }
        })

        Object.keys(clusterBossData).forEach(boss => {
          Object.keys(clusterBossData[boss]).forEach(rank => {
            const hits = clusterBossData[boss][rank]
            const key = `${boss}_${rank}`
            clusterBossAverages[key] = hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : 0
          })
        })

        Object.keys(clusterPrimeData).forEach(boss => {
          Object.keys(clusterPrimeData[boss]).forEach(rank => {
            const hits = clusterPrimeData[boss][rank]
            const key = `${boss}_${rank}`
            clusterPrimeAverages[key] = hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : 0
          })
        })
      }

      // Process guild data with proper grouping by boss and overallTokenUsage
      if (filteredGuildData.length > 0) {
        const guildBossData: {[key: string]: {[rank: string]: number[]}} = {}
        const guildPrimeData: {[key: string]: {[rank: string]: number[]}} = {}
        
        filteredGuildData.forEach(d => {
          const bossName = d.Name || 'Unknown'
          const bossRank = d.overallTokenUseage || 'Unknown'
          
          if (d.encounterId === 0) {
            if (!guildBossData[bossName]) guildBossData[bossName] = {}
            if (!guildBossData[bossName][bossRank]) guildBossData[bossName][bossRank] = []
            guildBossData[bossName][bossRank].push(d.damageDealt || 0)
          } else {
            if (!guildPrimeData[bossName]) guildPrimeData[bossName] = {}
            if (!guildPrimeData[bossName][bossRank]) guildPrimeData[bossName][bossRank] = []
            guildPrimeData[bossName][bossRank].push(d.damageDealt || 0)
          }
        })

        Object.keys(guildBossData).forEach(boss => {
          Object.keys(guildBossData[boss]).forEach(rank => {
            const hits = guildBossData[boss][rank]
            const key = `${boss}_${rank}`
            guildBossAverages[key] = hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : 0
          })
        })

        Object.keys(guildPrimeData).forEach(boss => {
          Object.keys(guildPrimeData[boss]).forEach(rank => {
            const hits = guildPrimeData[boss][rank]
            const key = `${boss}_${rank}`
            guildPrimeAverages[key] = hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : 0
          })
        })
      }

      setClusterBossAvgs(clusterBossAverages)
      setGuildBossAvgs(guildBossAverages)
      setClusterPrimeAvgs(clusterPrimeAverages)
      setGuildPrimeAvgs(guildPrimeAverages)

      // Calculate overall averages (simple average of all non-last-hit Battle damage)
      const clusterAverage = filteredClusterData.length > 0 ? 
        filteredClusterData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / filteredClusterData.length : 0
      setClusterAvg(clusterAverage)

      const guildAverage = filteredGuildData.length > 0 ? 
        filteredGuildData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / filteredGuildData.length : 0
      setGuildAvg(guildAverage)

      console.log('Averages - Cluster:', clusterAverage, 'Guild:', guildAverage)

      // Calculate player stats from properly filtered data
      const bombData = allPlayerData.filter(d => d.damageType === 'Bomb')
      
      // Token calculation should match TokenUsagePage: include ALL battle data (including last hits)
      const allPlayerBattleData = calculatedPlayerData.filter(d => 
        d.damageType === 'Battle' && d.tier >= 4 && d.rarity === 'Legendary'
      )
      
      const totalBattleDamage = filteredPlayerBattleData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const totalBombDamage = bombData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const totalDamage = totalBattleDamage + totalBombDamage
      const tokensUsed = allPlayerBattleData.length  // FIXED: Use all battle data like TokenUsagePage
      const bombsUsed = bombData.length
      const avgDamagePerHit = filteredPlayerBattleData.length > 0 ? totalBattleDamage / filteredPlayerBattleData.length : 0  // Only battle damage for average (excluding last hits)
      const totalWeightedContribution = filteredPlayerBattleData.reduce((sum, d) => sum + (d.WeightedContribution || 0), 0)
      const avgWeightedContribution = tokensUsed > 0 ? totalWeightedContribution / tokensUsed : 0

      console.log('Player stats:', { totalDamage, totalBattleDamage, tokensUsed, bombsUsed, avgDamagePerHit })

      // Boss and Prime stats with proper comparisons
      const bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number, weightedContribution: number}} = {}
      const primeStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number, weightedContribution: number, set?: number}} = {}
      
      filteredPlayerBattleData.forEach(d => {
        const bossName = d.Name || 'Unknown'
        
        if (d.encounterId === 0) {
          if (!bossStats[bossName]) {
            bossStats[bossName] = { damage: 0, tokens: 0, avgDamage: 0, biggestHit: 0, vsClusterAvg: 0, vsGuildAvg: 0, weightedContribution: 0 }
          }
          bossStats[bossName].damage += d.damageDealt || 0
          bossStats[bossName].tokens += 1
          bossStats[bossName].biggestHit = Math.max(bossStats[bossName].biggestHit, d.damageDealt || 0)
          bossStats[bossName].weightedContribution += d.WeightedContribution || 0
        } else {
          if (!primeStats[bossName]) {
            primeStats[bossName] = { damage: 0, tokens: 0, avgDamage: 0, biggestHit: 0, vsClusterAvg: 0, vsGuildAvg: 0, weightedContribution: 0, set: typeof d.set === 'number' ? d.set : parseInt(d.set) || 0 }
          }
          primeStats[bossName].damage += d.damageDealt || 0
          primeStats[bossName].tokens += 1
          primeStats[bossName].biggestHit = Math.max(primeStats[bossName].biggestHit, d.damageDealt || 0)
          primeStats[bossName].weightedContribution += d.WeightedContribution || 0
        }
      })

      // Calculate averages and comparisons for bosses using the proper key format
      Object.keys(bossStats).forEach(boss => {
        const stats = bossStats[boss]
        stats.avgDamage = stats.tokens > 0 ? stats.damage / stats.tokens : 0
        
        const playerBossData = filteredPlayerBattleData.filter(d => d.Name === boss && d.encounterId === 0)
        const mostCommonRank = playerBossData.length > 0 ? 
          playerBossData[0].overallTokenUseage : 
          boss
        const comparisonKey = `${boss}_${mostCommonRank}`
        
        const clusterAvg = clusterBossAverages[comparisonKey] || 0
        stats.vsClusterAvg = clusterAvg > 0 ? ((stats.avgDamage / clusterAvg) - 1) * 100 : 0
        
        const guildAvg = guildBossAverages[comparisonKey] || 0
        stats.vsGuildAvg = guildAvg > 0 ? ((stats.avgDamage / guildAvg) - 1) * 100 : 0
        
        console.log(`Boss ${boss}: player ${stats.avgDamage}, cluster ${clusterAvg}, guild ${guildAvg}`)
      })

      // Calculate averages and comparisons for primes using the proper key format
      Object.keys(primeStats).forEach(boss => {
        const stats = primeStats[boss]
        stats.avgDamage = stats.tokens > 0 ? stats.damage / stats.tokens : 0
        
        const playerPrimeData = filteredPlayerBattleData.filter(d => d.Name === boss && d.encounterId > 0)
        const mostCommonRank = playerPrimeData.length > 0 ? 
          playerPrimeData[0].overallTokenUseage : 
          "Leg. Primes"
        const comparisonKey = `${boss}_${mostCommonRank}`
        
        const clusterAvg = clusterPrimeAverages[comparisonKey] || 0
        stats.vsClusterAvg = clusterAvg > 0 ? ((stats.avgDamage / clusterAvg) - 1) * 100 : 0
        
        const guildAvg = guildPrimeAverages[comparisonKey] || 0
        stats.vsGuildAvg = guildAvg > 0 ? ((stats.avgDamage / guildAvg) - 1) * 100 : 0
        
        console.log(`Prime ${boss}: player ${stats.avgDamage}, cluster ${clusterAvg}, guild ${guildAvg}`)
      })

      // Historical tokens by season
      const historicalTokens: {[key: string]: number} = {}
      pastSeasons.forEach(season => {
        const seasonData = historicalData?.filter(d => d.Season === season && d.damageType === 'Battle') || []
        historicalTokens[season] = seasonData.length
      })

      // Calculate vs averages using the same logic as PlayerPerformancePage
      // Get the player's data grouped by boss/token usage for proper comparison
      const playerPerformance = filteredPlayerBattleData.reduce((acc, d) => {
        const key = `${d.Name}_${d.overallTokenUseage}`
        if (!acc[key]) {
          acc[key] = { total: 0, count: 0 }
        }
        acc[key].total += d.damageDealt || 0
        acc[key].count += 1
        return acc
      }, {} as Record<string, { total: number, count: number }>)

      // Calculate weighted averages based on player's actual boss encounters
      let totalPlayerVsCluster = 0
      let totalPlayerVsGuild = 0
      let validComparisons = 0

      Object.keys(playerPerformance).forEach(key => {
        const playerAvg = playerPerformance[key].total / playerPerformance[key].count
        const clusterKey = key
        const guildKey = key
        
        const clusterAvg = clusterBossAverages[clusterKey] || 0
        const guildAvg = guildBossAverages[guildKey] || 0
        
        if (clusterAvg > 0 && guildAvg > 0) {
          const vsCluster = ((playerAvg / clusterAvg) - 1) * 100
          const vsGuild = ((playerAvg / guildAvg) - 1) * 100
          
          totalPlayerVsCluster += vsCluster
          totalPlayerVsGuild += vsGuild
          validComparisons += 1
        }
      })

      const vsClusterAvg = validComparisons > 0 ? totalPlayerVsCluster / validComparisons : 0
      const vsGuildAvg = validComparisons > 0 ? totalPlayerVsGuild / validComparisons : 0

      console.log('Final performance vs averages:', { vsClusterAvg, vsGuildAvg })

      // Prepare radar chart data (Player vs Guild Average for each boss)
      const radarData: Array<{boss: string, playerAvg: number, guildAvg: number}> = []
      
      Object.keys(bossStats).forEach(boss => {
        const playerStats = bossStats[boss]
        // Find the guild average for this boss
        const playerBossData = filteredPlayerBattleData.filter(d => d.Name === boss && d.encounterId === 0)
        const mostCommonRank = playerBossData.length > 0 ? 
          playerBossData[0].overallTokenUseage : 
          boss
        const comparisonKey = `${boss}_${mostCommonRank}`
        const guildBossAvg = guildBossAverages[comparisonKey] || 0
        
        if (guildBossAvg > 0) {
          // Get the set number for boss level formatting
          const setNumber = playerBossData.length > 0 ? Number(playerBossData[0].set) || 0 : 0
          radarData.push({
            boss: formatBossName(boss, setNumber),
            playerAvg: Math.round(playerStats.avgDamage / 1000), // Convert to K for readability
            guildAvg: Math.round(guildBossAvg / 1000) // Convert to K for readability
          })
        }
      })

      const finalStats = {
        totalDamage,
        avgDamagePerHit,
        tokensUsed,
        bombsUsed,
        vsClusterAvg,
        vsGuildAvg,
        weightedContribution: avgWeightedContribution,
        bossStats,
        primeStats,
        historicalTokens,
        radarData
      }

      console.log('Final stats:', finalStats)
      setPlayerStats(finalStats)

    } catch (error) {
      console.error('Error in fetchPlayerStats:', error)
    }

    setLoading(false)
  }

  const filteredPlayers = availablePlayers.filter(player =>
    player.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPerformanceColor = (value: number) => {
    if (value >= 20) return 'accent-success'
    if (value >= 10) return 'text-green-600'
    if (value >= 0) return 'accent-warning'
    if (value >= -10) return 'text-orange-500'
    return 'accent-danger'
  }

  const getPerformanceBadge = (value: number) => {
    if (value >= 20) return 'badge-success'
    if (value >= 10) return 'badge-success'
    if (value >= 0) return 'badge-warning'
    if (value >= -10) return 'badge-warning'
    return 'perf-poor'
  }

  return (
    <div className="container-modern py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gradient mb-3">
          Player Performance Search
        </h2>
        <p className="text-secondary font-medium">
          Season {selectedSeason} • {selectedGuild} Guild Analysis
        </p>
      </div>

      {/* Player Search */}
      <div className="card-modern p-5 hover-lift">
        <label htmlFor="player-search-input" className="block text-sm font-semibold text-secondary mb-3">
          🔍 Search Player
        </label>
        <input
          id="player-search-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Type player name to search..."
          className="input-wh40k w-full text-base mb-4"
        />
        
        {searchTerm && (
          <div className="max-h-64 overflow-y-auto border border-light rounded-lg bg-secondary">
            {filteredPlayers.map(player => (
              <button
                key={player}
                onClick={() => {
                  setSelectedPlayer(player)
                  setSearchTerm('')
                }}
                className="w-full text-left px-4 py-3 hover:bg-card border-b border-light last:border-b-0 transition-all duration-200 font-medium"
              >
                👤 {player}
              </button>
            ))}
          </div>
        )}

        {selectedPlayer && (
          <div className="mt-4 p-4 bg-primary border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-secondary font-medium">Selected Player:</span> 
              <span className="font-bold text-primary">{selectedPlayer}</span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center p-16">
          <div className="spinner-modern w-8 h-8"></div>
        </div>
      )}

      {/* Player Stats */}
      {playerStats && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Overview Stats */}
          <div className="card-elevated p-5">
            <h3 className="text-xl font-bold text-primary mb-3 flex items-center">
              📊 Season Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 card-modern hover-lift">
                <div className="text-3xl font-bold text-gradient mb-2">
                  {(playerStats.totalDamage / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm font-medium text-secondary">Total Damage</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="text-3xl font-bold accent-warning mb-2">
                  {(playerStats.avgDamagePerHit / 1000).toFixed(0)}K
                </div>
                <div className="text-sm font-medium text-secondary">Avg Per Hit</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="text-3xl font-bold accent-success mb-2">
                  {(playerStats.weightedContribution / 1000).toFixed(0)}K
                </div>
                <div className="text-sm font-medium text-secondary">Weighted Contrib</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="text-3xl font-bold accent-cyan mb-2">
                  {playerStats.tokensUsed}
                </div>
                <div className="text-sm font-medium text-secondary">Tokens Used</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="text-3xl font-bold accent-purple mb-2">
                  {playerStats.bombsUsed}
                </div>
                <div className="text-sm font-medium text-secondary">Bombs Used</div>
              </div>
            </div>
          </div>

          {/* Historical Activity */}
          <div className="card-elevated p-5">
            <h3 className="text-xl font-bold text-primary mb-3 flex items-center">
              📅 Historical Token Usage (Past 5 Completed Seasons)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(playerStats.historicalTokens)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([season, tokens]) => (
                  <div key={season} className="text-center p-4 card-modern hover-lift">
                    <div className="text-2xl font-bold accent-cyan mb-2">{tokens}</div>
                    <div className="text-sm font-medium text-secondary">Season {season}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Performance Comparison */}
          <div className="card-elevated p-5">
            <h3 className="text-xl font-bold text-primary mb-3 flex items-center">
              📈 Performance vs Averages
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div className="p-3 card-modern hover-lift">
                <div className="flex items-center mb-2">
                  <span className="text-sm font-semibold text-secondary flex-1">vs Cluster Average</span>
                  <div className="w-16 text-center">
                    <span className={`text-sm font-mono ${getPerformanceBadge(playerStats.vsClusterAvg)}`}>
                      {playerStats.vsClusterAvg > 0 ? '+' : ''}{playerStats.vsClusterAvg.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-secondary">
                  Cluster: {(clusterAvg / 1000).toFixed(0)}K/hit
                </div>
              </div>

              <div className="p-3 card-modern hover-lift">
                <div className="flex items-center mb-2">
                  <span className="text-sm font-semibold text-secondary flex-1">vs Guild Average</span>
                  <div className="w-16 text-center">
                    <span className={`text-sm font-mono ${getPerformanceBadge(playerStats.vsGuildAvg)}`}>
                      {playerStats.vsGuildAvg > 0 ? '+' : ''}{playerStats.vsGuildAvg.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-secondary">
                  Guild: {(guildAvg / 1000).toFixed(0)}K/hit
                </div>
              </div>
            </div>
            
            {/* Radar Chart: Player vs Guild Averages per Boss */}
            {playerStats.radarData && playerStats.radarData.length > 0 && (
              <div className="bg-slate-900/50 rounded-lg p-2 mt-2">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={playerStats.radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                    <PolarGrid stroke="#475569" gridType="polygon" radialLines={true} />
                    <PolarAngleAxis 
                      dataKey="boss" 
                      tick={{ fontSize: 11, fill: '#cbd5e1' }}
                      className="text-slate-300"
                    />
                    <PolarRadiusAxis 
                      tick={{ fontSize: 9, fill: '#94a3b8' }} 
                      tickCount={8}
                      domain={[0, 'dataMax']}
                      angle={0}
                      tickFormatter={(value: number) => `${Math.round(value)}K`}
                    />
                    <Radar
                      name="Player Average"
                      dataKey="playerAvg"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.4}
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#ffffff' }}
                    />
                    <Radar
                      name="Guild Average"
                      dataKey="guildAvg"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={{ r: 4, fill: '#F59E0B', strokeWidth: 1, stroke: '#ffffff' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                      iconType="rect"
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Boss Performance */}
          {Object.keys(playerStats.bossStats).length > 0 && (
            <div className="card-elevated p-5">
              <h3 className="text-xl font-bold text-primary mb-3 flex items-center">
                ⚔️ Boss Performance
              </h3>
              <div className="space-y-2">
                {Object.entries(playerStats.bossStats)
                  .sort(([, a], [, b]) => b.vsClusterAvg - a.vsClusterAvg) // Sort by performance, highest to lowest
                  .map(([boss, stats]) => (
                    <div key={boss} className="p-3 card-modern hover-lift">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-primary">{boss}</span>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-secondary">
                            {stats.tokens}t
                          </span>
                          <span className="text-xs font-mono accent-warning">
                            {(stats.avgDamage / 1000).toFixed(0)}K
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-secondary">
                        <div className="text-center">
                          <div className="font-medium">Biggest Hit</div>
                          <div className="accent-red">{(stats.biggestHit / 1000000).toFixed(2)}M</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">vs Cluster Avg</div>
                          <div className={`${getPerformanceColor(stats.vsClusterAvg)}`}>
                            {stats.vsClusterAvg > 0 ? '+' : ''}{stats.vsClusterAvg.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">vs Guild Avg</div>
                          <div className={`${getPerformanceColor(stats.vsGuildAvg)}`}>
                            {stats.vsGuildAvg > 0 ? '+' : ''}{stats.vsGuildAvg.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-secondary mt-2">
                        Total: {(stats.damage / 1000000).toFixed(2)}M damage
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Prime Performance */}
          {Object.keys(playerStats.primeStats).length > 0 && (
            <div className="card-elevated p-5">
              <h3 className="text-xl font-bold text-primary mb-3 flex items-center">
                🎯 Prime Performance
              </h3>
              <div className="space-y-2">
                {Object.entries(playerStats.primeStats)
                  .sort(([, a], [, b]) => b.vsClusterAvg - a.vsClusterAvg) // Sort by performance, highest to lowest
                  .map(([boss, stats]) => (
                    <div key={boss} className="p-3 card-modern hover-lift">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-primary">L{(stats.set ?? 0) + 1} {boss}</span>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-secondary">
                            {stats.tokens}t
                          </span>
                          <span className="text-xs font-mono accent-purple">
                            {(stats.avgDamage / 1000).toFixed(0)}K
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-secondary">
                        <div className="text-center">
                          <div className="font-medium">Biggest Hit</div>
                          <div className="accent-red">{(stats.biggestHit / 1000000).toFixed(2)}M</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">vs Cluster AVG</div>
                          <div className={`${getPerformanceColor(stats.vsClusterAvg)}`}>
                            {stats.vsClusterAvg > 0 ? '+' : ''}{stats.vsClusterAvg.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">vs Guild AVG</div>
                          <div className={`${getPerformanceColor(stats.vsGuildAvg)}`}>
                            {stats.vsGuildAvg > 0 ? '+' : ''}{stats.vsGuildAvg.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-secondary mt-2">
                        Total: {(stats.damage / 1000000).toFixed(2)}M damage
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Player Selected */}
      {!selectedPlayer && !loading && (
        <div className="card-elevated p-16 text-center">
          <div className="text-6xl mb-6">🔍</div>
          <h3 className="text-2xl font-bold text-primary mb-3">No Player Selected</h3>
          <p className="text-secondary font-medium max-w-md mx-auto">
            Search for a player above to view detailed performance statistics and combat analysis.
          </p>
        </div>
      )}
    </div>
  )
}

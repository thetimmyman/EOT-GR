console.log('Player data found:', playerData?.length || 0)

      if (playerError) {
        console.error('Error fetching player data:', playerError)
        setLoading(false)
        return
      }

      if (!playerData || playerData.length === 0) {
        console.log('No data found for player')
        setLoading(false)
        return
      }interface PlayerStats {
  totalDamage: number
  avgDamagePerHit: number
  tokensUsed: number
  bombsUsed: number
  vsCluster'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number}}
  primeStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number}}
  historicalTokens: {[key: string]: number}
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
      // Get cluster data with proper filters matching Power BI
      const { data: clusterData } = await supabase
        .from('EOT_GR_data')
        .select('damageDealt, damageType, Name, encounterId, remainingHp, rarity, overallTokenUseage')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')
        .neq('remainingHp', 0) // Exclude last hits (remainingHp = 0)
        .gt('damageDealt', 0)
        .limit(15000)

      // Get guild data with proper filters matching Power BI
      const { data: guildData } = await supabase
        .from('EOT_GR_data')
        .select('damageDealt, damageType, Name, encounterId, remainingHp, rarity, overallTokenUseage')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')
        .neq('remainingHp', 0) // Exclude last hits (remainingHp = 0)
        .gt('damageDealt', 0)
        .limit(15000)

      // Get player data with proper filters
      const { data: playerData, error: playerError } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('displayName', selectedPlayer)
        .eq('rarity', 'Legendary')
        .neq('remainingHp', 0) // Exclude last hits
        .limit(10000)

      // Get historical data for past 5 seasons
      const currentSeasonNum = parseInt(selectedSeason)
      const pastSeasons = []
      for (let i = 0; i < 5; i++) {
        pastSeasons.push((currentSeasonNum - i).toString())
      }

      const { data: historicalData } = await supabase
        .from('EOT_GR_data')
        .select('Season, damageType')
        .eq('Guild', selectedGuild)
        .eq('displayName', selectedPlayer)
        .in('Season', pastSeasons)
        .limit(10000)

      // Calculate cluster and guild averages by boss/prime
      const clusterBossAverages: {[key: string]: number} = {}
      const clusterPrimeAverages: {[key: string]: number} = {}
      const guildBossAverages: {[key: string]: number} = {}
      const guildPrimeAverages: {[key: string]: number} = {}

      // Process cluster data with proper grouping by boss and overallTokenUseage (boss rank)
      if (clusterData) {
        const clusterBossData: {[key: string]: {[rank: string]: number[]}} = {}
        const clusterPrimeData: {[key: string]: {[rank: string]: number[]}} = {}
        
        clusterData.forEach(d => {
          const bossName = d.Name || 'Unknown'
          const bossRank = d.overallTokenUseage || '0'
          
          if (d.encounterId === 0) {
            // Main boss
            if (!clusterBossData[bossName]) clusterBossData[bossName] = {}
            if (!clusterBossData[bossName][bossRank]) clusterBossData[bossName][bossRank] = []
            clusterBossData[bossName][bossRank].push(d.damageDealt || 0)
          } else {
            // Prime
            if (!clusterPrimeData[bossName]) clusterPrimeData[bossName] = {}
            if (!clusterPrimeData[bossName][bossRank]) clusterPrimeData[bossName][bossRank] = []
            clusterPrimeData[bossName][bossRank].push(d.damageDealt || 0)
          }
        })

        // Calculate averages by boss and rank
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

      // Process guild data with proper grouping by boss and overallTokenUseage (boss rank)
      if (guildData) {
        const guildBossData: {[key: string]: {[rank: string]: number[]}} = {}
        const guildPrimeData: {[key: string]: {[rank: string]: number[]}} = {}
        
        guildData.forEach(d => {
          const bossName = d.Name || 'Unknown'
          const bossRank = d.overallTokenUseage || '0'
          
          if (d.encounterId === 0) {
            // Main boss
            if (!guildBossData[bossName]) guildBossData[bossName] = {}
            if (!guildBossData[bossName][bossRank]) guildBossData[bossName][bossRank] = []
            guildBossData[bossName][bossRank].push(d.damageDealt || 0)
          } else {
            // Prime
            if (!guildPrimeData[bossName]) guildPrimeData[bossName] = {}
            if (!guildPrimeData[bossName][bossRank]) guildPrimeData[bossName][bossRank] = []
            guildPrimeData[bossName][bossRank].push(d.damageDealt || 0)
          }
        })

        // Calculate averages by boss and rank
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

      // Calculate overall averages
      const clusterAverage = clusterData && clusterData.length > 0 ? 
        clusterData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / clusterData.length : 0
      setClusterAvg(clusterAverage)

      const guildAverage = guildData && guildData.length > 0 ? 
        guildData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / guildData.length : 0
      setGuildAvg(guildAverage)

      console.log('Averages - Cluster:', clusterAverage, 'Guild:', guildAverage)

      // Calculate player stats from properly filtered data
      const bombData = playerData.filter(d => d.damageType === 'Bomb')
      
      const totalDamage = battleData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) + 
                         bombData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const tokensUsed = battleData.length
      const bombsUsed = bombData.length
      const avgDamagePerHit = tokensUsed > 0 ? totalDamage / tokensUsed : 0

      console.log('Player stats:', { totalDamage, tokensUsed, bombsUsed, avgDamagePerHit })

      // Boss and Prime stats with proper comparisons matching Power BI logic
      const bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number}} = {}
      const primeStats: {[key: string]: {damage: number, tokens: number, avgDamage: number, biggestHit: number, vsClusterAvg: number, vsGuildAvg: number}} = {}
      
      // Filter to only Battle, Legendary, non-last hits
      const battleData = playerData.filter(d => 
        d.damageType === 'Battle' && 
        d.rarity === 'Legendary' && 
        d.remainingHp !== 0 // Exclude last hits
      )
      
      battleData.forEach(d => {
        const bossName = d.Name || 'Unknown'
        const bossRank = d.overallTokenUseage || '0'
        
        if (d.encounterId === 0) {
          // Main boss
          if (!bossStats[bossName]) {
            bossStats[bossName] = { damage: 0, tokens: 0, avgDamage: 0, biggestHit: 0, vsClusterAvg: 0, vsGuildAvg: 0 }
          }
          bossStats[bossName].damage += d.damageDealt || 0
          bossStats[bossName].tokens += 1
          bossStats[bossName].biggestHit = Math.max(bossStats[bossName].biggestHit, d.damageDealt || 0)
        } else {
          // Prime
          if (!primeStats[bossName]) {
            primeStats[bossName] = { damage: 0, tokens: 0, avgDamage: 0, biggestHit: 0, vsClusterAvg: 0, vsGuildAvg: 0 }
          }
          primeStats[bossName].damage += d.damageDealt || 0
          primeStats[bossName].tokens += 1
          primeStats[bossName].biggestHit = Math.max(primeStats[bossName].biggestHit, d.damageDealt || 0)
        }
      })

      // Calculate averages and comparisons for bosses using the proper key format
      Object.keys(bossStats).forEach(boss => {
        const stats = bossStats[boss]
        stats.avgDamage = stats.tokens > 0 ? stats.damage / stats.tokens : 0
        
        // For comparison, we need to find the correct boss rank for this player's data
        const playerBossData = battleData.filter(d => d.Name === boss && d.encounterId === 0)
        const mostCommonRank = playerBossData.length > 0 ? playerBossData[0].overallTokenUseage || '0' : '0'
        const comparisonKey = `${boss}_${mostCommonRank}`
        
        // Calculate vs cluster average
        const clusterAvg = clusterBossAverages[comparisonKey] || 0
        stats.vsClusterAvg = clusterAvg > 0 ? ((stats.avgDamage / clusterAvg) - 1) * 100 : 0
        
        // Calculate vs guild average
        const guildAvg = guildBossAverages[comparisonKey] || 0
        stats.vsGuildAvg = guildAvg > 0 ? ((stats.avgDamage / guildAvg) - 1) * 100 : 0
      })

      // Calculate averages and comparisons for primes using the proper key format
      Object.keys(primeStats).forEach(boss => {
        const stats = primeStats[boss]
        stats.avgDamage = stats.tokens > 0 ? stats.damage / stats.tokens : 0
        
        // For comparison, we need to find the correct boss rank for this player's data
        const playerPrimeData = battleData.filter(d => d.Name === boss && d.encounterId > 0)
        const mostCommonRank = playerPrimeData.length > 0 ? playerPrimeData[0].overallTokenUseage || '0' : '0'
        const comparisonKey = `${boss}_${mostCommonRank}`
        
        // Calculate vs cluster average
        const clusterAvg = clusterPrimeAverages[comparisonKey] || 0
        stats.vsClusterAvg = clusterAvg > 0 ? ((stats.avgDamage / clusterAvg) - 1) * 100 : 0
        
        // Calculate vs guild average
        const guildAvg = guildPrimeAverages[comparisonKey] || 0
        stats.vsGuildAvg = guildAvg > 0 ? ((stats.avgDamage / guildAvg) - 1) * 100 : 0
      })

      // Historical tokens by season
      const historicalTokens: {[key: string]: number} = {}
      pastSeasons.forEach(season => {
        const seasonData = historicalData?.filter(d => d.Season === season && d.damageType === 'Battle') || []
        historicalTokens[season] = seasonData.length
      })

      // Calculate vs averages
      const vsClusterAvg = clusterAverage > 0 ? ((avgDamagePerHit / clusterAverage) - 1) * 100 : 0
      const vsGuildAvg = guildAverage > 0 ? ((avgDamagePerHit / guildAverage) - 1) * 100 : 0

      const finalStats = {
        totalDamage,
        avgDamagePerHit,
        tokensUsed,
        bombsUsed,
        vsClusterAvg,
        vsGuildAvg,
        bossStats,
        primeStats,
        historicalTokens
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
    <div className="container-modern py-8 space-y-8 animate-fade-in">
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
      <div className="card-modern p-6 hover-lift">
        <label htmlFor="player-search-input" className="block text-sm font-semibold text-secondary mb-3">
          🔍 Search Player
        </label>
        <input
          id="player-search-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Type player name to search..."
          className="input-modern w-full text-base mb-4"
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
        <div className="space-y-8 animate-slide-up">
          {/* Overview Stats */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📊 Season Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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

          {/* Performance Comparison */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📈 Performance vs Averages
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 card-modern hover-lift">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-secondary">vs Cluster Average</span>
                  <span className={`badge ${getPerformanceBadge(playerStats.vsClusterAvg)}`}>
                    {playerStats.vsClusterAvg > 0 ? '+' : ''}{playerStats.vsClusterAvg.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-secondary mt-2">
                  Cluster Avg: {(clusterAvg / 1000).toFixed(0)}K per hit
                </div>
              </div>

              <div className="p-6 card-modern hover-lift">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-secondary">vs Guild Average</span>
                  <span className={`badge ${getPerformanceBadge(playerStats.vsGuildAvg)}`}>
                    {playerStats.vsGuildAvg > 0 ? '+' : ''}{playerStats.vsGuildAvg.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-secondary mt-2">
                  Guild Avg: {(guildAvg / 1000).toFixed(0)}K per hit
                </div>
              </div>
            </div>
          </div>

          {/* Historical Activity */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📅 Historical Token Usage (Past 5 Seasons)
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

          {/* Boss Performance */}
          {Object.keys(playerStats.bossStats).length > 0 && (
            <div className="card-elevated p-8">
              <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
                ⚔️ Boss Performance (Main Bosses)
              </h3>
              <div className="space-y-4">
                {Object.entries(playerStats.bossStats)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([boss, stats]) => (
                    <div key={boss} className="p-4 card-modern hover-lift">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-primary">{boss}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-secondary">
                            {stats.tokens} tokens
                          </span>
                          <span className="stat-display accent-warning">
                            {(stats.avgDamage / 1000).toFixed(0)}K avg
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-secondary">
                        <div>
                          <div className="font-medium">Biggest Hit:</div>
                          <div className="accent-red">{(stats.biggestHit / 1000000).toFixed(2)}M</div>
                        </div>
                        <div>
                          <div className="font-medium">vs Cluster Avg:</div>
                          <div className={`${getPerformanceColor(stats.vsClusterAvg)}`}>
                            {stats.vsClusterAvg > 0 ? '+' : ''}{stats.vsClusterAvg.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">vs Guild Avg:</div>
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
            <div className="card-elevated p-8">
              <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
                🎯 Prime Performance (Side Bosses)
              </h3>
              <div className="space-y-4">
                {Object.entries(playerStats.primeStats)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([boss, stats]) => (
                    <div key={boss} className="p-4 card-modern hover-lift">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-primary">{boss} (Prime)</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-secondary">
                            {stats.tokens} tokens
                          </span>
                          <span className="stat-display accent-purple">
                            {(stats.avgDamage / 1000).toFixed(0)}K avg
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-secondary">
                        <div>
                          <div className="font-medium">Biggest Hit:</div>
                          <div className="accent-red">{(stats.biggestHit / 1000000).toFixed(2)}M</div>
                        </div>
                        <div>
                          <div className="font-medium">vs Cluster Avg:</div>
                          <div className={`${getPerformanceColor(stats.vsClusterAvg)}`}>
                            {stats.vsClusterAvg > 0 ? '+' : ''}{stats.vsClusterAvg.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">vs Guild Avg:</div>
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

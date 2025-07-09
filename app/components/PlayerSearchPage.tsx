'use client'

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
  bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number}}
  historicalTokens: {[key: string]: number}
}

interface PlayerData {
  displayName: string
  damageDealt: number
  damageType: string
  Name: string
  Season: string
  encounterId: number
  loopIndex: number
  tier: number
  remainingHp: number
}

// Helper function to identify last hits
const isLastHit = (entry: PlayerData, allData: PlayerData[]) => {
  const sameEncounterData = allData.filter(d => 
    d.loopIndex === entry.loopIndex &&
    d.Name === entry.Name &&
    d.tier === entry.tier &&
    d.Season === entry.Season
  )
  
  const minRemainingHp = Math.min(...sameEncounterData.map(d => d.remainingHp || 0))
  
  return entry.remainingHp === minRemainingHp && entry.damageType === 'Battle'
}

export default function PlayerSearchPage({ selectedGuild, selectedSeason }: PlayerSearchPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [clusterAvg, setClusterAvg] = useState(0)
  const [guildAvg, setGuildAvg] = useState(0)

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
      .eq('Guild', selectedGuild)       // Filter by selected guild
      .eq('Season', selectedSeason)     // Filter by selected season
      .neq('displayName', null)

    if (error) {
      console.error('Error fetching players:', error)
      return
    }

    if (data) {
      const players = [...new Set(data.map(d => d.displayName))].sort()
      setAvailablePlayers(players)
    }
  }

  const fetchPlayerStats = async () => {
    if (!selectedPlayer || !selectedGuild || !selectedSeason) return
    
    setLoading(true)

    // Get player data for current season and guild
    const { data: playerData, error: playerError } = await supabase
      .from('EOT_GR_data')
      .select('*')
      .eq('Guild', selectedGuild)       // Filter by selected guild
      .eq('Season', selectedSeason)     // Filter by selected season
      .eq('displayName', selectedPlayer)

    // Get cluster data for averages (SAME SEASON ONLY)
const { data: clusterData, error: clusterError } = await supabase
  .from('EOT_GR_data')
  .select('damageDealt, damageType, loopIndex, Name, tier, Season, remainingHp')
  .eq('Season', selectedSeason)
  .eq('damageType', 'Battle')
  .eq('rarity', 'Legendary')     // ✅ ADD THIS LINE
  .gte('tier', 4)                // ✅ ADD THIS LINE

    // Get guild data for averages (SAME SEASON AND GUILD)
const { data: guildData, error: guildError } = await supabase
  .from('EOT_GR_data')
  .select('damageDealt, damageType, loopIndex, Name, tier, Season, remainingHp')
  .eq('Guild', selectedGuild)
  .eq('Season', selectedSeason)
  .eq('damageType', 'Battle')
  .eq('rarity', 'Legendary')     // ✅ ADD THIS LINE
  .gte('tier', 4)                // ✅ ADD THIS LINE

    if (playerError || clusterError || guildError) {
      console.error('Error fetching data:', playerError || clusterError || guildError)
      setLoading(false)
      return
    }

    // Get historical data (last 5 seasons)
    const currentSeasonNum = parseInt(selectedSeason)
    const historicalSeasons = Array.from({length: 5}, (_, i) => (currentSeasonNum - i).toString())
    
    const { data: historicalData } = await supabase
      .from('EOT_GR_data')
      .select('Season, damageType')
      .eq('Guild', selectedGuild)
      .eq('displayName', selectedPlayer)
      .in('Season', historicalSeasons)

    if (playerData && clusterData && guildData) {
      // Filter out last hits
      const playerBattles = playerData.filter(d => 
        d.damageType === 'Battle' && !isLastHit(d, playerData)
      )
      const playerBombs = playerData.filter(d => d.damageType === 'Bomb')
      
      const clusterFiltered = clusterData.filter(d => !isLastHit(d, clusterData))
      const guildFiltered = guildData.filter(d => !isLastHit(d, guildData))

      // Calculate cluster and guild averages
      const clusterAverage = clusterFiltered.length > 0 ? 
        clusterFiltered.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / clusterFiltered.length : 0
      const guildAverage = guildFiltered.length > 0 ? 
        guildFiltered.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / guildFiltered.length : 0

      setClusterAvg(clusterAverage)
      setGuildAvg(guildAverage)

      // Calculate player stats
      const totalDamage = playerBattles.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const avgDamagePerHit = playerBattles.length > 0 ? totalDamage / playerBattles.length : 0
      const tokensUsed = playerBattles.length
      const bombsUsed = playerBombs.length

      // Boss-specific stats
      const bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number}} = {}
      
      playerBattles.forEach(d => {
        const bossKey = d.encounterId === 0 ? d.Name : `${d.Name} (Prime)`
        if (!bossStats[bossKey]) {
          bossStats[bossKey] = { damage: 0, tokens: 0, avgDamage: 0 }
        }
        bossStats[bossKey].damage += d.damageDealt || 0
        bossStats[bossKey].tokens += 1
      })

      // Calculate boss averages
      Object.keys(bossStats).forEach(boss => {
        bossStats[boss].avgDamage = bossStats[boss].tokens > 0 ? 
          bossStats[boss].damage / bossStats[boss].tokens : 0
      })

      // Historical tokens by season
      const historicalTokens: {[key: string]: number} = {}
      historicalSeasons.forEach(season => {
        const seasonData = historicalData?.filter(d => d.Season === season && d.damageType === 'Battle') || []
        historicalTokens[season] = seasonData.length
      })

      // Calculate vs averages
      const vsClusterAvg = clusterAverage > 0 ? ((avgDamagePerHit / clusterAverage) - 1) * 100 : 0
      const vsGuildAvg = guildAverage > 0 ? ((avgDamagePerHit / guildAverage) - 1) * 100 : 0

      setPlayerStats({
        totalDamage,
        avgDamagePerHit,
        tokensUsed,
        bombsUsed,
        vsClusterAvg,
        vsGuildAvg,
        bossStats,
        historicalTokens
      })
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
          name="player-search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Type player name to search..."
          className="input-modern w-full text-base mb-4"
          aria-label="Search for a player by name"
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
                <div className="stat-display accent-primary">
                  {(playerStats.totalDamage / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-muted font-medium mt-1">Total Damage</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="stat-display accent-success">
                  {(playerStats.avgDamagePerHit / 1000000).toFixed(2)}M
                </div>
                <div className="text-sm text-muted font-medium mt-1">Avg per Hit</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="stat-display accent-purple">
                  {playerStats.tokensUsed}
                </div>
                <div className="text-sm text-muted font-medium mt-1">Tokens Used</div>
              </div>
              <div className="text-center p-4 card-modern hover-lift">
                <div className="stat-display accent-danger">
                  {playerStats.bombsUsed}
                </div>
                <div className="text-sm text-muted font-medium mt-1">Bombs Used</div>
              </div>
            </div>
          </div>

          {/* Performance vs Averages */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📈 Performance Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`p-6 rounded-xl border-2 ${getPerformanceBadge(playerStats.vsClusterAvg)} hover-lift`}>
                <div className="text-center">
                  <div className={`stat-large ${getPerformanceColor(playerStats.vsClusterAvg)}`}>
                    {playerStats.vsClusterAvg >= 0 ? '+' : ''}{playerStats.vsClusterAvg.toFixed(1)}%
                  </div>
                  <div className="text-sm text-secondary font-semibold mt-2">vs Cluster Average</div>
                  <div className="text-xs text-muted font-mono mt-1">
                    Baseline: {(clusterAvg / 1000000).toFixed(2)}M
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl border-2 ${getPerformanceBadge(playerStats.vsGuildAvg)} hover-lift`}>
                <div className="text-center">
                  <div className={`stat-large ${getPerformanceColor(playerStats.vsGuildAvg)}`}>
                    {playerStats.vsGuildAvg >= 0 ? '+' : ''}{playerStats.vsGuildAvg.toFixed(1)}%
                  </div>
                  <div className="text-sm text-secondary font-semibold mt-2">vs Guild Average</div>
                  <div className="text-xs text-muted font-mono mt-1">
                    Baseline: {(guildAvg / 1000000).toFixed(2)}M
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Boss Performance */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              🎯 Boss Performance Breakdown
            </h3>
            <div className="space-y-4">
              {Object.entries(playerStats.bossStats)
                .sort((a, b) => b[1].avgDamage - a[1].avgDamage)
                .map(([boss, stats]) => (
                  <div key={boss} className="card-modern p-4 hover-lift transition-all duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-primary">{boss}</span>
                      <span className="stat-display accent-warning text-lg">
                        {(stats.avgDamage / 1000000).toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-secondary font-medium mb-2">
                      <span>⚔️ {stats.tokens} attacks</span>
                      <span>💀 {(stats.damage / 1000000).toFixed(1)}M total</span>
                    </div>
                    <div className="progress-modern">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(stats.avgDamage / Math.max(...Object.values(playerStats.bossStats).map(b => b.avgDamage))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Historical Token Usage */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📅 Historical Performance
            </h3>
            <div className="space-y-4">
              {Object.entries(playerStats.historicalTokens)
                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                .map(([season, tokens]) => (
                  <div key={season} className="flex justify-between items-center p-4 card-modern hover-lift">
                    <span className="font-semibold text-secondary">Season {season}</span>
                    <div className="flex items-center space-x-4">
                      <span className="stat-display accent-cyan text-lg">{tokens}</span>
                      <div className="w-32 progress-modern">
                        <div 
                          className="progress-fill-success"
                          style={{ 
                            width: `${Math.min((tokens / Math.max(...Object.values(playerStats.historicalTokens))) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
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
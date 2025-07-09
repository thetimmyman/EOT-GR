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
      .eq('Guild', selectedGuild)
      .eq('Season', selectedSeason)
      .neq('displayName', null)
      // Remove the filters that are preventing players from showing up
      .limit(10000) // Higher limit to get all players

    if (error) {
      console.error('Error fetching players:', error)
      return
    }

    if (data) {
      const uniqueNames = new Set(data.map(d => d.displayName))
      const players = Array.from(uniqueNames).sort()
      console.log('Found players:', players.length) // Debug log
      setAvailablePlayers(players)
    }
  }

  const fetchPlayerStats = async () => {
    if (!selectedPlayer || !selectedGuild || !selectedSeason) return
    
    setLoading(true)
    console.log('Fetching stats for:', selectedPlayer, selectedGuild, selectedSeason)

    try {
      // Get ALL player data for current season and guild (no filtering first)
      const { data: playerData, error: playerError } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('displayName', selectedPlayer)
        .limit(10000)

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
      }

      // Get cluster data for averages (simplified)
      const { data: clusterData } = await supabase
        .from('EOT_GR_data')
        .select('damageDealt, damageType')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .neq('damageDealt', null)
        .limit(10000)

      // Get guild data for averages (simplified)
      const { data: guildData } = await supabase
        .from('EOT_GR_data')
        .select('damageDealt, damageType')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .neq('damageDealt', null)
        .limit(10000)

      // Calculate cluster and guild averages
      const clusterHits = clusterData?.filter(d => d.damageDealt > 0) || []
      const clusterAverage = clusterHits.length > 0 ? 
        clusterHits.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / clusterHits.length : 0
      setClusterAvg(clusterAverage)

      const guildHits = guildData?.filter(d => d.damageDealt > 0) || []
      const guildAverage = guildHits.length > 0 ? 
        guildHits.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / guildHits.length : 0
      setGuildAvg(guildAverage)

      console.log('Averages - Cluster:', clusterAverage, 'Guild:', guildAverage)

      // Calculate player stats from ALL their data
      const battleData = playerData.filter(d => d.damageType === 'Battle')
      const bombData = playerData.filter(d => d.damageType === 'Bomb')
      
      const totalDamage = playerData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const tokensUsed = battleData.length
      const bombsUsed = bombData.length
      const avgDamagePerHit = tokensUsed > 0 ? totalDamage / tokensUsed : 0

      console.log('Player stats:', { totalDamage, tokensUsed, bombsUsed, avgDamagePerHit })

      // Boss-specific stats (simplified)
      const bossStats: {[key: string]: {damage: number, tokens: number, avgDamage: number}} = {}
      battleData.forEach(d => {
        const bossKey = d.Name || 'Unknown'
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

      // Simplified historical data (just current season for now)
      const historicalTokens: {[key: string]: number} = {}
      historicalTokens[selectedSeason] = tokensUsed

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
                <div className="progress-modern">
                  <div 
                    className={`progress-fill ${playerStats.vsClusterAvg >= 0 ? 'progress-fill-success' : 'progress-fill-danger'}`}
                    style={{ 
                      width: `${Math.min(Math.abs(playerStats.vsClusterAvg), 50)}%` 
                    }}
                  />
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
                <div className="progress-modern">
                  <div 
                    className={`progress-fill ${playerStats.vsGuildAvg >= 0 ? 'progress-fill-success' : 'progress-fill-danger'}`}
                    style={{ 
                      width: `${Math.min(Math.abs(playerStats.vsGuildAvg), 50)}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-secondary mt-2">
                  Guild Avg: {(guildAvg / 1000).toFixed(0)}K per hit
                </div>
              </div>
            </div>
          </div>

          {/* Boss Performance */}
          {Object.keys(playerStats.bossStats).length > 0 && (
            <div className="card-elevated p-8">
              <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
                ⚔️ Boss Performance
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
                      <div className="progress-modern">
                        <div 
                          className="progress-fill-gradient"
                          style={{ 
                            width: `${(stats.damage / Math.max(...Object.values(playerStats.bossStats).map(s => s.damage))) * 100}%` 
                          }}
                        />
                      </div>
                      <div className="text-xs text-secondary mt-2">
                        Total: {(stats.damage / 1000000).toFixed(2)}M damage
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Historical Activity */}
          <div className="card-elevated p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              📅 Historical Token Usage
            </h3>
            <div className="space-y-4">
              {Object.entries(playerStats.historicalTokens)
                .sort(([a], [b]) => b.localeCompare(a))
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

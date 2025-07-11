'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cache, CACHE_TTL } from '../lib/cache'

interface TokenUsagePageProps {
  selectedGuild: string
  selectedSeason: string
}

interface PlayerTokens {
  displayName: string
  totalTokens: number
  bossTokens: number
  primeTokens: number
  avgTokensPerLoop: number
  efficiency: number
  historicalAvg?: number
}

interface BossTokenData {
  bossName: string
  tokenCount: number
  percentage: number
  color: string
}

export default function TokenUsagePage({ selectedGuild, selectedSeason }: TokenUsagePageProps) {
  const [players, setPlayers] = useState<PlayerTokens[]>([])
  const [bossDistribution, setBossDistribution] = useState<BossTokenData[]>([])
  const [totalStats, setTotalStats] = useState({
    totalTokens: 0,
    maxTokens: 0,
    averageUsage: 0
  })
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'total' | 'efficiency' | 'avgPerLoop' | 'historical'>('total')

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchTokenUsage()
    }
  }, [selectedGuild, selectedSeason])

  const fetchTokenUsage = async () => {
    setLoading(true)
    
    try {
      // Get current season data
      const { data: battleData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')     
        .gte('tier', 4)                

      // Get historical data for past 5 completed seasons
      const currentSeasonNum = parseInt(selectedSeason)
      const past5Seasons = Array.from({ length: 5 }, (_, i) => (currentSeasonNum - 1 - i).toString())
      
      const { data: historicalData } = await supabase
        .from('EOT_GR_data')
        .select('displayName, Season, damageType, rarity, tier')
        .eq('Guild', selectedGuild)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')     
        .gte('tier', 4)                
        .in('Season', past5Seasons)

      if (battleData) {
        // Calculate current season player token usage
        const playerStats: {[key: string]: {
          tokens: number, 
          bossTokens: number, 
          primeTokens: number,
          totalDamage: number,
          loops: Set<number>
        }} = {}
        
        const bossTokens: {[key: string]: number} = {}
        let totalTokensUsed = 0

        battleData.forEach(d => {
          const player = d.displayName
          const boss = d.Name || 'Unknown'
          const isMainBoss = d.encounterId === 0
          const isPrime = d.encounterId > 0
          
          if (!playerStats[player]) {
            playerStats[player] = { 
              tokens: 0, 
              bossTokens: 0, 
              primeTokens: 0, 
              totalDamage: 0,
              loops: new Set()
            }
          }
          
          playerStats[player].tokens += 1
          playerStats[player].totalDamage += d.damageDealt || 0
          playerStats[player].loops.add(d.loopIndex || 0)
          
          if (isMainBoss) {
            playerStats[player].bossTokens += 1
          } else if (isPrime) {
            playerStats[player].primeTokens += 1
          }
          
          // Boss distribution
          const bossKey = isMainBoss ? boss : 'Primes'
          bossTokens[bossKey] = (bossTokens[bossKey] || 0) + 1
          totalTokensUsed += 1
        })

        // Calculate historical averages (only for players who participated in all 5 seasons)
        const historicalStats: {[player: string]: {[season: string]: number}} = {}
        
        if (historicalData) {
          historicalData.forEach(d => {
            const player = d.displayName
            const season = d.Season
            
            if (!historicalStats[player]) {
              historicalStats[player] = {}
            }
            
            if (!historicalStats[player][season]) {
              historicalStats[player][season] = 0
            }
            
            historicalStats[player][season] += 1
          })
        }

        // Calculate historical averages for players with all 5 seasons
        const playerHistoricalAvgs: {[player: string]: number} = {}
        Object.entries(historicalStats).forEach(([player, seasons]) => {
          const seasonsPlayed = Object.keys(seasons)
          const totalTokens = Object.values(seasons).reduce((sum, tokens) => sum + tokens, 0)
          
          if (seasonsPlayed.length === 5) { // Only if participated in all 5 seasons
            playerHistoricalAvgs[player] = totalTokens / 5
          }
        })

        // Convert to array and calculate efficiency
        const playersArray = Object.entries(playerStats).map(([name, stats]) => {
          const avgTokensPerLoop = stats.loops.size > 0 ? stats.tokens / stats.loops.size : 0
          const efficiency = stats.tokens > 0 ? stats.totalDamage / stats.tokens : 0
          
          return {
            displayName: name,
            totalTokens: stats.tokens,
            bossTokens: stats.bossTokens,
            primeTokens: stats.primeTokens,
            avgTokensPerLoop,
            efficiency,
            historicalAvg: playerHistoricalAvgs[name]
          }
        })

        // Boss distribution with colors
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16']
        const bossDistArray = Object.entries(bossTokens)
          .map(([boss, count], index) => ({
            bossName: boss,
            tokenCount: count,
            percentage: (count / totalTokensUsed) * 100,
            color: colors[index % colors.length]
          }))
          .sort((a, b) => b.tokenCount - a.tokenCount)

        const maxTokens = Math.max(...playersArray.map(p => p.totalTokens))
        const avgUsage = totalTokensUsed / playersArray.length

        setPlayers(playersArray)
        setBossDistribution(bossDistArray)
        setTotalStats({
          totalTokens: totalTokensUsed,
          maxTokens,
          averageUsage: avgUsage
        })
      }
      
    } catch (error) {
      console.error('Error in fetchTokenUsage:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSortedPlayers = () => {
    return [...players].sort((a, b) => {
      switch (sortBy) {
        case 'efficiency':
          return b.efficiency - a.efficiency
        case 'avgPerLoop':
          return b.avgTokensPerLoop - a.avgTokensPerLoop
        case 'historical':
          // Sort by historical average, but put players without historical data at the end
          if (a.historicalAvg && b.historicalAvg) {
            return b.historicalAvg - a.historicalAvg
          } else if (a.historicalAvg && !b.historicalAvg) {
            return -1
          } else if (!a.historicalAvg && b.historicalAvg) {
            return 1
          } else {
            return b.totalTokens - a.totalTokens
          }
        case 'total':
        default:
          return b.totalTokens - a.totalTokens
      }
    })
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="spinner-modern"></div></div>
  }

  const sortedPlayers = getSortedPlayers()
  const playersWithHistorical = players.filter(p => p.historicalAvg !== undefined)

  return (
    <div className="container-modern py-6 space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card-wh40k">
          <div className="stat-value-wh40k">{totalStats.totalTokens.toLocaleString()}</div>
          <div className="stat-label-wh40k">Total Tokens</div>
        </div>
        <div className="stat-card-wh40k">
          <div className="stat-value-wh40k">{totalStats.maxTokens.toLocaleString()}</div>
          <div className="stat-label-wh40k">Max by Player</div>
        </div>
        <div className="stat-card-wh40k">
          <div className="stat-value-wh40k">{totalStats.averageUsage.toFixed(1)}</div>
          <div className="stat-label-wh40k">Average Usage</div>
        </div>
        <div className="stat-card-wh40k">
          <div className="stat-value-wh40k">{playersWithHistorical.length}</div>
          <div className="stat-label-wh40k">5-Season Veterans</div>
        </div>
      </div>


      {/* Boss Token Distribution */}
      <div className="card-wh40k p-4">
        <h3 className="heading-wh40k">Boss Token Distribution</h3>
        
        {/* Pie Chart Representation */}
        <div className="mb-4">
          <div className="flex h-4 rounded-full overflow-hidden">
            {bossDistribution.map((boss) => (
              <div
                key={boss.bossName}
                style={{ 
                  width: `${boss.percentage}%`, 
                  backgroundColor: boss.color 
                }}
                className="h-full"
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {bossDistribution.slice(0, 6).map((boss) => (
            <div key={boss.bossName} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: boss.color }}
              />
              <span className="truncate text-xs text-primary-wh40k">
                {boss.bossName.replace(/^L\d\s/, '')}: {boss.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Player Controls */}
      <div className="card-wh40k p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Sort Options */}
          <label htmlFor="sort-select" className="sr-only">Sort players by</label>
          <select
            id="sort-select"
            name="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'total' | 'efficiency' | 'avgPerLoop' | 'historical')}
            className="input-wh40k text-sm"
            aria-label="Sort players by different criteria"
          >
            <option value="total">Sort by Total Tokens</option>
            <option value="efficiency">Sort by Efficiency</option>
            <option value="avgPerLoop">Sort by Avg/Loop</option>
            <option value="historical">Sort by Historical Average</option>
          </select>
        </div>

        <h3 className="heading-wh40k">
          Token Usage by Player
        </h3>
        
        {/* Vertical Bar Chart for Token Usage */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {sortedPlayers.map((player, index) => {
            const maxTokens = Math.max(...players.map(p => p.totalTokens))
            const barHeight = (player.totalTokens / maxTokens) * 100
            
            return (
              <div key={player.displayName} className="flex-shrink-0 text-center" style={{ width: '60px' }}>
                <div className="h-48 flex flex-col justify-end mb-1">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-1000 ease-out flex flex-col justify-end items-center"
                    style={{ height: `${barHeight}%`, minHeight: '20px' }}
                  >
                    <span className="text-white text-xs font-bold">{player.totalTokens}</span>
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-medium text-slate-300 truncate" title={player.displayName}>
                    {player.displayName.length > 8 ? player.displayName.substring(0, 8) + '...' : player.displayName}
                  </div>
                  <div className="text-slate-400 text-xs">#{index + 1}</div>
                  {player.historicalAvg && (
                    <div className="text-yellow-400" style={{ fontSize: '10px' }}>5-vet</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Historical Average Chart - Vertical Bars */}
      {playersWithHistorical.length > 0 && (
        <div className="card-wh40k p-4">
          <h3 className="heading-wh40k">Historical Token Usage (5-Season Average)</h3>
          <p className="text-xs text-secondary-wh40k mb-4">
            Only showing players who participated in all of the past 5 completed seasons
          </p>
          
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {playersWithHistorical
              .sort((a, b) => (b.historicalAvg || 0) - (a.historicalAvg || 0))
              .map((player, index) => {
                const maxHistorical = Math.max(...playersWithHistorical.map(p => p.historicalAvg || 0))
                const barHeight = ((player.historicalAvg || 0) / maxHistorical) * 100
                
                return (
                  <div key={player.displayName} className="flex-shrink-0 text-center" style={{ width: '60px' }}>
                    <div className="h-48 flex flex-col justify-end mb-1">
                      <div 
                        className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t transition-all duration-1000 ease-out flex flex-col justify-end items-center"
                        style={{ height: `${barHeight}%`, minHeight: '20px' }}
                      >
                        <span className="text-white text-xs font-bold">{player.historicalAvg?.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium text-slate-300 truncate" title={player.displayName}>
                        {player.displayName.length > 8 ? player.displayName.substring(0, 8) + '...' : player.displayName}
                      </div>
                      <div className="text-slate-400" style={{ fontSize: '10px' }}>
                        Now: {player.totalTokens}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Token Usage Statistics */}
      <div className="card-wh40k p-4">
        <h3 className="heading-wh40k">Token Usage Statistics</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-primary-wh40k">Active Players</div>
            <div className="text-2xl font-bold text-accent-wh40k">{players.length}</div>
          </div>
          <div>
            <div className="font-medium text-primary-wh40k">Avg Tokens/Player</div>
            <div className="text-2xl font-bold text-accent-wh40k">{(totalStats.totalTokens / players.length).toFixed(1)}</div>
          </div>
        </div>

        {/* Token Distribution Summary */}
        <div className="mt-4 pt-4 border-t border-primary-wh40k">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-primary-wh40k">Players with 28+ tokens:</span>
              <span className="font-mono text-accent-wh40k">{players.filter(p => p.totalTokens >= 28).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-wh40k">Players with 20-27 tokens:</span>
              <span className="font-mono text-accent-wh40k">{players.filter(p => p.totalTokens >= 20 && p.totalTokens < 28).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-wh40k">Players with &lt;20 tokens:</span>
              <span className="font-mono text-accent-wh40k">{players.filter(p => p.totalTokens < 20).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-wh40k">5-season veterans:</span>
              <span className="font-mono text-accent-wh40k">{playersWithHistorical.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
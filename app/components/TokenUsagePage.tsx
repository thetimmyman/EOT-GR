'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
    
    // Get current season data
const { data: battleData } = await supabase
  .from('EOT_GR_data')
  .select('*')
  .eq('Guild', selectedGuild)
  .eq('Season', selectedSeason)
  .eq('damageType', 'Battle')
  .eq('rarity', 'Legendary')     // ✅ ADD THIS LINE
  .gte('tier', 4)                // ✅ ADD THIS LINE

    // Get historical data for past 5 completed seasons
    const currentSeasonNum = parseInt(selectedSeason)
    const past5Seasons = Array.from({ length: 5 }, (_, i) => (currentSeasonNum - 1 - i).toString())
    
const { data: historicalData } = await supabase
  .from('EOT_GR_data')
  .select('displayName, Season, damageType')
  .eq('Guild', selectedGuild)
  .eq('damageType', 'Battle')
  .eq('rarity', 'Legendary')     // ✅ ADD THIS LINE
  .gte('tier', 4)                // ✅ ADD THIS LINE
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
        if (seasonsPlayed.length === 5) { // Only if participated in all 5 seasons
          const totalTokens = Object.values(seasons).reduce((sum, tokens) => sum + tokens, 0)
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
    
    setLoading(false)
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
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  const sortedPlayers = getSortedPlayers()
  const playersWithHistorical = players.filter(p => p.historicalAvg !== undefined)

  return (
    <div className="p-4 space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-blue-600">{totalStats.totalTokens}</div>
          <div className="text-xs text-gray-600">Total Tokens</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-green-600">{totalStats.maxTokens}</div>
          <div className="text-xs text-gray-600">Max by Player</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-purple-600">{totalStats.averageUsage.toFixed(1)}</div>
          <div className="text-xs text-gray-600">Average Usage</div>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-orange-600">{playersWithHistorical.length}</div>
          <div className="text-xs text-gray-600">5-Season Veterans</div>
        </div>
      </div>

      {/* Historical Average Chart */}
      {playersWithHistorical.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-4">Historical Token Usage (5-Season Average)</h3>
          <p className="text-xs text-gray-600 mb-4">
            Only showing players who participated in all of the past 5 completed seasons
          </p>
          
          <div className="space-y-2">
            {playersWithHistorical
              .sort((a, b) => (b.historicalAvg || 0) - (a.historicalAvg || 0))
              .map((player, index) => {
                const maxHistorical = Math.max(...playersWithHistorical.map(p => p.historicalAvg || 0))
                const barWidth = ((player.historicalAvg || 0) / maxHistorical) * 100
                const currentVsHistorical = player.historicalAvg ? 
                  ((player.totalTokens / player.historicalAvg) - 1) * 100 : 0
                
                return (
                  <div key={player.displayName} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{player.displayName}</span>
                      <div className="text-right">
                        <span className="text-sm font-mono">{player.historicalAvg?.toFixed(1)}</span>
                        <span className={`ml-2 text-xs ${
                          currentVsHistorical > 10 ? 'text-green-600' : 
                          currentVsHistorical < -10 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          ({currentVsHistorical > 0 ? '+' : ''}{currentVsHistorical.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Current: {player.totalTokens}</span>
                      <span>5-Season Avg: {player.historicalAvg?.toFixed(1)}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Boss Token Distribution */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-3">Boss Token Distribution</h3>
        
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
              <span className="truncate text-xs">
                {boss.bossName.replace(/^L\d\s/, '')}: {boss.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Player Controls */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Sort Options */}
          <label htmlFor="sort-select" className="sr-only">Sort players by</label>
          <select
            id="sort-select"
            name="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'total' | 'efficiency' | 'avgPerLoop' | 'historical')}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
            aria-label="Sort players by different criteria"
          >
            <option value="total">Sort by Total Tokens</option>
            <option value="efficiency">Sort by Efficiency</option>
            <option value="avgPerLoop">Sort by Avg/Loop</option>
            <option value="historical">Sort by Historical Average</option>
          </select>
        </div>

        <h3 className="font-semibold mb-3">
          Token Usage by Player - All {players.length} Players
        </h3>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedPlayers.map((player, index) => (
            <div key={player.displayName} className="space-y-2 pb-2 border-b border-gray-100 last:border-b-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">#{index + 1}</span>
                  <span className="text-sm">{player.displayName}</span>
                  {player.historicalAvg && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">5-season vet</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono">{player.totalTokens}</span>
                  {sortBy === 'efficiency' && (
                    <div className="text-xs text-gray-500">{(player.efficiency / 1000).toFixed(0)}K/token</div>
                  )}
                  {sortBy === 'avgPerLoop' && (
                    <div className="text-xs text-gray-500">{player.avgTokensPerLoop.toFixed(1)}/loop</div>
                  )}
                  {sortBy === 'historical' && player.historicalAvg && (
                    <div className="text-xs text-gray-500">5-avg: {player.historicalAvg.toFixed(1)}</div>
                  )}
                </div>
              </div>
              
              {/* Token breakdown */}
              <div className="flex space-x-1 h-2 rounded-full overflow-hidden bg-gray-200">
                <div 
                  className="bg-blue-500 h-full"
                  style={{ width: `${(player.bossTokens / player.totalTokens) * 100}%` }}
                />
                <div 
                  className="bg-green-500 h-full"
                  style={{ width: `${(player.primeTokens / player.totalTokens) * 100}%` }}
                />
              </div>
              
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                <div>Boss: {player.bossTokens}</div>
                <div>Prime: {player.primeTokens}</div>
                <div>Efficiency: {(player.efficiency / 1000).toFixed(0)}K</div>
                {player.historicalAvg && (
                  <div>vs Avg: {((player.totalTokens / player.historicalAvg - 1) * 100).toFixed(0)}%</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Token Usage Statistics */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-3">Token Usage Statistics</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Active Players</div>
            <div className="text-2xl font-bold text-blue-600">{players.length}</div>
          </div>
          <div>
            <div className="font-medium">Avg Tokens/Player</div>
            <div className="text-2xl font-bold text-green-600">{(totalStats.totalTokens / players.length).toFixed(1)}</div>
          </div>
        </div>

        {/* Token Distribution Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Players with 28+ tokens:</span>
              <span className="font-mono">{players.filter(p => p.totalTokens >= 28).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Players with 20-27 tokens:</span>
              <span className="font-mono">{players.filter(p => p.totalTokens >= 20 && p.totalTokens < 28).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Players with &lt;20 tokens:</span>
              <span className="font-mono">{players.filter(p => p.totalTokens < 20).length}</span>
            </div>
            <div className="flex justify-between">
              <span>5-season veterans:</span>
              <span className="font-mono">{playersWithHistorical.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
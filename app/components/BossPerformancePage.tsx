'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cache, CACHE_TTL } from '../lib/cache'
import { BOSS_CONFIG, LEVEL_TO_SET, DAMAGE_TYPES, RARITIES, TIER_THRESHOLDS, type BossLevel } from '../lib/config'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, ComposedChart
} from './RechartsWrapper'
import { formatBossName } from '../lib/themeUtils'

// Helper function to format damage values
const formatDamageK = (damage: number): string => {
  const k = damage / 1000
  if (k >= 1000) {
    const formatted = (k / 1000).toFixed(2)
    // Add comma if needed (e.g., 1,234.56M)
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'M'
  }
  return k.toFixed(0) + 'K'
}

interface BossPerformancePageProps {
  selectedGuild: string
  selectedSeason: string
  level: number // 1, 2, 3, 4, 5
}

interface PlayerBossStats {
  displayName: string
  avgDamage: number
  maxHit: number
  totalDamage: number
  tokenCount: number
  efficiency: number
}

interface PrimeStats {
  displayName: string
  avgDamage: number
  totalDamage: number
  tokenCount: number
  maxHit: number
  bossName?: string
}

interface PrimeBossStats {
  bossName: string
  playerStats: PrimeStats[]
}

interface LapTrend {
  lap: number
  avgDamage: number
  tokenCount: number
}

interface TopStats {
  topTotalDamagePlayer: string
  topTotalDamage: number
  biggestHitPlayer: string
  biggestHit: number
  totalBossTokens: number
  totalPrimeTokens: number
  overallAvgDamage: number
}

export default function BossPerformancePage({ selectedGuild, selectedSeason, level }: BossPerformancePageProps) {
  const [playerBossStats, setPlayerBossStats] = useState<PlayerBossStats[]>([])
  const [primeStats, setPrimeStats] = useState<PrimeStats[]>([])
  const [primeBossStats, setPrimeBossStats] = useState<PrimeBossStats[]>([])
  const [lapTrends, setLapTrends] = useState<LapTrend[]>([])
  const [topStats, setTopStats] = useState<TopStats>({
    topTotalDamagePlayer: '',
    topTotalDamage: 0,
    biggestHitPlayer: '',
    biggestHit: 0,
    totalBossTokens: 0,
    totalPrimeTokens: 0,
    overallAvgDamage: 0
  })
  const [loading, setLoading] = useState(true)
  const [bossName, setBossName] = useState('')

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchBossData()
    }
  }, [selectedGuild, selectedSeason, level])

  const fetchBossData = async () => {
    setLoading(true)
    
    if (!selectedGuild || !selectedSeason) {
      setLoading(false)
      return
    }
    
    try {
      // Get boss configuration
      const bossConfig = BOSS_CONFIG[level as BossLevel]
      const currentBossName = bossConfig?.name || `Level ${level} Boss`
      setBossName(currentBossName)

      // Use cache to fetch boss data
      const allData = await cache.getOrFetch(
        'boss_data',
        async () => {
          const { data, error } = await supabase
            .from('EOT_GR_data')
            .select('*')
            .eq('Guild', selectedGuild)
            .eq('Season', selectedSeason)
            .eq('set', LEVEL_TO_SET(level))
            .eq('damageType', DAMAGE_TYPES.BATTLE)
            .eq('rarity', RARITIES.LEGENDARY)
            .gte('tier', TIER_THRESHOLDS.MIN_BOSS_TIER)
            .gt('damageDealt', 0)

          if (error) {
            console.error('Error fetching boss data:', error)
            throw error
          }

          return data || []
        },
        { guild: selectedGuild, season: selectedSeason, level: level },
        CACHE_TTL.BOSS_DATA // Cache for 3 minutes
      )

      if (!allData || allData.length === 0) {
        console.log(`No data found for Level ${level}`)
        setLoading(false)
        return
      }

      console.log(`Found ${allData.length} records for Level ${level}`)

      // Filter out last hits for BOSS data only
      const bossData = allData.filter(d => d.encounterId === 0 && d.remainingHp !== 0)
      // Prime data should NOT filter last hits
      const primeData = allData.filter(d => d.encounterId > 0)
      
      console.log(`Boss data: ${bossData.length} records, Prime data: ${primeData.length} records`)

      // Calculate player boss statistics
      const playerBossMap = new Map<string, {
        totalDamage: number
        hits: number[]
        tokenCount: number
      }>()

      bossData.forEach(entry => {
        const player = entry.displayName
        if (!playerBossMap.has(player)) {
          playerBossMap.set(player, {
            totalDamage: 0,
            hits: [],
            tokenCount: 0
          })
        }
        const stats = playerBossMap.get(player)!
        stats.totalDamage += entry.damageDealt || 0
        stats.hits.push(entry.damageDealt || 0)
        stats.tokenCount += 1
      })

      // Convert to PlayerBossStats array
      const playerBossResults: PlayerBossStats[] = Array.from(playerBossMap.entries())
        .map(([player, data]) => ({
          displayName: player,
          totalDamage: data.totalDamage,
          avgDamage: data.hits.length > 0 ? data.totalDamage / data.hits.length : 0,
          maxHit: data.hits.length > 0 ? Math.max(...data.hits) : 0,
          tokenCount: data.tokenCount,
          efficiency: data.tokenCount > 0 ? data.totalDamage / data.tokenCount : 0
        }))
        .sort((a, b) => b.avgDamage - a.avgDamage) // Sort by average damage, high to low

      setPlayerBossStats(playerBossResults)

      // Calculate prime statistics by boss name
      const primeBossMap = new Map<string, Map<string, {
        totalDamage: number
        hits: number[]
        tokenCount: number
      }>>()
      
      // Also keep overall prime stats
      const primeMap = new Map<string, {
        totalDamage: number
        hits: number[]
        tokenCount: number
      }>()

      primeData.forEach(entry => {
        const player = entry.displayName
        const primeBoss = entry.Name || 'Unknown Prime'
        
        // Per-boss stats
        if (!primeBossMap.has(primeBoss)) {
          primeBossMap.set(primeBoss, new Map())
        }
        const bossMap = primeBossMap.get(primeBoss)!
        
        if (!bossMap.has(player)) {
          bossMap.set(player, {
            totalDamage: 0,
            hits: [],
            tokenCount: 0
          })
        }
        const bossStat = bossMap.get(player)!
        bossStat.totalDamage += entry.damageDealt || 0
        bossStat.hits.push(entry.damageDealt || 0)
        bossStat.tokenCount += 1
        
        // Overall stats
        if (!primeMap.has(player)) {
          primeMap.set(player, {
            totalDamage: 0,
            hits: [],
            tokenCount: 0
          })
        }
        const stats = primeMap.get(player)!
        stats.totalDamage += entry.damageDealt || 0
        stats.hits.push(entry.damageDealt || 0)
        stats.tokenCount += 1
      })

      const primeResults: PrimeStats[] = Array.from(primeMap.entries())
        .map(([player, data]) => ({
          displayName: player,
          avgDamage: data.hits.length > 0 ? data.totalDamage / data.hits.length : 0,
          totalDamage: data.totalDamage,
          maxHit: data.hits.length > 0 ? Math.max(...data.hits) : 0,
          tokenCount: data.tokenCount
        }))
        .sort((a, b) => {
          // Sort by total damage first (highest first)
          if (b.totalDamage !== a.totalDamage) {
            return b.totalDamage - a.totalDamage
          }
          // Tiebreaker: token count (highest first)
          if (b.tokenCount !== a.tokenCount) {
            return b.tokenCount - a.tokenCount
          }
          // Final tiebreaker: alphabetical by name (for consistency)
          return a.displayName.localeCompare(b.displayName)
        })

      setPrimeStats(primeResults)
      
      // Convert prime boss map to array format
      const primeBossResults: PrimeBossStats[] = Array.from(primeBossMap.entries())
        .map(([bossName, playerMap]) => ({
          bossName,
          playerStats: Array.from(playerMap.entries())
            .map(([player, data]) => ({
              displayName: player,
              avgDamage: data.hits.length > 0 ? data.totalDamage / data.hits.length : 0,
              totalDamage: data.totalDamage,
              tokenCount: data.tokenCount,
              maxHit: data.hits.length > 0 ? Math.max(...data.hits) : 0,
              bossName
            }))
            .sort((a, b) => {
              // Sort by average damage first (highest first)
              if (b.avgDamage !== a.avgDamage) {
                return b.avgDamage - a.avgDamage
              }
              // Tiebreaker: token count (highest first)
              if (b.tokenCount !== a.tokenCount) {
                return b.tokenCount - a.tokenCount
              }
              // Final tiebreaker: alphabetical by name (for consistency)
              return a.displayName.localeCompare(b.displayName)
            })
        }))
        .filter(boss => boss.playerStats.length > 0)
        
      setPrimeBossStats(primeBossResults)

      // Calculate lap trends
      const lapMap = new Map<number, {
        totalDamage: number
        tokenCount: number
      }>()

      bossData.forEach(entry => {
        const lap = entry.loopIndex || 0
        if (!lapMap.has(lap)) {
          lapMap.set(lap, { totalDamage: 0, tokenCount: 0 })
        }
        const lapData = lapMap.get(lap)!
        lapData.totalDamage += entry.damageDealt || 0
        lapData.tokenCount += 1
      })

      const lapTrendResults: LapTrend[] = Array.from(lapMap.entries())
        .map(([lap, data]) => ({
          lap: lap + 1, // Display as 1-indexed
          avgDamage: data.tokenCount > 0 ? data.totalDamage / data.tokenCount : 0,
          tokenCount: data.tokenCount
        }))
        .sort((a, b) => a.lap - b.lap)

      setLapTrends(lapTrendResults)

      // Calculate top stats - sort by total damage, not average
      const topTotalDamagePlayer = playerBossResults.length > 0 ? 
        [...playerBossResults].sort((a, b) => b.totalDamage - a.totalDamage)[0] : null
      const biggestHitEntry = bossData.reduce((max, entry) => 
        (entry.damageDealt || 0) > (max.damageDealt || 0) ? entry : max
      , { damageDealt: 0, displayName: '' })

      const overallAvgDamage = allData.length > 0 ? 
        allData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / allData.length : 0

      setTopStats({
        topTotalDamagePlayer: topTotalDamagePlayer?.displayName || '',
        topTotalDamage: topTotalDamagePlayer?.totalDamage || 0,
        biggestHitPlayer: biggestHitEntry?.displayName || '',
        biggestHit: biggestHitEntry?.damageDealt || 0,
        totalBossTokens: bossData.length,
        totalPrimeTokens: primeData.length,
        overallAvgDamage
      })

    } catch (error) {
      console.error('Error in fetchBossData:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-wh40k flex items-center justify-center">
        <div className="text-center card-wh40k p-8">
          <div className="spinner-modern mx-auto"></div>
          <p className="mt-4 text-primary-wh40k font-semibold">Analyzing Level {level} Battle Data...</p>
          <div className="mt-2 text-secondary-wh40k text-sm">Communing with Machine Spirits...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-wh40k text-primary-wh40k relative overflow-hidden">
      <div className="absolute inset-0 pattern-gothic opacity-5"></div>
      <div className="container-modern space-y-6 relative z-10">
        
        {/* Header */}
        <div className="card-wh40k p-4">
          <div className="flex items-center justify-between relative">
            <div className="heraldry-display">⚔️</div>
            <h1 className="heading-wh40k text-2xl">
              L{level} {bossName} Battle Analysis
            </h1>
            <div className="text-right">
              <div className="text-sm text-secondary-wh40k">Campaign {selectedSeason} • {selectedGuild}</div>
              <div className="stat-value-wh40k">{(topStats.overallAvgDamage / 1000).toFixed(0)}K Avg</div>
            </div>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid-wh40k">
          <div className="stat-card-wh40k glow-primary">
            <div className="stat-label-wh40k">Top Total Damage</div>
            <div className="stat-value-wh40k">{(topStats.topTotalDamage / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-secondary-wh40k">{topStats.topTotalDamagePlayer}</div>
          </div>
          <div className="stat-card-wh40k glow-accent">
            <div className="stat-label-wh40k">Top Single Hit</div>
            <div className="stat-value-wh40k text-red-400">{(topStats.biggestHit / 1000000).toFixed(2)}M</div>
            <div className="text-xs text-secondary-wh40k">{topStats.biggestHitPlayer}</div>
          </div>
          <div className="stat-card-wh40k">
            <div className="stat-label-wh40k">Total Boss Tokens</div>
            <div className="stat-value-wh40k">{topStats.totalBossTokens.toLocaleString()}</div>
          </div>
          <div className="stat-card-wh40k">
            <div className="stat-label-wh40k">Total Prime Tokens</div>
            <div className="stat-value-wh40k text-purple-400">{topStats.totalPrimeTokens.toLocaleString()}</div>
          </div>
        </div>

        {/* Player Performance Charts - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Player Average Damage Rankings */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k">Player AVG Boss Damage</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {playerBossStats
                .sort((a, b) => b.avgDamage - a.avgDamage)
                .slice(0, 10) // Show top 10 only
                .map((player, index) => {
                  const maxAvgDamage = Math.max(...playerBossStats.map(p => p.avgDamage))
                  const barWidth = maxAvgDamage > 0 ? (player.avgDamage / maxAvgDamage) * 100 : 0
                  
                  return (
                    <div key={player.displayName} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4">#{index + 1}</span>
                      <span className="text-xs font-medium text-slate-300 w-20 truncate">{player.displayName}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-mono text-blue-400">AVG: {formatDamageK(player.avgDamage)}</span>
                          <span className="mx-1 text-slate-400">•</span>
                          <span className="text-slate-400">Max: {formatDamageK(player.maxHit)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
            {playerBossStats.length > 10 && (
              <div className="text-xs text-slate-400 text-center mt-2">
                Showing top 10 of {playerBossStats.length} players
              </div>
            )}
          </div>

          {/* Player Total Damage Rankings */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k">Total Damage Output Rankings</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {playerBossStats
                .sort((a, b) => b.totalDamage - a.totalDamage)
                .slice(0, 10) // Show top 10 only
                .map((player, index) => {
                  const maxDamage = Math.max(...playerBossStats.map(p => p.totalDamage))
                  const barWidth = maxDamage > 0 ? (player.totalDamage / maxDamage) * 100 : 0
                  
                  return (
                    <div key={player.displayName} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4">#{index + 1}</span>
                      <span className="text-xs font-medium text-slate-300 w-20 truncate">{player.displayName}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-mono text-green-400">Total Damage: {formatDamageK(player.totalDamage)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
            {playerBossStats.length > 10 && (
              <div className="text-xs text-slate-400 text-center mt-2">
                Showing top 10 of {playerBossStats.length} players
              </div>
            )}
          </div>
        </div>

        {/* Average Damage per Loop Trend */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-green-400">AVG Damage per Loop</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={lapTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis 
                dataKey="lap"
                tick={{ fontSize: 12, fill: '#cbd5e1' }}
                axisLine={{ stroke: '#64748b' }}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#cbd5e1' }}
                axisLine={{ stroke: '#64748b' }}
                tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}K`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#cbd5e1' }}
                axisLine={{ stroke: '#64748b' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: 'white'
                }}
                formatter={(value: number, name: string) => [
                  name === 'avgDamage' ? `${(value / 1000).toFixed(0)}K` : value.toLocaleString(),
                  name === 'avgDamage' ? 'Avg Damage' : 'Token Count'
                ]}
              />
              <Legend />
              <Bar yAxisId="right" dataKey="tokenCount" fill="#F59E0B" name="Token Count" opacity={0.7} />
              <Line yAxisId="left" type="monotone" dataKey="avgDamage" stroke="#10B981" strokeWidth={3} name="Avg Damage" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Prime Performance - Individual Boss Charts */}
        {primeBossStats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {primeBossStats.map((primeBoss, bossIndex) => (
              <div key={primeBoss.bossName} className="card-wh40k p-4">
                <h3 className="subheading-wh40k text-purple-400">L{level} {primeBoss.bossName} Performance</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {primeBoss.playerStats
                    .slice(0, 10) // Show top 10 players
                    .map((player, index) => {
                      const maxAvgDamage = Math.max(...primeBoss.playerStats.map(p => p.avgDamage))
                      const barWidth = maxAvgDamage > 0 ? (player.avgDamage / maxAvgDamage) * 100 : 0
                      
                      return (
                        <div key={player.displayName} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-4">#{index + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-slate-300">{player.displayName}</span>
                              <div className="text-right text-center">
                                <div className="text-xs font-mono text-purple-400">{formatDamageK(player.avgDamage)}</div>
                                <div className="text-xs text-slate-400">({player.tokenCount} tokens)</div>
                              </div>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
                {primeBoss.playerStats.length > 10 && (
                  <div className="text-xs text-slate-400 text-center mt-2">
                    Showing top 10 of {primeBoss.playerStats.length} players
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
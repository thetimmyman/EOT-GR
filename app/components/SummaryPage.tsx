'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, BarChart, Bar
} from './RechartsWrapper'

interface SummaryPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface BossAverageData {
  level: string
  bossName: string
  avgDamage: number
  maxHit: number
  tokenCount: number
  sortOrder: number
}

interface PrimeAverageData {
  level: string
  avgDamage: number
  maxHit: number
  tokenCount: number
  sortOrder: number
}

interface LoopTokenData {
  loop: number
  totalTokens: number
  l1Tokens: number
  l2Tokens: number
  l3Tokens: number
  l4Tokens: number
  l5Tokens: number
  primeTokens: number
}

interface BossTokenDistribution {
  name: string
  tokens: number
  percentage: number
  color: string
}

interface SummaryStats {
  completedLoops: number
  totalDamage: number
  totalTokens: number
  lostTokens: number
  maxPlayerTokens: number
  biggestBombPlayer: string
  biggestBombDamage: number
  totalKills: number
  topKillerName: string
}

const LEVEL_ORDER = { 'L5': 1, 'L4': 2, 'L3': 3, 'L2': 4, 'L1': 5 }
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function SummaryPage({ selectedGuild, selectedSeason }: SummaryPageProps) {
  const [bossAverages, setBossAverages] = useState<BossAverageData[]>([])
  const [primeAverages, setPrimeAverages] = useState<PrimeAverageData[]>([])
  const [loopTokenData, setLoopTokenData] = useState<LoopTokenData[]>([])
  const [tokenDistribution, setTokenDistribution] = useState<BossTokenDistribution[]>([])
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    completedLoops: 0,
    totalDamage: 0,
    totalTokens: 0,
    lostTokens: 0,
    maxPlayerTokens: 0,
    biggestBombPlayer: '',
    biggestBombDamage: 0,
    totalKills: 0,
    topKillerName: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchSummaryData()
    }
  }, [selectedGuild, selectedSeason])

  const fetchSummaryData = async () => {
    setLoading(true)
    
    try {
      console.log(`Fetching comprehensive summary for ${selectedGuild} Season ${selectedSeason}`)
      
      // Get all battle data (no last hits, no bombs) - match Token Usage page filter
      const { data: battleData, error: battleError } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

      // Get bomb data
      const { data: bombData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Bomb')

      // Get last hit data (for kills)
      const { data: lastHitData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('remainingHp', 0)

      if (battleError) {
        console.error('Error fetching battle data:', battleError)
        setLoading(false)
        return
      }

      if (!battleData || battleData.length === 0) {
        console.log('No battle data found')
        setLoading(false)
        return
      }

      console.log(`Processing ${battleData.length} battle records`)

      // Calculate basic stats
      const totalDamage = battleData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const totalTokens = battleData.length
      const maxLoop = Math.max(...battleData.map(d => d.loopIndex || 0))
      const completedLoops = maxLoop + 1

      // Calculate player token counts for lost tokens calculation
      const playerTokenCounts = battleData.reduce((acc, battle) => {
        acc[battle.displayName] = (acc[battle.displayName] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const maxPlayerTokens = Math.max(...Object.values(playerTokenCounts) as number[])
      const threshold = maxPlayerTokens - 3
      const lostTokens = (Object.values(playerTokenCounts) as number[]).reduce((total: number, playerTokens: number) => {
        return total + Math.max(0, threshold - playerTokens)
      }, 0)

      // Bomb stats
      let biggestBombPlayer = ''
      let biggestBombDamage = 0
      if (bombData && bombData.length > 0) {
        const maxBomb = bombData.reduce((max, bomb) => 
          (bomb.damageDealt || 0) > (max.damageDealt || 0) ? bomb : max
        )
        biggestBombPlayer = maxBomb.displayName
        biggestBombDamage = maxBomb.damageDealt || 0
      }

      // Kill stats - show max kills per player, not total
      let maxKillsPerPlayer = 0
      let topKillerName = ''
      if (lastHitData && lastHitData.length > 0) {
        const killerCounts = lastHitData.reduce((acc, hit) => {
          acc[hit.displayName] = (acc[hit.displayName] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const topKiller = Object.entries(killerCounts).sort(([, a], [, b]) => (b as number) - (a as number))[0]
        if (topKiller) {
          topKillerName = topKiller[0]
          maxKillsPerPlayer = topKiller[1] as number
        }
      }

      setSummaryStats({
        completedLoops,
        totalDamage,
        totalTokens,
        lostTokens,
        maxPlayerTokens,
        biggestBombPlayer,
        biggestBombDamage,
        totalKills: maxKillsPerPlayer,
        topKillerName
      })

      // Process boss averages (L5 to L1)
      const bossGroups = battleData
        .filter(d => d.encounterId === 0)
        .reduce((acc, battle) => {
          const level = `L${battle.set + 1}`
          const key = `${level}_${battle.Name}`
          
          if (!acc[key]) {
            acc[key] = {
              level,
              bossName: battle.Name,
              damages: [],
              tokenCount: 0,
              maxHit: 0,
              sortOrder: LEVEL_ORDER[level as keyof typeof LEVEL_ORDER] || 6
            }
          }
          
          acc[key].damages.push(battle.damageDealt || 0)
          acc[key].tokenCount += 1
          acc[key].maxHit = Math.max(acc[key].maxHit, battle.damageDealt || 0)
          
          return acc
        }, {} as Record<string, any>)

      const bossAveragesList: BossAverageData[] = Object.values(bossGroups).map((boss: any) => ({
        level: boss.level,
        bossName: boss.bossName,
        avgDamage: boss.damages.length > 0 ? boss.damages.reduce((sum: number, dmg: number) => sum + dmg, 0) / boss.damages.length : 0,
        maxHit: boss.maxHit,
        tokenCount: boss.tokenCount,
        sortOrder: boss.sortOrder
      })).sort((a, b) => a.sortOrder - b.sortOrder)

      setBossAverages(bossAveragesList)

      // Process prime averages (L5 to L1)
      const primeGroups = battleData
        .filter(d => d.encounterId > 0)
        .reduce((acc, battle) => {
          const level = `L${battle.set + 1}`
          
          if (!acc[level]) {
            acc[level] = {
              level,
              damages: [],
              tokenCount: 0,
              maxHit: 0,
              sortOrder: LEVEL_ORDER[level as keyof typeof LEVEL_ORDER] || 6
            }
          }
          
          acc[level].damages.push(battle.damageDealt || 0)
          acc[level].tokenCount += 1
          acc[level].maxHit = Math.max(acc[level].maxHit, battle.damageDealt || 0)
          
          return acc
        }, {} as Record<string, any>)

      const primeAveragesList: PrimeAverageData[] = Object.values(primeGroups).map((prime: any) => ({
        level: prime.level,
        avgDamage: prime.damages.length > 0 ? prime.damages.reduce((sum: number, dmg: number) => sum + dmg, 0) / prime.damages.length : 0,
        maxHit: prime.maxHit,
        tokenCount: prime.tokenCount,
        sortOrder: prime.sortOrder
      })).sort((a, b) => a.sortOrder - b.sortOrder)

      setPrimeAverages(primeAveragesList)

      // Process loop token data
      const loopData: LoopTokenData[] = []
      for (let loop = 0; loop <= maxLoop; loop++) {
        const loopBattles = battleData.filter(d => d.loopIndex === loop)
        
        const loopStats = {
          loop: loop + 1,
          totalTokens: loopBattles.length,
          l1Tokens: loopBattles.filter(d => d.set === 0).length,
          l2Tokens: loopBattles.filter(d => d.set === 1).length,
          l3Tokens: loopBattles.filter(d => d.set === 2).length,
          l4Tokens: loopBattles.filter(d => d.set === 3).length,
          l5Tokens: loopBattles.filter(d => d.set === 4).length,
          primeTokens: loopBattles.filter(d => d.encounterId > 0).length
        }
        
        loopData.push(loopStats)
      }
      setLoopTokenData(loopData)

      // Process token distribution for pie chart
      const tokenCounts = {
        'L5 Magnus': battleData.filter(d => d.set === 4 && d.encounterId === 0).length,
        'L4 Mortarion': battleData.filter(d => d.set === 3 && d.encounterId === 0).length,
        'L3 SilentKing': battleData.filter(d => d.set === 2 && d.encounterId === 0).length,
        'L2 Avatar': battleData.filter(d => d.set === 1 && d.encounterId === 0).length,
        'L1 Ghazghkull': battleData.filter(d => d.set === 0 && d.encounterId === 0).length,
        'Primes': battleData.filter(d => d.encounterId > 0).length
      }

      const tokenDistributionList: BossTokenDistribution[] = Object.entries(tokenCounts)
        .filter(([_, count]) => count > 0)
        .map(([name, tokens], index) => ({
          name,
          tokens,
          percentage: (tokens / totalTokens) * 100,
          color: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.tokens - a.tokens)

      setTokenDistribution(tokenDistributionList)

    } catch (error) {
      console.error('Error in fetchSummaryData:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-wh40k flex items-center justify-center">
        <div className="text-center card-wh40k p-8">
          <div className="spinner-modern mx-auto"></div>
          <p className="mt-4 text-primary-wh40k font-semibold">Loading Legion Battle Summary...</p>
          <div className="mt-2 text-secondary-wh40k text-sm">Accessing Imperial Archives...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-wh40k text-primary-wh40k relative overflow-hidden">
      <div className="absolute inset-0 pattern-scales opacity-5"></div>
      <div className="container-modern space-y-6 relative z-10">
        
        {/* Header - Imperial Command Style */}
        <div className="card-wh40k p-4 glow-primary relative">
          <div className="heraldry-display">⚜️</div>
          <div className="flex items-center justify-between">
            <h1 className="heading-wh40k text-2xl text-glow-accent">
              {selectedGuild} Legion Command - Campaign: {selectedSeason}
            </h1>
            <div className="text-right">
              <div className="stat-label-wh40k">Total Damage</div>
              <div className="stat-value-wh40k">{(summaryStats.totalDamage / 1000000).toFixed(1)}M</div>
            </div>
          </div>
        </div>

        {/* Main Stats Row */}
        <div className="grid-wh40k">
          <div className="stat-card-wh40k">
            <div className="stat-label-wh40k">Completed Loops</div>
            <div className="stat-value-wh40k">{summaryStats.completedLoops}</div>
          </div>
          <div className="stat-card-wh40k glow-primary">
            <div className="stat-label-wh40k">Total Tokens Used</div>
            <div className="stat-value-wh40k">{summaryStats.totalTokens}</div>
          </div>
          <div className="stat-card-wh40k">
            <div className="stat-label-wh40k">Bombs Used</div>
            <div className="stat-value-wh40k text-red-400">93</div>
          </div>
          <div className="stat-card-wh40k">
            <div className="stat-label-wh40k">Wasted Tokens</div>
            <div className="stat-value-wh40k text-yellow-400">{summaryStats.lostTokens}</div>
          </div>
        </div>

        {/* Honors Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-wh40k p-4 border-accent-wh40k glow-accent relative">
            <div className="absolute top-2 right-2 text-2xl">💥</div>
            <div className="text-center">
              <div className="stat-label-wh40k text-yellow-400">Best Bomb</div>
              <div className="stat-value-wh40k">{summaryStats.biggestBombDamage.toLocaleString()}</div>
              <div className="text-sm text-yellow-300">{summaryStats.biggestBombPlayer}</div>
            </div>
          </div>
          <div className="card-wh40k p-4 border-red-500 glow-accent relative">
            <div className="absolute top-2 right-2 text-2xl">💀</div>
            <div className="text-center">
              <div className="stat-label-wh40k text-red-400">Top Killer</div>
              <div className="stat-value-wh40k">{summaryStats.totalKills}</div>
              <div className="text-sm text-red-300">{summaryStats.topKillerName}</div>
            </div>
          </div>
          <div className="card-wh40k p-4 border-purple-500 relative">
            <div className="absolute top-2 right-2 text-2xl">⚡</div>
            <div className="text-center">
              <div className="stat-label-wh40k text-purple-400">Max # of Tokens Used</div>
              <div className="stat-value-wh40k">{summaryStats.maxPlayerTokens}</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Boss Averages */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k">AVG Damage to Bosses</h3>
            <div className="space-y-3">
              {bossAverages.map((boss, index) => {
                const maxAvg = Math.max(...bossAverages.map(b => b.avgDamage))
                const barWidth = (boss.avgDamage / maxAvg) * 100
                
                return (
                  <div key={`${boss.level}-${boss.bossName}`} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-300">{boss.level} {boss.bossName}</span>
                      <span className="text-sm font-mono text-blue-400">{(boss.avgDamage / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-xs text-slate-400">{(boss.maxHit / 1000000).toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Prime Averages */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k text-green-400">AVG Damage to Primes</h3>
            <div className="space-y-3">
              {primeAverages.map((prime, index) => {
                const maxAvg = Math.max(...primeAverages.map(p => p.avgDamage))
                const barWidth = (prime.avgDamage / maxAvg) * 100
                
                return (
                  <div key={prime.level} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-300">{prime.level} Primes</span>
                      <span className="text-sm font-mono text-green-400">{(prime.avgDamage / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-1000 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-xs text-slate-400">{(prime.maxHit / 1000000).toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tokens per Lap - Stacked Bar Chart */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k text-yellow-400">Tokens Per Lap</h3>
            <div className="space-y-3">
              {loopTokenData
                .slice() // Create copy
                .reverse() // Most recent lap at top
                .map((loop, index) => {
                  const maxTotal = Math.max(...loopTokenData.map(l => l.totalTokens))
                  const bossTokens = loop.l1Tokens + loop.l2Tokens + loop.l3Tokens + loop.l4Tokens + loop.l5Tokens
                  const totalBarWidth = maxTotal > 0 ? (loop.totalTokens / maxTotal) * 100 : 0
                  const bossWidth = maxTotal > 0 ? (bossTokens / maxTotal) * 100 : 0
                  const primeWidth = maxTotal > 0 ? (loop.primeTokens / maxTotal) * 100 : 0
                  
                  return (
                    <div key={loop.loop} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-300">Loop {loop.loop}</span>
                        <span className="text-sm font-mono text-yellow-400">{loop.totalTokens} tokens</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-8 overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 absolute left-0 flex items-center justify-center"
                          style={{ width: `${bossWidth}%` }}
                          title={`Boss Tokens: ${bossTokens}`}
                        >
                          {bossTokens > 0 && bossWidth > 15 && (
                            <span className="text-xs font-semibold text-white">Bosses: {bossTokens}</span>
                          )}
                        </div>
                        <div 
                          className="h-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-500 absolute flex items-center justify-center"
                          style={{ 
                            left: `${bossWidth}%`,
                            width: `${primeWidth}%` 
                          }}
                          title={`Prime Tokens: ${loop.primeTokens}`}
                        >
                          {loop.primeTokens > 0 && primeWidth > 15 && (
                            <span className="text-xs font-semibold text-white">Primes: {loop.primeTokens}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

        </div>

        {/* Tokens per Lap Line Chart - Individual Bosses */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-yellow-400">Total Tokens Per Lap Per Boss</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={loopTokenData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis 
                dataKey="loop" 
                tick={{ fontSize: 12, fill: '#cbd5e1' }} 
                axisLine={{ stroke: '#64748b' }}
              />
              <YAxis 
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
              />
              <Legend />
              <Line type="monotone" dataKey="l5Tokens" stroke="#3B82F6" strokeWidth={3} name="L5 Magnus" />
              <Line type="monotone" dataKey="l4Tokens" stroke="#EF4444" strokeWidth={3} name="L4 Mortarion" />
              <Line type="monotone" dataKey="l3Tokens" stroke="#10B981" strokeWidth={3} name="L3 SilentKing" />
              <Line type="monotone" dataKey="l2Tokens" stroke="#F59E0B" strokeWidth={3} name="L2 Avatar" />
              <Line type="monotone" dataKey="l1Tokens" stroke="#8B5CF6" strokeWidth={3} name="L1 Ghazghkull" />
              <Line type="monotone" dataKey="primeTokens" stroke="#EC4899" strokeWidth={3} name="Primes" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Boss Token Cards */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k">Total Boss Tokens</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {tokenDistribution
              .filter(item => !item.name.includes('Primes'))
              .sort((a, b) => {
                // Sort by level L5 -> L1
                const aLevel = parseInt(a.name.match(/L(\d)/)?.[1] || '0')
                const bLevel = parseInt(b.name.match(/L(\d)/)?.[1] || '0')
                return bLevel - aLevel
              })
              .map((boss, index) => (
                <div key={boss.name} className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-xl font-bold text-blue-400 mb-2">{boss.tokens}</div>
                  <div className="text-xs text-slate-300 mb-1">{boss.name}</div>
                  <div className="text-xs text-slate-400">{boss.percentage.toFixed(0)}%</div>
                </div>
              ))}
          </div>
        </div>

        {/* Prime Token Cards */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-pink-400">Total Prime Tokens</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {primeAverages.map((prime, index) => {
              const primeTokens = tokenDistribution.find(item => item.name === 'Primes')?.tokens || 0
              const primePercentage = tokenDistribution.find(item => item.name === 'Primes')?.percentage || 0
              return (
                <div key={prime.level} className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-xl font-bold text-pink-400 mb-2">{Math.round(primeTokens / primeAverages.length)}</div>
                  <div className="text-xs text-slate-300 mb-1">{prime.level} Primes</div>
                  <div className="text-xs text-slate-400">{Math.round(primePercentage / primeAverages.length)}%</div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
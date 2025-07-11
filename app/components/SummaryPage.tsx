'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, BarChart, Bar
} from './RechartsWrapper'
import { formatBossName, calculateLostTokens, calculateClusterAverage } from '../lib/themeUtils'

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
  clusterAvg?: number
  guildAvg?: number
}

interface PrimeAverageData {
  level: string
  avgDamage: number
  maxHit: number
  tokenCount: number
  sortOrder: number
  clusterAvg?: number
  primeNames: string[]
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

interface TierCombinedData {
  tier: string
  combined: number
  bosses: number
  primes: number
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
  totalBombs: number
  totalKills: number
  topKillerName: string
}

const LEVEL_ORDER = { 'L5': 1, 'L4': 2, 'L3': 3, 'L2': 4, 'L1': 5 }
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function SummaryPage({ selectedGuild, selectedSeason }: SummaryPageProps) {
  const [bossAverages, setBossAverages] = useState<BossAverageData[]>([])
  const [primeAverages, setPrimeAverages] = useState<PrimeAverageData[]>([])
  const [loopTokenData, setLoopTokenData] = useState<LoopTokenData[]>([])
  const [tierCombinedData, setTierCombinedData] = useState<TierCombinedData[]>([])
  const [tokenDistribution, setTokenDistribution] = useState<BossTokenDistribution[]>([])
  const [primeTokensByTier, setPrimeTokensByTier] = useState<Record<string, number>>({})
  const [primeTokensByName, setPrimeTokensByName] = useState<Record<string, {count: number, tier: string}>>({})
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    completedLoops: 0,
    totalDamage: 0,
    totalTokens: 0,
    lostTokens: 0,
    maxPlayerTokens: 0,
    biggestBombPlayer: '',
    biggestBombDamage: 0,
    totalBombs: 0,
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
      
      // Get all battle data (INCLUDING last hits for token calculations)
      const { data: battleData, error: battleError } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')
        .gte('tier', 4)
        .gt('damageDealt', 0)

      // Get battle data excluding last hits for averages
      const { data: battleDataNoLastHits } = await supabase
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

      // Get cluster data for comparison
      const { data: clusterData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

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
      const completedLoops = maxLoop // Use MAX loopIndex directly (0-based = 1 loop completed)

      // Calculate player token counts for lost tokens calculation (FIXED)
      const playerTokenCounts = battleData.reduce((acc, battle) => {
        acc[battle.displayName] = (acc[battle.displayName] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const lostTokens = calculateLostTokens(playerTokenCounts)
      const maxPlayerTokens = Math.max(...Object.values(playerTokenCounts) as number[])

      // Bomb stats (FIXED - calculate from actual data)
      let biggestBombPlayer = ''
      let biggestBombDamage = 0
      let totalBombs = 0
      if (bombData && bombData.length > 0) {
        totalBombs = bombData.length
        const maxBomb = bombData.reduce((max, bomb) => 
          (bomb.damageDealt || 0) > (max.damageDealt || 0) ? bomb : max
        )
        biggestBombPlayer = maxBomb.displayName
        biggestBombDamage = maxBomb.damageDealt || 0
      }

      // Kill stats - show max kills per player
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
        totalBombs,
        totalKills: maxKillsPerPlayer,
        topKillerName
      })

      // Process boss averages with cluster comparison (L5 to L1)
      const bossGroups = (battleDataNoLastHits || [])
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
              sortOrder: LEVEL_ORDER[level as keyof typeof LEVEL_ORDER] || 6,
              set: battle.set
            }
          }
          
          acc[key].damages.push(battle.damageDealt || 0)
          acc[key].tokenCount += 1
          acc[key].maxHit = Math.max(acc[key].maxHit, battle.damageDealt || 0)
          
          return acc
        }, {} as Record<string, any>)

      const bossAveragesList: BossAverageData[] = Object.values(bossGroups).map((boss: any) => {
        const avgDamage = boss.damages.length > 0 ? boss.damages.reduce((sum: number, dmg: number) => sum + dmg, 0) / boss.damages.length : 0
        
        // Calculate cluster average for this specific boss
        const clusterBossData = (clusterData || []).filter(d => 
          d.encounterId === 0 && 
          d.set === boss.set && 
          d.Name === boss.bossName
        )
        const clusterAvg = calculateClusterAverage(clusterBossData, selectedGuild, 'damageDealt')
        
        return {
          level: boss.level,
          bossName: boss.bossName,
          avgDamage,
          maxHit: boss.maxHit,
          tokenCount: boss.tokenCount,
          sortOrder: boss.sortOrder,
          clusterAvg
        }
      }).sort((a, b) => a.sortOrder - b.sortOrder)

      setBossAverages(bossAveragesList)

      // Process prime averages (L5 to L1)
      const primeGroups = (battleDataNoLastHits || [])
        .filter(d => d.encounterId > 0)
        .reduce((acc, battle) => {
          const level = `L${battle.set + 1}`
          
          if (!acc[level]) {
            acc[level] = {
              level,
              damages: [],
              tokenCount: 0,
              maxHit: 0,
              sortOrder: LEVEL_ORDER[level as keyof typeof LEVEL_ORDER] || 6,
              primeNames: new Set<string>()
            }
          }
          
          acc[level].damages.push(battle.damageDealt || 0)
          acc[level].tokenCount += 1
          acc[level].maxHit = Math.max(acc[level].maxHit, battle.damageDealt || 0)
          acc[level].primeNames.add(battle.Name || 'Unknown Prime')
          
          return acc
        }, {} as Record<string, any>)

      const primeAveragesList: PrimeAverageData[] = Object.values(primeGroups).map((prime: any) => {
        // Calculate cluster average for this tier of primes
        const clusterPrimeData = (clusterData || []).filter(d => 
          d.encounterId > 0 && 
          d.set === parseInt(prime.level.substring(1)) - 1
        )
        const clusterAvg = calculateClusterAverage(clusterPrimeData, selectedGuild, 'damageDealt')
        
        return {
          level: prime.level,
          avgDamage: prime.damages.length > 0 ? prime.damages.reduce((sum: number, dmg: number) => sum + dmg, 0) / prime.damages.length : 0,
          maxHit: prime.maxHit,
          tokenCount: prime.tokenCount,
          sortOrder: prime.sortOrder,
          clusterAvg,
          primeNames: Array.from(prime.primeNames) as string[]
        }
      }).sort((a, b) => a.sortOrder - b.sortOrder)

      setPrimeAverages(primeAveragesList)

      // Calculate prime tokens by tier for individual sections
      const primeTokensByTierCalc = battleData
        .filter(d => d.encounterId > 0)
        .reduce((acc, battle) => {
          const level = `L${battle.set + 1}`
          acc[level] = (acc[level] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      
      setPrimeTokensByTier(primeTokensByTierCalc)

      // Calculate prime tokens by individual name
      const primeTokensByNameCalc = battleData
        .filter(d => d.encounterId > 0)
        .reduce((acc, battle) => {
          const primeName = battle.Name || 'Unknown Prime'
          const tier = `L${battle.set + 1}`
          if (!acc[primeName]) {
            acc[primeName] = { count: 0, tier }
          }
          acc[primeName].count += 1
          return acc
        }, {} as Record<string, {count: number, tier: string}>)
      
      setPrimeTokensByName(primeTokensByNameCalc)

      // Process loop token data
      const loopData: LoopTokenData[] = []
      for (let loop = 0; loop <= maxLoop; loop++) {
        const loopBattles = battleData.filter(d => d.loopIndex === loop)
        
        const loopStats = {
          loop: loop + 1,
          totalTokens: loopBattles.length,
          l1Tokens: loopBattles.filter(d => d.set === 0).length, // L1 bosses + L1 primes combined
          l2Tokens: loopBattles.filter(d => d.set === 1).length, // L2 bosses + L2 primes combined
          l3Tokens: loopBattles.filter(d => d.set === 2).length, // L3 bosses + L3 primes combined
          l4Tokens: loopBattles.filter(d => d.set === 3).length, // L4 bosses + L4 primes combined
          l5Tokens: loopBattles.filter(d => d.set === 4).length, // L5 bosses + L5 primes combined
          primeTokens: loopBattles.filter(d => d.encounterId > 0).length
        }
        
        loopData.push(loopStats)
      }
      setLoopTokenData(loopData)

      // Process tier combined data (bosses + primes per tier)
      const tierCombined: TierCombinedData[] = []
      for (let set = 0; set <= 4; set++) {
        const tier = `L${set + 1}`
        const tierBattles = battleData.filter(d => d.set === set)
        const bossTokens = tierBattles.filter(d => d.encounterId === 0).length
        const primeTokens = tierBattles.filter(d => d.encounterId > 0).length
        
        tierCombined.push({
          tier,
          combined: bossTokens + primeTokens,
          bosses: bossTokens,
          primes: primeTokens
        })
      }
      setTierCombinedData(tierCombined.reverse()) // L5 to L1

      // Process token distribution for pie chart (specific boss names)
      const tokenCounts = {
        'L5 Magnus': battleData.filter(d => d.set === 4 && d.encounterId === 0).length,
        'L4 Mortarion': battleData.filter(d => d.set === 3 && d.encounterId === 0).length,
        'L3 SilentKing': battleData.filter(d => d.set === 2 && d.encounterId === 0).length,
        'L2 Avatar': battleData.filter(d => d.set === 1 && d.encounterId === 0).length,
        'L1 Ghazghkull': battleData.filter(d => d.set === 0 && d.encounterId === 0).length
      }

      const bossTokensOnly = Object.values(tokenCounts).reduce((sum, count) => sum + count, 0)

      const tokenDistributionList: BossTokenDistribution[] = Object.entries(tokenCounts)
        .filter(([_, count]) => count > 0)
        .map(([name, tokens], index) => ({
          name,
          tokens,
          percentage: bossTokensOnly > 0 ? (tokens / bossTokensOnly) * 100 : 0,
          color: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => {
          // Sort L5 to L1
          const aLevel = parseInt(a.name.match(/L(\d)/)?.[1] || '0')
          const bLevel = parseInt(b.name.match(/L(\d)/)?.[1] || '0')
          return bLevel - aLevel
        })

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
              {selectedGuild}&apos;s Command Center - Campaign: {selectedSeason}
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
            <div className="stat-value-wh40k text-red-400">{summaryStats.totalBombs}</div>
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
          
          {/* Boss Averages with Guild vs Cluster Indicators */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k">AVG vs MAX Damage to Bosses</h3>
            <div className="space-y-3">
              {bossAverages.map((boss, index) => {
                const maxAvg = Math.max(...bossAverages.map(b => b.avgDamage))
                const barWidth = (boss.avgDamage / maxAvg) * 100
                const vsCluster = boss.clusterAvg ? ((boss.avgDamage / boss.clusterAvg) - 1) * 100 : 0
                
                return (
                  <div key={`${boss.level}-${boss.bossName}`} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-300">
                        {formatBossName(boss.bossName, parseInt(boss.level.substring(1)) - 1)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400">AVG: {(boss.avgDamage / 1000000).toFixed(2)}M</span>
                        <span className="text-xs text-slate-400">MAX: {(boss.maxHit / 1000000).toFixed(2)}M</span>
                        {vsCluster !== 0 && (
                          <span className={`text-xs px-1 rounded ${vsCluster > 0 ? 'text-green-400 bg-green-400/20' : 'text-red-400 bg-red-400/20'}`}>
                            vsCluster {vsCluster > 0 ? '+' : ''}{vsCluster.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Prime Averages */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k text-green-400">AVG vs MAX Damage to Primes</h3>
            <div className="space-y-3">
              {primeAverages.map((prime, index) => {
                const maxAvg = Math.max(...primeAverages.map(p => p.avgDamage))
                const barWidth = (prime.avgDamage / maxAvg) * 100
                const vsCluster = prime.clusterAvg ? ((prime.avgDamage / prime.clusterAvg) - 1) * 100 : 0
                
                return (
                  <div key={prime.level} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-300">{prime.level} Primes</span>
                        <span className="text-xs text-slate-400">
                          {prime.primeNames.join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">AVG: {(prime.avgDamage / 1000000).toFixed(2)}M</span>
                        <span className="text-xs text-slate-400">MAX: {(prime.maxHit / 1000000).toFixed(2)}M</span>
                        {vsCluster !== 0 && (
                          <span className={`text-xs px-1 rounded ${vsCluster > 0 ? 'text-green-400 bg-green-400/20' : 'text-red-400 bg-red-400/20'}`}>
                            vsCluster {vsCluster > 0 ? '+' : ''}{vsCluster.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-1000 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tokens per Lap - Stacked Bar Chart */}
          <div className="card-wh40k p-4">
            <h3 className="subheading-wh40k text-yellow-400">Tokens Per Lap</h3>
            {loopTokenData.length > 0 && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                <div className="text-center text-sm">
                  <span className="text-blue-400 font-semibold">Bosses: {loopTokenData.reduce((sum, loop) => sum + (loop.l1Tokens + loop.l2Tokens + loop.l3Tokens + loop.l4Tokens + loop.l5Tokens), 0)}</span>
                  <span className="mx-3 text-slate-400">•</span>
                  <span className="text-pink-400 font-semibold">Primes: {loopTokenData.reduce((sum, loop) => sum + loop.primeTokens, 0)}</span>
                  <span className="mx-3 text-slate-400">•</span>
                  <span className="text-yellow-400 font-semibold">Total: {loopTokenData.reduce((sum, loop) => sum + loop.totalTokens, 0)}</span>
                </div>
              </div>
            )}
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
                        <span className="text-xs text-slate-300">
                          <span className="text-blue-400">Bosses: {bossTokens}</span> <span className="mx-1 text-slate-400">•</span> <span className="text-pink-400">Primes: {loop.primeTokens}</span> <span className="mx-1 text-slate-400">•</span> <span className="text-yellow-400">Total: {loop.totalTokens}</span>
                        </span>
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

        {/* Tokens per Lap Line Chart - Individual Bosses Only */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-yellow-400">Total Tokens per Lap per Boss (Bosses Only)</h3>
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
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Combined Tier Tokens Chart - Stacked Bar per Lap */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-purple-400">Combined Tokens per Lap (Stacked by Tier)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={loopTokenData}>
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
              <Bar dataKey="l5Tokens" stackId="a" fill="#3B82F6" name="L5 (Bosses + Primes)" />
              <Bar dataKey="l4Tokens" stackId="a" fill="#EF4444" name="L4 (Bosses + Primes)" />
              <Bar dataKey="l3Tokens" stackId="a" fill="#10B981" name="L3 (Bosses + Primes)" />
              <Bar dataKey="l2Tokens" stackId="a" fill="#F59E0B" name="L2 (Bosses + Primes)" />
              <Bar dataKey="l1Tokens" stackId="a" fill="#8B5CF6" name="L1 (Bosses + Primes)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Boss Token Cards */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k">Total Boss Tokens</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {tokenDistribution.map((boss, index) => (
              <div key={boss.name} className="text-center p-4 bg-slate-700/50 rounded-lg">
                <div className="text-xl font-bold text-blue-400 mb-2">{boss.tokens}</div>
                <div className="text-xs text-slate-300 mb-1">{boss.name}</div>
                <div className="text-xs text-slate-400">{boss.percentage.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Prime Token Cards - Individual by Name */}
        <div className="card-wh40k p-4">
          <h3 className="subheading-wh40k text-pink-400">Total Prime Tokens</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(primeTokensByName)
              .sort(([,a], [,b]) => b.count - a.count)
              .map(([primeName, primeData]) => {
                const totalPrimeTokens = Object.values(primeTokensByName).reduce((sum, data) => sum + data.count, 0)
                const percentage = totalPrimeTokens > 0 ? (primeData.count / totalPrimeTokens) * 100 : 0
                
                return (
                  <div key={primeName} className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-lg font-bold text-pink-400 mb-1">{primeData.count}</div>
                    <div className="text-xs text-slate-300 mb-1">{primeData.tier} {primeName}</div>
                    <div className="text-xs text-slate-400">{percentage.toFixed(0)}%</div>
                  </div>
                )
              })
            }
          </div>
        </div>

      </div>
    </div>
  )
}
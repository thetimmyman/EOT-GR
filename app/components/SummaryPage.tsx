'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  ComposedChart, Scatter, ScatterChart, ZAxis
} from 'recharts'

interface SummaryPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface BossTokenUsage {
  bossName: string
  tokensUsed: number
  percentage: number
  avgPerLoop: number
  avgDamage: number
}

interface SummaryStats {
  totalHits: number
  totalTokens: number
  totalDamage: number
  avgDamagePerHit: number
  avgDamagePerPrime: number
  tokensPerLoop: number
  tokensPerBossPerLoop: number
  completedLoops: number
  totalBombs: number
  bossTokenUsage: BossTokenUsage[]
  bossAverages: { [key: string]: number }
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function SummaryPage({ selectedGuild, selectedSeason }: SummaryPageProps) {
  const [stats, setStats] = useState<SummaryStats>({
    totalHits: 0,
    totalTokens: 0,
    totalDamage: 0,
    avgDamagePerHit: 0,
    avgDamagePerPrime: 0,
    tokensPerLoop: 0,
    tokensPerBossPerLoop: 0,
    completedLoops: 0,
    totalBombs: 0,
    bossTokenUsage: [],
    bossAverages: {}
  })
  const [loading, setLoading] = useState(true)
  const [lapProgressData, setLapProgressData] = useState<any[]>([])
  const [topPlayersData, setTopPlayersData] = useState<any[]>([])

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchSummaryData()
    }
  }, [selectedGuild, selectedSeason])

  const fetchSummaryData = async () => {
    setLoading(true)
    
    try {
      console.log(`Fetching summary data for ${selectedGuild} Season ${selectedSeason}`)
      
      // Get all battle data for calculations
      const { data: battleData, error } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

      if (error) {
        console.error('Error fetching summary data:', error)
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
      const totalHits = battleData.length
      const totalDamage = battleData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const avgDamagePerHit = totalHits > 0 ? totalDamage / totalHits : 0

      // Calculate tokens and loops
      const totalTokens = battleData.filter(d => d.tier >= 4).length
      const maxLoop = Math.max(...battleData.map(d => d.loopIndex || 0))
      const completedLoops = maxLoop + 1

      // Prime data analysis
      const primeData = battleData.filter(d => d.encounterId > 0)
      const avgDamagePerPrime = primeData.length > 0 ? 
        primeData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / primeData.length : 0

      // Calculate tokens per loop
      const tokensPerLoop = completedLoops > 0 ? totalTokens / completedLoops : 0

      // Get unique boss names from the data
      const mainBossData = battleData.filter(d => d.encounterId === 0)
      const bossNamesSet = new Set(mainBossData.map(d => d.Name))
      const uniqueBosses = Array.from(bossNamesSet).filter(Boolean)
      
      // Calculate boss averages and token usage
      const bossAverages: {[key: string]: number} = {}
      const bossTokens: BossTokenUsage[] = []
      
      uniqueBosses.forEach(bossName => {
        const bossData = battleData.filter(d => d.Name === bossName)
        const bossTokenCount = bossData.length
        const totalBossDamage = bossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
        
        bossAverages[bossName] = bossTokenCount > 0 ? totalBossDamage / bossTokenCount : 0
        
        bossTokens.push({
          bossName,
          tokensUsed: bossTokenCount,
          percentage: totalTokens > 0 ? (bossTokenCount / totalTokens) * 100 : 0,
          avgPerLoop: completedLoops > 0 ? bossTokenCount / completedLoops : 0,
          avgDamage: bossAverages[bossName]
        })
      })

      const tokensPerBossPerLoop = completedLoops > 0 && uniqueBosses.length > 0 ?
        totalTokens / (completedLoops * uniqueBosses.length) : 0

      // Calculate lap progress data for charts
      const lapData = []
      for (let loop = 0; loop <= maxLoop; loop++) {
        const loopData = battleData.filter(d => d.loopIndex === loop)
        const totalDamageThisLoop = loopData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
        const tokensThisLoop = loopData.length
        
        // Boss-specific data for this loop
        const bossDataForLoop: any = { loop: loop + 1, totalTokens: tokensThisLoop, totalDamage: Math.round(totalDamageThisLoop / 1000) }
        
        uniqueBosses.forEach(bossName => {
          const bossLoopData = loopData.filter(d => d.Name === bossName)
          bossDataForLoop[bossName] = bossLoopData.length
          bossDataForLoop[`${bossName}_damage`] = Math.round(bossLoopData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / 1000)
        })
        
        lapData.push(bossDataForLoop)
      }

      // Calculate top players data
      const playerStats = new Map()
      battleData.forEach(d => {
        const player = d.displayName
        if (!playerStats.has(player)) {
          playerStats.set(player, { 
            name: player, 
            totalDamage: 0, 
            tokens: 0, 
            avgDamage: 0,
            biggestHit: 0
          })
        }
        const stats = playerStats.get(player)
        stats.totalDamage += d.damageDealt || 0
        stats.tokens += 1
        stats.biggestHit = Math.max(stats.biggestHit, d.damageDealt || 0)
      })

      // Calculate averages and sort
      const topPlayers = Array.from(playerStats.values())
        .map(p => ({ ...p, avgDamage: p.tokens > 0 ? p.totalDamage / p.tokens : 0 }))
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 10)
        .map(p => ({
          ...p,
          totalDamage: Math.round(p.totalDamage / 1000), // Convert to K
          avgDamage: Math.round(p.avgDamage / 1000),
          biggestHit: Math.round(p.biggestHit / 1000)
        }))

      setStats({
        totalHits,
        totalTokens,
        totalDamage,
        avgDamagePerHit,
        avgDamagePerPrime,
        tokensPerLoop,
        tokensPerBossPerLoop,
        completedLoops,
        totalBombs: 0, // Would need bomb data
        bossTokenUsage: bossTokens.sort((a, b) => b.tokensUsed - a.tokensUsed),
        bossAverages
      })

      setLapProgressData(lapData)
      setTopPlayersData(topPlayers)

    } catch (error) {
      console.error('Error in fetchSummaryData:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading guild summary...</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const bossTokenChartData = stats.bossTokenUsage.map((boss, index) => ({
    ...boss,
    fill: COLORS[index % COLORS.length]
  }))

  const damageEfficiencyData = stats.bossTokenUsage.map(boss => ({
    boss: boss.bossName.length > 12 ? boss.bossName.substring(0, 12) + '...' : boss.bossName,
    fullName: boss.bossName,
    avgDamage: Math.round(boss.avgDamage / 1000),
    tokensUsed: boss.tokensUsed,
    efficiency: boss.tokensUsed > 0 ? Math.round((boss.avgDamage / 1000) / boss.tokensUsed * 100) / 100 : 0
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6 space-y-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">📊 Guild Raid Summary</h1>
          <p className="text-blue-100">Season {selectedSeason} • {selectedGuild} Guild Performance Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
              <div className="text-blue-100">Total Tokens</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{Math.round(stats.totalDamage / 1000000)}M</div>
              <div className="text-blue-100">Total Damage</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{stats.completedLoops}</div>
              <div className="text-blue-100">Completed Loops</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{Math.round(stats.avgDamagePerHit / 1000)}K</div>
              <div className="text-blue-100">Avg per Hit</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Boss Token Distribution - Pie Chart */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🎯 Token Distribution by Boss
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={bossTokenChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  dataKey="tokensUsed"
                  label={({ bossName, percentage }) => `${bossName}: ${percentage.toFixed(1)}%`}
                  labelLine={false}
                >
                  {bossTokenChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => [
                    `${value} tokens (${props.payload.percentage.toFixed(1)}%)`,
                    props.payload.bossName
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Boss Damage Efficiency */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              ⚡ Boss Damage Efficiency
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={damageEfficiencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => {
                    if (name === 'avgDamage') return [`${value}K`, 'Avg Damage']
                    if (name === 'tokensUsed') return [`${value} tokens`, 'Tokens Used']
                    return [value, name]
                  }}
                />
                <Bar yAxisId="left" dataKey="avgDamage" fill="#3B82F6" name="Avg Damage" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="tokensUsed" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', strokeWidth: 2, r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Lap Progress Analysis - Full Width */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            📈 Token Usage Progress by Loop
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={lapProgressData}>
              <defs>
                {stats.bossTokenUsage.map((boss, index) => (
                  <linearGradient key={boss.bossName} id={`gradient${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="loop" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              {stats.bossTokenUsage.slice(0, 6).map((boss, index) => (
                <Area
                  key={boss.bossName}
                  type="monotone"
                  dataKey={boss.bossName}
                  stackId="1"
                  stroke={COLORS[index % COLORS.length]}
                  fill={`url(#gradient${index})`}
                  name={boss.bossName}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Players Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Players by Total Damage */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              🏆 Top Players - Total Damage
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topPlayersData.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => [
                    `${value}K total damage`,
                    `${props.payload.tokens} tokens`
                  ]}
                />
                <Bar dataKey="totalDamage" fill="#F59E0B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Player Efficiency Scatter */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              💎 Player Efficiency Analysis
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart data={topPlayersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="tokens" tick={{ fontSize: 12 }} name="Tokens Used" />
                <YAxis dataKey="avgDamage" tick={{ fontSize: 12 }} name="Avg Damage" />
                <ZAxis dataKey="biggestHit" range={[50, 300]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => [
                    props.payload.name,
                    `${props.payload.avgDamage}K avg, ${props.payload.tokens} tokens, ${props.payload.biggestHit}K biggest hit`
                  ]}
                />
                <Scatter fill="#8B5CF6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Tokens per Loop</p>
                <p className="text-3xl font-bold">{stats.tokensPerLoop.toFixed(1)}</p>
              </div>
              <div className="text-4xl">🔄</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Prime Efficiency</p>
                <p className="text-3xl font-bold">{Math.round(stats.avgDamagePerPrime / 1000)}K</p>
              </div>
              <div className="text-4xl">⭐</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Boss Efficiency</p>
                <p className="text-3xl font-bold">{stats.tokensPerBossPerLoop.toFixed(1)}</p>
              </div>
              <div className="text-4xl">🎯</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100">Total Hits</p>
                <p className="text-3xl font-bold">{stats.totalHits.toLocaleString()}</p>
              </div>
              <div className="text-4xl">💥</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter, ZAxis,
  ComposedChart, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'

interface BossPerformancePageProps {
  selectedGuild: string
  selectedSeason: string
  level: number // 1, 2, 3, 4, 5
}

interface PlayerStats {
  displayName: string
  avgDamage: number
  totalDamage: number
  tokenCount: number
  biggestHit: number
  hitCount: number
  efficiency: number
}

interface LapData {
  loopIndex: number
  bossTokens: number
  prime1Tokens: number
  prime2Tokens: number
  bossAvgDamage: number
  prime1AvgDamage: number
  prime2AvgDamage: number
  totalTokens: number
  totalDamage: number
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

// Helper function to identify last hits
const isLastHit = (entry: any, allData: any[]) => {
  const sameEncounterData = allData.filter(d => 
    d.loopIndex === entry.loopIndex &&
    d.Name === entry.Name &&
    d.tier === entry.tier &&
    d.Season === entry.Season
  )
  
  const minRemainingHp = Math.min(...sameEncounterData.map(d => d.remainingHp || 0))
  
  return entry.remainingHp === minRemainingHp && entry.damageType === 'Battle'
}

export default function BossPerformancePage({ selectedGuild, selectedSeason, level }: BossPerformancePageProps) {
  const [levelData, setLevelData] = useState<any[]>([])
  const [bossPlayerStats, setBossPlayerStats] = useState<PlayerStats[]>([])
  const [prime1PlayerStats, setPrime1PlayerStats] = useState<PlayerStats[]>([])
  const [prime2PlayerStats, setPrime2PlayerStats] = useState<PlayerStats[]>([])
  const [lapData, setLapData] = useState<LapData[]>([])
  const [loading, setLoading] = useState(true)
  const [bossName, setBossName] = useState('')
  const [prime1Name, setPrime1Name] = useState('')
  const [prime2Name, setPrime2Name] = useState('')
  const [playerComparisonData, setPlayerComparisonData] = useState<any[]>([])
  const [damageDistributionData, setDamageDistributionData] = useState<any[]>([])
  const [overallStats, setOverallStats] = useState({
    avgDamagePerHit: 0,
    totalBossTokens: 0,
    totalPrimeTokens: 0,
    totalTokens: 0,
    topDamagePlayer: '',
    topDamageAmount: 0,
    biggestHitPlayer: '',
    biggestHitAmount: 0,
    avgBossEfficiency: 0,
    avgPrimeEfficiency: 0
  })

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchLevelData()
    }
  }, [selectedGuild, selectedSeason, level])

  const fetchLevelData = async () => {
    setLoading(true)
    
    if (!selectedGuild || !selectedSeason) {
      setLoading(false)
      return
    }
    
    try {
      // Correct boss name mapping for each level
      const bossNames = {
        1: 'Ultramarines Captain',
        2: 'Chaos Lord', 
        3: 'Tech Marine',
        4: 'Death Guard',
        5: 'Space Marine'
      }
      
      const currentBossName = bossNames[level as keyof typeof bossNames]
      setBossName(currentBossName)
      
      console.log(`Fetching Level ${level} data for ${selectedGuild} Season ${selectedSeason}`)
      console.log(`Looking for boss: ${currentBossName}`)

      // Get all data for this level (boss + primes)
      const { data: allLevelData, error } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('Name', currentBossName)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

      if (error) {
        console.error('Error fetching level data:', error)
        setLoading(false)
        return
      }

      if (!allLevelData || allLevelData.length === 0) {
        console.log(`No data found for Level ${level}`)
        setLevelData([])
        setLoading(false)
        return
      }

      console.log(`Found ${allLevelData.length} records for Level ${level}`)
      setLevelData(allLevelData)

      // Filter out last hits
      const filteredData = allLevelData.filter(entry => !isLastHit(entry, allLevelData))
      console.log(`After filtering last hits: ${filteredData.length} records`)

      // Separate boss and prime data
      const bossData = filteredData.filter(d => d.encounterId === 0)
      const prime1Data = filteredData.filter(d => d.encounterId === 1)
      const prime2Data = filteredData.filter(d => d.encounterId === 2)

      // Set prime names dynamically
      if (prime1Data.length > 0) setPrime1Name(currentBossName)
      if (prime2Data.length > 0) setPrime2Name(currentBossName)

      // Calculate player statistics for boss
      const bossPlayerMap = new Map<string, PlayerStats>()
      bossData.forEach(entry => {
        const player = entry.displayName
        if (!bossPlayerMap.has(player)) {
          bossPlayerMap.set(player, {
            displayName: player,
            avgDamage: 0,
            totalDamage: 0,
            tokenCount: 0,
            biggestHit: 0,
            hitCount: 0,
            efficiency: 0
          })
        }
        const stats = bossPlayerMap.get(player)!
        stats.totalDamage += entry.damageDealt || 0
        stats.tokenCount += 1
        stats.hitCount += 1
        stats.biggestHit = Math.max(stats.biggestHit, entry.damageDealt || 0)
      })

      // Calculate averages and efficiency for boss
      const bossPlayers = Array.from(bossPlayerMap.values()).map(player => ({
        ...player,
        avgDamage: player.tokenCount > 0 ? player.totalDamage / player.tokenCount : 0,
        efficiency: player.tokenCount > 0 ? (player.totalDamage / player.tokenCount) / 1000 : 0
      })).sort((a, b) => b.totalDamage - a.totalDamage)

      setBossPlayerStats(bossPlayers)

      // Similar calculations for primes
      const calculatePrimeStats = (primeData: any[]) => {
        const playerMap = new Map<string, PlayerStats>()
        primeData.forEach(entry => {
          const player = entry.displayName
          if (!playerMap.has(player)) {
            playerMap.set(player, {
              displayName: player,
              avgDamage: 0,
              totalDamage: 0,
              tokenCount: 0,
              biggestHit: 0,
              hitCount: 0,
              efficiency: 0
            })
          }
          const stats = playerMap.get(player)!
          stats.totalDamage += entry.damageDealt || 0
          stats.tokenCount += 1
          stats.hitCount += 1
          stats.biggestHit = Math.max(stats.biggestHit, entry.damageDealt || 0)
        })

        return Array.from(playerMap.values()).map(player => ({
          ...player,
          avgDamage: player.tokenCount > 0 ? player.totalDamage / player.tokenCount : 0,
          efficiency: player.tokenCount > 0 ? (player.totalDamage / player.tokenCount) / 1000 : 0
        })).sort((a, b) => b.totalDamage - a.totalDamage)
      }

      setPrime1PlayerStats(calculatePrimeStats(prime1Data))
      setPrime2PlayerStats(calculatePrimeStats(prime2Data))

      // Calculate lap progression data
      const maxLoop = Math.max(...filteredData.map(d => d.loopIndex || 0))
      const lapProgression: LapData[] = []

      for (let loop = 0; loop <= maxLoop; loop++) {
        const loopData = filteredData.filter(d => d.loopIndex === loop)
        const loopBoss = loopData.filter(d => d.encounterId === 0)
        const loopPrime1 = loopData.filter(d => d.encounterId === 1)
        const loopPrime2 = loopData.filter(d => d.encounterId === 2)

        lapProgression.push({
          loopIndex: loop + 1,
          bossTokens: loopBoss.length,
          prime1Tokens: loopPrime1.length,
          prime2Tokens: loopPrime2.length,
          bossAvgDamage: loopBoss.length > 0 ? loopBoss.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / loopBoss.length : 0,
          prime1AvgDamage: loopPrime1.length > 0 ? loopPrime1.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / loopPrime1.length : 0,
          prime2AvgDamage: loopPrime2.length > 0 ? loopPrime2.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / loopPrime2.length : 0,
          totalTokens: loopData.length,
          totalDamage: loopData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
        })
      }

      setLapData(lapProgression)

      // Prepare player comparison data (top 10 players across all encounters)
      const allPlayerStats = new Map<string, any>()
      filteredData.forEach(entry => {
        const player = entry.displayName
        if (!allPlayerStats.has(player)) {
          allPlayerStats.set(player, {
            name: player,
            bossTokens: 0,
            bossDamage: 0,
            primeTokens: 0,
            primeDamage: 0,
            totalDamage: 0,
            biggestHit: 0
          })
        }
        const stats = allPlayerStats.get(player)!
        if (entry.encounterId === 0) {
          stats.bossTokens += 1
          stats.bossDamage += entry.damageDealt || 0
        } else {
          stats.primeTokens += 1
          stats.primeDamage += entry.damageDealt || 0
        }
        stats.totalDamage += entry.damageDealt || 0
        stats.biggestHit = Math.max(stats.biggestHit, entry.damageDealt || 0)
      })

      const topPlayers = Array.from(allPlayerStats.values())
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 10)
        .map(p => ({
          ...p,
          bossAvg: p.bossTokens > 0 ? Math.round(p.bossDamage / p.bossTokens / 1000) : 0,
          primeAvg: p.primeTokens > 0 ? Math.round(p.primeDamage / p.primeTokens / 1000) : 0,
          totalDamage: Math.round(p.totalDamage / 1000),
          biggestHit: Math.round(p.biggestHit / 1000)
        }))

      setPlayerComparisonData(topPlayers)

      // Calculate damage distribution data
      const damageRanges = [
        { range: '0-500K', min: 0, max: 500000, count: 0, color: '#EF4444' },
        { range: '500K-1M', min: 500000, max: 1000000, count: 0, color: '#F59E0B' },
        { range: '1M-2M', min: 1000000, max: 2000000, count: 0, color: '#10B981' },
        { range: '2M-3M', min: 2000000, max: 3000000, count: 0, color: '#3B82F6' },
        { range: '3M+', min: 3000000, max: Infinity, count: 0, color: '#8B5CF6' }
      ]

      filteredData.forEach(entry => {
        const damage = entry.damageDealt || 0
        const range = damageRanges.find(r => damage >= r.min && damage < r.max)
        if (range) range.count++
      })

      setDamageDistributionData(damageRanges.filter(r => r.count > 0))

      // Calculate overall stats
      const totalDamage = filteredData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const avgDamagePerHit = filteredData.length > 0 ? totalDamage / filteredData.length : 0
      
      const topDamagePlayer = bossPlayers.length > 0 ? bossPlayers[0] : null
      const biggestHit = Math.max(...filteredData.map(d => d.damageDealt || 0))
      const biggestHitEntry = filteredData.find(d => d.damageDealt === biggestHit)

      setOverallStats({
        avgDamagePerHit,
        totalBossTokens: bossData.length,
        totalPrimeTokens: prime1Data.length + prime2Data.length,
        totalTokens: filteredData.length,
        topDamagePlayer: topDamagePlayer?.displayName || '',
        topDamageAmount: topDamagePlayer?.totalDamage || 0,
        biggestHitPlayer: biggestHitEntry?.displayName || '',
        biggestHitAmount: biggestHit,
        avgBossEfficiency: bossData.length > 0 ? bossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / bossData.length : 0,
        avgPrimeEfficiency: (prime1Data.length + prime2Data.length) > 0 ? 
          (prime1Data.reduce((sum, d) => sum + (d.damageDealt || 0), 0) + prime2Data.reduce((sum, d) => sum + (d.damageDealt || 0), 0)) / 
          (prime1Data.length + prime2Data.length) : 0
      })

    } catch (error) {
      console.error('Error in fetchLevelData:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading Level {level} analysis...</p>
        </div>
      </div>
    )
  }

  const maxTokensPerLap = Math.max(...lapData.map(l => l.totalTokens), 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6 space-y-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">⚔️ Level {level} Boss Analysis</h1>
          <p className="text-blue-100">Season {selectedSeason} • {selectedGuild} Guild • {bossName || `Level ${level}`}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{Math.round(overallStats.avgDamagePerHit / 1000)}K</div>
              <div className="text-blue-100">Avg per Hit</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{overallStats.totalBossTokens}</div>
              <div className="text-blue-100">Boss Tokens</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{overallStats.totalPrimeTokens}</div>
              <div className="text-blue-100">Prime Tokens</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{overallStats.totalTokens}</div>
              <div className="text-blue-100">Total Tokens</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Top Players Performance */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              🏆 Top Players - Boss Performance
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={bossPlayerStats.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => [
                    `${Math.round(Number(value) / 1000)}K total damage`,
                    `${props.payload.tokenCount} tokens, ${Math.round(props.payload.avgDamage / 1000)}K avg`
                  ]}
                />
                <Bar dataKey="totalDamage" fill="#F59E0B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Damage Distribution */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              📊 Damage Distribution
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={damageDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  dataKey="count"
                  label={({ range, count }) => `${range}: ${count}`}
                  labelLine={false}
                >
                  {damageDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
                    `${value} hits`,
                    props.payload.range
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Lap Progression Analysis - Full Width */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            📈 Token Usage Progression by Loop
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={lapData}>
              <defs>
                <linearGradient id="bossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="primeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="loopIndex" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name) => {
                  if (name.includes('Tokens')) return [`${value} tokens`, name]
                  if (name.includes('Damage')) return [`${Math.round(Number(value) / 1000)}K`, name]
                  return [value, name]
                }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="bossTokens" stackId="1" stroke="#3B82F6" fill="url(#bossGradient)" name="Boss Tokens" />
              <Area yAxisId="left" type="monotone" dataKey="prime1Tokens" stackId="1" stroke="#EF4444" fill="url(#primeGradient)" name="Prime 1 Tokens" />
              <Area yAxisId="left" type="monotone" dataKey="prime2Tokens" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Prime 2 Tokens" />
              <Line yAxisId="right" type="monotone" dataKey="totalDamage" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', strokeWidth: 2, r: 6 }} name="Total Damage" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Player Comparison Analysis */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            ⚡ Player Performance Comparison
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={playerComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="bossAvg" tick={{ fontSize: 12 }} name="Boss Avg (K)" />
              <YAxis dataKey="primeAvg" tick={{ fontSize: 12 }} name="Prime Avg (K)" />
              <ZAxis dataKey="totalDamage" range={[50, 400]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name, props) => [
                  props.payload.name,
                  `Boss: ${props.payload.bossAvg}K, Prime: ${props.payload.primeAvg}K, Total: ${props.payload.totalDamage}K`
                ]}
              />
              <Scatter fill="#8B5CF6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">Top Total Damage</p>
                <p className="text-2xl font-bold">{overallStats.topDamagePlayer}</p>
                <p className="text-xl">{Math.round(overallStats.topDamageAmount / 1000)}K</p>
              </div>
              <div className="text-4xl">🏆</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Biggest Single Hit</p>
                <p className="text-2xl font-bold">{overallStats.biggestHitPlayer}</p>
                <p className="text-xl">{Math.round(overallStats.biggestHitAmount / 1000)}K</p>
              </div>
              <div className="text-4xl">💥</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

// Mock data for demonstration - replace with your actual supabase calls
const mockData = {
  totalRecords: 45623,
  currentSeasonRecords: 12847,
  guildCounts: {
    'IW': 401,
    'AL': 396,
    'IH': 203,
    'NL': 298,
    'WE': 187,
    'IF': 345,
    'TS': 289
  },
  clusterAverages: [
    { bossName: 'Ultramarines Captain', tokenUsage: 'Leg. Primes', count: 234, average: 2450000 },
    { bossName: 'Chaos Lord', tokenUsage: 'Leg. Primes', count: 189, average: 2100000 },
    { bossName: 'Tech Marine', tokenUsage: 'Ultramarines Captain', count: 156, average: 1890000 },
    { bossName: 'Death Guard', tokenUsage: 'Leg. Primes', count: 298, average: 2780000 },
    { bossName: 'Space Marine', tokenUsage: 'Leg. Primes', count: 167, average: 1650000 }
  ],
  guildAverages: [
    { bossName: 'Ultramarines Captain', tokenUsage: 'Leg. Primes', count: 23, average: 2650000 },
    { bossName: 'Chaos Lord', tokenUsage: 'Leg. Primes', count: 18, average: 2200000 },
    { bossName: 'Tech Marine', tokenUsage: 'Ultramarines Captain', count: 15, average: 1950000 },
    { bossName: 'Death Guard', tokenUsage: 'Leg. Primes', count: 29, average: 2950000 },
    { bossName: 'Space Marine', tokenUsage: 'Leg. Primes', count: 16, average: 1720000 }
  ]
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export default function EnhancedDebugPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const selectedGuild = 'IW'
  const selectedSeason = '78'

  useEffect(() => {
    // Simulate loading
    setLoading(true)
    setTimeout(() => {
      setData(mockData)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">🔧 Testing enhanced database connection...</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const guildCountData = Object.entries(data?.guildCounts || {}).map(([guild, count]) => ({
    guild,
    count,
    isSelected: guild === selectedGuild
  }))

  const performanceComparisonData = data?.guildAverages?.map(guildAvg => {
    const clusterAvg = data.clusterAverages?.find(c => 
      c.bossName === guildAvg.bossName && c.tokenUsage === guildAvg.tokenUsage
    )
    const vsCluster = clusterAvg && clusterAvg.average > 0 
      ? ((guildAvg.average / clusterAvg.average) - 1) * 100 
      : 0
    
    return {
      boss: guildAvg.bossName.length > 15 ? guildAvg.bossName.substring(0, 15) + '...' : guildAvg.bossName,
      fullBoss: guildAvg.bossName,
      guildAvg: Math.round(guildAvg.average / 1000),
      clusterAvg: Math.round(clusterAvg?.average / 1000 || 0),
      vsCluster: Math.round(vsCluster * 10) / 10,
      count: guildAvg.count
    }
  }) || []

  const topBossesData = data?.clusterAverages
    ?.sort((a, b) => b.average - a.average)
    ?.slice(0, 5)
    ?.map(boss => ({
      name: boss.bossName.length > 12 ? boss.bossName.substring(0, 12) + '...' : boss.bossName,
      fullName: boss.bossName,
      damage: Math.round(boss.average / 1000),
      count: boss.count
    })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="p-6 space-y-8">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">🔧 Enhanced Database Analytics</h1>
          <p className="text-blue-100">Real-time performance insights for Season {selectedSeason}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{data?.totalRecords?.toLocaleString()}</div>
              <div className="text-blue-100">Total Records</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{data?.currentSeasonRecords?.toLocaleString()}</div>
              <div className="text-blue-100">Season {selectedSeason}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{Object.keys(data?.guildCounts || {}).length}</div>
              <div className="text-blue-100">Active Guilds</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Guild Data Distribution - Bar Chart */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              📊 Guild Data Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={guildCountData}>
                <defs>
                  <linearGradient id="guildGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="selectedGuildGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="guild" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill={(entry) => entry.isSelected ? "url(#selectedGuildGradient)" : "url(#guildGradient)"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Guild vs Cluster Performance */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              ⚔️ Performance vs Cluster
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceComparisonData}>
                <defs>
                  <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name) => {
                    if (name === 'vsCluster') return [`${value}%`, 'vs Cluster']
                    return [value, name]
                  }}
                />
                <Bar 
                  dataKey="vsCluster" 
                  fill={(entry) => entry.vsCluster >= 0 ? "url(#positiveGradient)" : "url(#negativeGradient)"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Damage Bosses - Pie Chart */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎯 Top Damage Bosses
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.9}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0.6}/>
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={topBossesData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="damage"
                  label={({ name, damage }) => `${name}: ${damage}K`}
                  labelLine={false}
                >
                  {topBossesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#pieGradient${index % COLORS.length})`} />
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
                    `${value}K damage`,
                    props.payload.fullName
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Guild vs Cluster Line Comparison */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              📈 Guild vs Cluster Damage
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceComparisonData}>
                <defs>
                  <linearGradient id="guildLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="clusterLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name) => [`${value}K`, name === 'guildAvg' ? 'Guild Average' : 'Cluster Average']}
                />
                <Line 
                  type="monotone" 
                  dataKey="guildAvg" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  fill="url(#guildLineGradient)"
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="clusterAvg" 
                  stroke="#EF4444" 
                  strokeWidth={3}
                  strokeDasharray="8 8"
                  fill="url(#clusterLineGradient)"
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Above Cluster Avg</p>
                <p className="text-3xl font-bold">
                  {performanceComparisonData.filter(d => d.vsCluster > 0).length}
                </p>
              </div>
              <div className="text-4xl">🚀</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">At Cluster Level</p>
                <p className="text-3xl font-bold">
                  {performanceComparisonData.filter(d => Math.abs(d.vsCluster) <= 2).length}
                </p>
              </div>
              <div className="text-4xl">⚖️</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Below Cluster Avg</p>
                <p className="text-3xl font-bold">
                  {performanceComparisonData.filter(d => d.vsCluster < -2).length}
                </p>
              </div>
              <div className="text-4xl">📉</div>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="text-center">
          <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 shadow-xl transform hover:scale-105 transition-all duration-200 font-bold">
            🔄 Refresh Enhanced Analytics
          </button>
        </div>
      </div>
    </div>
  )
}

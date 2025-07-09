'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'

interface DebugPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface GuildConfig {
  guild_code: string
  display_name: string
  enabled: boolean
}

interface AverageData {
  bossName: string
  tokenUsage: string
  count: number
  average: number
}

const GUILD_COLORS = {
  'IW': '#EF4444', // Red
  'AL': '#3B82F6', // Blue  
  'IH': '#10B981', // Green
  'NL': '#F59E0B', // Amber
  'WE': '#8B5CF6', // Purple
  'IF': '#EC4899', // Pink
  'TS': '#06B6D4', // Cyan
  'WB': '#84CC16', // Lime
  'BA': '#F97316', // Orange
  'SL': '#6366F1'  // Indigo
}

export default function DebugPage({ selectedGuild, selectedSeason }: DebugPageProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [guilds, setGuilds] = useState<GuildConfig[]>([])
  const [clusterAverages, setClusterAverages] = useState<AverageData[]>([])
  const [guildAverages, setGuildAverages] = useState<AverageData[]>([])
  const [allGuildAverages, setAllGuildAverages] = useState<any[]>([])

  useEffect(() => {
    testConnection()
  }, [selectedGuild, selectedSeason])

  const testConnection = async () => {
    try {
      setLoading(true)
      setConnectionError(null)

      console.log('🔧 Testing enhanced connection...')

      // First, get guild configurations
      const { data: guildConfigs, error: guildError } = await supabase
        .from('guild_config')
        .select('guild_code, display_name, enabled')
        .order('guild_code')

      if (guildError) {
        console.error('Guild config error:', guildError)
      } else {
        setGuilds(guildConfigs || [])
        console.log('Found guilds:', guildConfigs)
      }

      // Basic connection test with small sample
      const { data: testData, error } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, displayName, damageType, rarity, tier, set, Name, encounterId, remainingHp, damageDealt')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .limit(10)

      if (error) {
        setConnectionError(`Database error: ${error.message}`)
        console.error('🔧 Supabase error:', error)
        return
      }

      console.log('🔧 Sample data retrieved, fetching ALL records...')

      // Get ALL records for the season
      const { data: allData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, damageType, rarity, tier, set, Name, encounterId, remainingHp, damageDealt')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

      console.log('Raw data for calculations:', allData?.length || 0, 'records')

      if (allData && allData.length > 0) {
        // Calculate cluster averages (all guilds)
        const clusterMap = new Map<string, { total: number, count: number }>()
        
        allData.forEach(d => {
          const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
          const key = `${d.Name}_${tokenUsage}`
          
          if (!clusterMap.has(key)) {
            clusterMap.set(key, { total: 0, count: 0 })
          }
          const stats = clusterMap.get(key)!
          stats.total += d.damageDealt || 0
          stats.count += 1
        })

        const clusterAvgs: AverageData[] = Array.from(clusterMap.entries()).map(([key, stats]) => {
          const [bossName, tokenUsage] = key.split('_')
          return {
            bossName,
            tokenUsage,
            count: stats.count,
            average: stats.count > 0 ? stats.total / stats.count : 0
          }
        }).sort((a, b) => a.bossName.localeCompare(b.bossName))

        // Calculate guild averages (selected guild only)
        const guildData = allData.filter(d => d.Guild === selectedGuild)
        const guildMap = new Map<string, { total: number, count: number }>()
        
        guildData.forEach(d => {
          const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
          const key = `${d.Name}_${tokenUsage}`
          
          if (!guildMap.has(key)) {
            guildMap.set(key, { total: 0, count: 0 })
          }
          const stats = guildMap.get(key)!
          stats.total += d.damageDealt || 0
          stats.count += 1
        })

        const guildAvgs: AverageData[] = Array.from(guildMap.entries()).map(([key, stats]) => {
          const [bossName, tokenUsage] = key.split('_')
          return {
            bossName,
            tokenUsage,
            count: stats.count,
            average: stats.count > 0 ? stats.total / stats.count : 0
          }
        }).sort((a, b) => a.bossName.localeCompare(b.bossName))

        // Calculate ALL guild averages for comparison charts
        const allGuildsData = Array.from(new Set(allData.map(d => d.Guild))).map(guild => {
          const guildRecords = allData.filter(d => d.Guild === guild)
          const guildBossMap = new Map<string, { total: number, count: number }>()
          
          guildRecords.forEach(d => {
            const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
            const key = `${d.Name}_${tokenUsage}`
            
            if (!guildBossMap.has(key)) {
              guildBossMap.set(key, { total: 0, count: 0 })
            }
            const stats = guildBossMap.get(key)!
            stats.total += d.damageDealt || 0
            stats.count += 1
          })

          const guildBossAvgs = Array.from(guildBossMap.entries()).map(([key, stats]) => {
            const [bossName, tokenUsage] = key.split('_')
            return {
              bossName,
              tokenUsage,
              count: stats.count,
              average: stats.count > 0 ? stats.total / stats.count : 0,
              guild
            }
          })

          return {
            guild,
            totalRecords: guildRecords.length,
            averages: guildBossAvgs
          }
        })

        setClusterAverages(clusterAvgs)
        setGuildAverages(guildAvgs)
        setAllGuildAverages(allGuildsData)
        
        console.log('Cluster averages calculated:', clusterAvgs.length)
        console.log('Guild averages calculated:', guildAvgs.length)
        console.log('All guild data processed:', allGuildsData.length, 'guilds')
      }

      // Get metadata about all data
      const { data: allMetaData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, damageType, rarity, tier, set')

      const seasons = Array.from(new Set(allMetaData?.map(d => d.Season) || [])).sort()
      const allGuilds = Array.from(new Set(allMetaData?.map(d => d.Guild) || [])).sort()
      const damageTypes = Array.from(new Set(allMetaData?.map(d => d.damageType) || [])).sort()
      const rarities = Array.from(new Set(allMetaData?.map(d => d.rarity) || [])).sort()
      const tiers = Array.from(new Set(allMetaData?.map(d => d.tier) || [])).sort()
      const sets = Array.from(new Set(allMetaData?.map(d => d.set) || [])).sort()

      // Count records by guild for current season
      const guildCounts = new Map<string, number>()
      allData?.forEach(d => {
        guildCounts.set(d.Guild, (guildCounts.get(d.Guild) || 0) + 1)
      })

      setData({
        sample: testData,
        seasons,
        allGuilds,
        damageTypes,
        rarities,
        tiers,
        sets,
        totalRecords: allMetaData?.length || 0,
        currentSeasonRecords: allData?.length || 0,
        guildCounts: Object.fromEntries(guildCounts)
      })

      console.log('🔧 Enhanced connection successful!', {
        seasons,
        allGuilds,
        damageTypes,
        rarities,
        totalRecords: allMetaData?.length || 0,
        currentSeasonRecords: allData?.length || 0,
        guildCounts: Object.fromEntries(guildCounts)
      })

    } catch (err) {
      console.error('🔧 Connection failed:', err)
      setConnectionError(`Connection failed: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data
  const guildCountData = Object.entries(data?.guildCounts || {}).map(([guild, count]) => ({
    guild,
    count: count as number,
    fill: guild === selectedGuild ? GUILD_COLORS[guild] || '#EF4444' : '#94A3B8'
  }))

  // Prepare multi-guild boss comparison data
  const bossComparisonData = clusterAverages.slice(0, 8).map(boss => {
    const result: any = {
      boss: boss.bossName.length > 15 ? boss.bossName.substring(0, 15) + '...' : boss.bossName,
      fullBoss: boss.bossName,
      tokenUsage: boss.tokenUsage,
      clusterAvg: Math.round(boss.average / 1000)
    }

    // Add each guild's performance for this boss
    allGuildAverages.forEach(guildData => {
      const guildBoss = guildData.averages.find(avg => 
        avg.bossName === boss.bossName && avg.tokenUsage === boss.tokenUsage
      )
      if (guildBoss && guildBoss.count >= 3) { // Only show if guild has at least 3 attempts
        result[guildData.guild] = Math.round(guildBoss.average / 1000)
      }
    })

    return result
  })

  // Performance summary for selected guild
  const performanceVsCluster = guildAverages.map(guildAvg => {
    const clusterAvg = clusterAverages.find(c => 
      c.bossName === guildAvg.bossName && c.tokenUsage === guildAvg.tokenUsage
    )
    const vsCluster = clusterAvg && clusterAvg.average > 0 
      ? ((guildAvg.average / clusterAvg.average) - 1) * 100 
      : 0
    
    return {
      boss: guildAvg.bossName.length > 15 ? guildAvg.bossName.substring(0, 15) + '...' : guildAvg.bossName,
      fullBoss: guildAvg.bossName,
      vsCluster: Math.round(vsCluster * 10) / 10,
      guildCount: guildAvg.count,
      clusterCount: clusterAvg?.count || 0
    }
  }).filter(d => d.guildCount >= 3) // Only show bosses with sufficient data

  // Top performing guilds overall
  const guildPerformanceData = allGuildAverages.map(guildData => {
    const totalDamage = guildData.averages.reduce((sum, avg) => sum + (avg.average * avg.count), 0)
    const totalHits = guildData.averages.reduce((sum, avg) => sum + avg.count, 0)
    const overallAverage = totalHits > 0 ? totalDamage / totalHits : 0
    
    return {
      guild: guildData.guild,
      averageDamage: Math.round(overallAverage / 1000),
      totalHits: totalHits,
      totalRecords: guildData.totalRecords,
      fill: GUILD_COLORS[guildData.guild] || '#94A3B8'
    }
  }).sort((a, b) => b.averageDamage - a.averageDamage)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">🔧 Enhanced Database Analytics</h1>
          <p className="text-blue-100">Season {selectedSeason} Performance Analysis - {selectedGuild} vs Cluster</p>
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

        {connectionError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 font-semibold mb-2">❌ Connection Failed</div>
            <div className="text-red-500 text-sm">{connectionError}</div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Guild Data Distribution */}
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  📊 Guild Data Distribution - Season {selectedSeason}
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={guildCountData}>
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
                      formatter={(value) => [`${value} records`, 'Data Points']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Guild Performance Ranking */}
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  🏆 Guild Performance Ranking
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={guildPerformanceData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="guild" type="category" tick={{ fontSize: 12 }} width={40} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => [
                        `${value}K avg damage`,
                        `${props.payload.totalHits} total hits`
                      ]}
                    />
                    <Bar dataKey="averageDamage" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* Multi-Guild Boss Comparison - Full Width */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ⚔️ Multi-Guild Boss Performance Comparison
              </h3>
              <div className="text-sm text-gray-600 mb-4">
                Comparing damage across all guilds for top bosses (only showing guilds with 3+ attempts)
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={bossComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [`${value}K`, name === 'clusterAvg' ? 'Cluster Avg' : `${name} Guild`]}
                  />
                  <Legend />
                  <Bar dataKey="clusterAvg" fill="#94A3B8" name="Cluster Average" />
                  {Object.keys(GUILD_COLORS).map(guild => (
                    <Bar 
                      key={guild} 
                      dataKey={guild} 
                      fill={GUILD_COLORS[guild]} 
                      name={guild}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance vs Cluster for Selected Guild */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                📈 {selectedGuild} Performance vs Cluster Average
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={performanceVsCluster}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name, props) => [
                      `${value}%`,
                      `${props.payload.guildCount} attempts`
                    ]}
                  />
                  <Bar 
                    dataKey="vsCluster" 
                    radius={[4, 4, 0, 0]}
                    fill={(entry) => entry.vsCluster >= 0 ? '#10B981' : '#EF4444'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Above Cluster Avg</p>
                    <p className="text-3xl font-bold">
                      {performanceVsCluster.filter(d => d.vsCluster > 0).length}
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
                      {performanceVsCluster.filter(d => Math.abs(d.vsCluster) <= 5).length}
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
                      {performanceVsCluster.filter(d => d.vsCluster < -5).length}
                    </p>
                  </div>
                  <div className="text-4xl">📉</div>
                </div>
              </div>
            </div>

            {/* Refresh Button */}
            <div className="text-center">
              <button 
                onClick={testConnection}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 shadow-xl transform hover:scale-105 transition-all duration-200 font-bold"
              >
                🔄 Refresh Enhanced Analytics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

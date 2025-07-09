'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

const GUILD_COLORS: { [key: string]: string } = {
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

      console.log('🔧 Enhanced connection successful!')

    } catch (err) {
      console.error('🔧 Connection failed:', err)
      setConnectionError(`Connection failed: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data with TypeScript-safe color access
  const guildCountData = Object.entries(data?.guildCounts || {}).map(([guild, count]) => ({
    guild,
    count: count as number,
    color: guild === selectedGuild ? (GUILD_COLORS[guild] || '#EF4444') : '#94A3B8',
    percentage: 0
  }))

  // Calculate percentages for visualization
  const maxGuildCount = Math.max(...guildCountData.map(d => d.count), 1)
  guildCountData.forEach(d => {
    d.percentage = (d.count / maxGuildCount) * 100
  })

  // Guild performance data
  const guildPerformanceData = allGuildAverages.map(guildData => {
    const totalDamage = guildData.averages.reduce((sum: number, avg: any) => sum + (avg.average * avg.count), 0)
    const totalHits = guildData.averages.reduce((sum: number, avg: any) => sum + avg.count, 0)
    const overallAverage = totalHits > 0 ? totalDamage / totalHits : 0
    
    return {
      guild: guildData.guild,
      averageDamage: Math.round(overallAverage / 1000),
      totalHits: totalHits,
      color: GUILD_COLORS[guildData.guild] || '#94A3B8',
      percentage: 0
    }
  }).sort((a, b) => b.averageDamage - a.averageDamage)

  const maxPerformance = Math.max(...guildPerformanceData.map(d => d.averageDamage), 1)
  guildPerformanceData.forEach(d => {
    d.percentage = (d.averageDamage / maxPerformance) * 100
  })

  // Performance vs cluster
  const performanceVsCluster = guildAverages.map(guildAvg => {
    const clusterAvg = clusterAverages.find(c => 
      c.bossName === guildAvg.bossName && c.tokenUsage === guildAvg.tokenUsage
    )
    const vsCluster = clusterAvg && clusterAvg.average > 0 
      ? ((guildAvg.average / clusterAvg.average) - 1) * 100 
      : 0
    
    return {
      boss: guildAvg.bossName.length > 12 ? guildAvg.bossName.substring(0, 12) + '...' : guildAvg.bossName,
      fullBoss: guildAvg.bossName,
      vsCluster: Math.round(vsCluster * 10) / 10,
      guildCount: guildAvg.count,
      isPositive: vsCluster >= 0
    }
  }).filter(d => d.guildCount >= 3)

  // Top bosses for pie chart simulation
  const topBosses = clusterAverages
    .sort((a, b) => b.average - a.average)
    .slice(0, 6)
    .map((boss, index) => ({
      name: boss.bossName.length > 15 ? boss.bossName.substring(0, 15) + '...' : boss.bossName,
      damage: Math.round(boss.average / 1000),
      count: boss.count,
      color: Object.values(GUILD_COLORS)[index] || '#94A3B8',
      percentage: 0
    }))

  const maxBossDamage = Math.max(...topBosses.map(d => d.damage), 1)
  topBosses.forEach(d => {
    d.percentage = (d.damage / maxBossDamage) * 100
  })

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
              
              {/* Guild Data Distribution - CSS Bar Chart */}
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  📊 Guild Data Distribution - Season {selectedSeason}
                </h3>
                <div className="space-y-4">
                  {guildCountData.map((guild, index) => (
                    <div key={guild.guild} className="flex items-center space-x-4">
                      <div className="w-12 text-sm font-bold text-center">{guild.guild}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden relative">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-3 text-white text-sm font-bold"
                          style={{ 
                            width: `${guild.percentage}%`,
                            background: `linear-gradient(90deg, ${guild.color}dd, ${guild.color})`,
                            animationDelay: `${index * 100}ms`
                          }}
                        >
                          {guild.count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guild Performance Ranking - CSS Bar Chart */}
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  🏆 Guild Performance Ranking
                </h3>
                <div className="space-y-4">
                  {guildPerformanceData.map((guild, index) => (
                    <div key={guild.guild} className="flex items-center space-x-4">
                      <div className="w-12 text-sm font-bold text-center">{guild.guild}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden relative">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-3 text-white text-sm font-bold"
                          style={{ 
                            width: `${guild.percentage}%`,
                            background: `linear-gradient(90deg, ${guild.color}dd, ${guild.color})`,
                            animationDelay: `${index * 100}ms`
                          }}
                        >
                          {guild.averageDamage}K
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Top Damage Bosses - CSS Pie Chart Simulation */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🎯 Top Damage Bosses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topBosses.map((boss, index) => (
                  <div key={boss.name} className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: boss.color }}
                      ></div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{boss.name}</div>
                        <div className="text-xs text-gray-600">{boss.count} hits</div>
                      </div>
                      <div className="text-lg font-bold" style={{ color: boss.color }}>
                        {boss.damage}K
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${boss.percentage}%`,
                          background: `linear-gradient(90deg, ${boss.color}dd, ${boss.color})`,
                          animationDelay: `${index * 150}ms`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance vs Cluster */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                📈 {selectedGuild} Performance vs Cluster Average
              </h3>
              <div className="space-y-4">
                {performanceVsCluster.map((perf, index) => (
                  <div key={perf.boss} className="flex items-center space-x-4">
                    <div className="w-32 text-sm font-medium truncate" title={perf.fullBoss}>{perf.boss}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-0.5 h-full bg-gray-400"></div>
                      </div>
                      <div 
                        className={`h-full transition-all duration-1000 ease-out flex items-center text-white text-xs font-bold ${
                          perf.isPositive ? 'justify-end pr-2' : 'justify-start pl-2'
                        }`}
                        style={{ 
                          width: `${50 + (perf.vsCluster / 100) * 25}%`,
                          background: perf.isPositive 
                            ? `linear-gradient(90deg, #10B981dd, #10B981)` 
                            : `linear-gradient(90deg, #EF4444dd, #EF4444)`,
                          animationDelay: `${index * 100}ms`,
                          marginLeft: perf.isPositive ? '0' : 'auto',
                          marginRight: perf.isPositive ? 'auto' : '0'
                        }}
                      >
                        {perf.vsCluster > 0 ? '+' : ''}{perf.vsCluster}%
                      </div>
                    </div>
                    <div className="w-16 text-xs text-gray-600 text-right">{perf.guildCount} hits</div>
                  </div>
                ))}
              </div>
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
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatBossName } from '../lib/themeUtils'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from './RechartsWrapper'

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
  set?: number
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
  const [allData, setAllData] = useState<any[]>([])

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
        .limit(999999)

      if (error) {
        setConnectionError(`Database error: ${error.message}`)
        console.error('🔧 Supabase error:', error)
        return
      }

      console.log('🔧 Sample data retrieved, fetching ALL records...')

      // Get ALL records for the season
      const { data: allData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, displayName, damageType, rarity, tier, set, Name, encounterId, remainingHp, damageDealt, timestamp')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)
        .gt('damageDealt', 0)

      console.log('Raw data for calculations:', allData?.length || 0, 'records')
      
      // Store allData for use in boss calculations
      setAllData(allData || [])

      if (allData && allData.length > 0) {
        // Calculate cluster averages (all guilds)
        const clusterMap = new Map<string, { total: number, count: number, set?: number }>()
        
        allData.forEach(d => {
          const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
          const key = `${d.Name}_${tokenUsage}`
          
          if (!clusterMap.has(key)) {
            clusterMap.set(key, { total: 0, count: 0, set: d.encounterId === 0 ? d.set : undefined })
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
            average: stats.count > 0 ? stats.total / stats.count : 0,
            set: stats.set
          }
        }).sort((a, b) => a.bossName.localeCompare(b.bossName))

        // Calculate guild averages (selected guild only)
        const guildData = allData.filter(d => d.Guild === selectedGuild)
        const guildMap = new Map<string, { total: number, count: number, set?: number }>()
        
        guildData.forEach(d => {
          const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
          const key = `${d.Name}_${tokenUsage}`
          
          if (!guildMap.has(key)) {
            guildMap.set(key, { total: 0, count: 0, set: d.encounterId === 0 ? d.set : undefined })
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
            average: stats.count > 0 ? stats.total / stats.count : 0,
            set: stats.set
          }
        }).sort((a, b) => a.bossName.localeCompare(b.bossName))

        // Calculate ALL guild averages for comparison charts
        const allGuildsData = Array.from(new Set(allData.map(d => d.Guild))).map(guild => {
          const guildRecords = allData.filter(d => d.Guild === guild)
          const guildBossMap = new Map<string, { total: number, count: number, set?: number }>()
          
          guildRecords.forEach(d => {
            const tokenUsage = d.tier >= 4 ? (d.encounterId === 0 ? d.Name : "Leg. Primes") : "Non-Leg."
            const key = `${d.Name}_${tokenUsage}`
            
            if (!guildBossMap.has(key)) {
              guildBossMap.set(key, { total: 0, count: 0, set: d.encounterId === 0 ? d.set : undefined })
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
              set: stats.set,
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
      const activePlayers = new Set<string>()
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      allData?.forEach(d => {
        guildCounts.set(d.Guild, (guildCounts.get(d.Guild) || 0) + 1)
        // Count players who have used tokens in the past 24 hours
        if (d.displayName && d.timestamp) {
          const recordTime = new Date(d.timestamp)
          if (recordTime >= past24Hours) {
            activePlayers.add(d.displayName)
          }
        }
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
        guildCounts: Object.fromEntries(guildCounts),
        activePlayers: activePlayers.size
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
      color: guildData.guild === selectedGuild ? (GUILD_COLORS[guildData.guild] || '#EF4444') : '#94A3B8',
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

  // Guild stats calculation - use all available guilds
  const allAvailableGuilds = Array.from(new Set(allGuildAverages.map(g => g.guild)))
  const guildStats = allAvailableGuilds.map(guild => {
    // Get all unique players for this guild in current season
    const guildPlayers = new Set<string>()
    const activeGuildPlayers = new Set<string>()
    const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    // Get all player data for this guild from the season data
    allData?.forEach(d => {
      if (d.Guild === guild && d.displayName) {
        guildPlayers.add(d.displayName)
        // Check if player has recent activity
        if (d.timestamp) {
          const recordTime = new Date(d.timestamp)
          if (recordTime >= past24Hours) {
            activeGuildPlayers.add(d.displayName)
          }
        }
      }
    })
    
    return {
      guild: guild,
      totalPlayers: guildPlayers.size,
      activePlayers: activeGuildPlayers.size,
      inactivePlayers: Math.max(0, guildPlayers.size - activeGuildPlayers.size)
    }
  }).sort((a, b) => a.guild.localeCompare(b.guild))

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
      <div className="min-h-screen bg-wh40k flex items-center justify-center">
        <div className="text-center card-wh40k p-8">
          <div className="spinner-modern mx-auto"></div>
          <p className="mt-4 text-primary-wh40k font-semibold">🔧 Testing enhanced database connection...</p>
          <div className="mt-2 text-secondary-wh40k text-sm">Accessing Imperial Archives...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-wh40k text-primary-wh40k relative overflow-hidden">
      <div className="absolute inset-0 pattern-scales opacity-5"></div>
      <div className="container-modern space-y-6 relative z-10">
        {/* Header */}
        <div className="card-wh40k p-4 glow-primary relative">
          <div className="heraldry-display">🔧</div>
          <div className="flex items-center justify-between">
            <h1 className="heading-wh40k text-2xl text-glow-accent">Overall Cluster Performance</h1>
            <p className="text-right">
              <div className="stat-label-wh40k">Season {selectedSeason} Records</div>
            </p>
          </div>
          <div className="grid-wh40k mt-6">
            <div className="stat-card-wh40k">
              <div className="stat-label-wh40k">Total Records</div>
              <div className="stat-value-wh40k">{data?.totalRecords?.toLocaleString()}</div>
            </div>
            <div className="stat-card-wh40k">
              <div className="stat-label-wh40k">Season {selectedSeason}</div>
              <div className="stat-value-wh40k">{data?.currentSeasonRecords?.toLocaleString()}</div>
            </div>
            <div className="stat-card-wh40k">
              <div className="stat-label-wh40k">Active Guilds</div>
              <div className="stat-value-wh40k">{Object.keys(data?.guildCounts || {}).length}</div>
            </div>
            <div className="stat-card-wh40k">
              <div className="stat-label-wh40k"># of Active Players</div>
              <div className="stat-value-wh40k">{data?.activePlayers || 0}</div>
            </div>
          </div>
        </div>

        {connectionError ? (
          <div className="card-wh40k p-4 border-red-500">
            <div className="text-red-400 font-semibold mb-2">❌ Connection Failed</div>
            <div className="text-red-300 text-sm">{connectionError}</div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Guild Statistics Stacked Chart */}
            <div className="card-wh40k p-4">
              <h3 className="subheading-wh40k text-cyan-400">
                📊 Guild Statistics - Season {selectedSeason}
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={guildStats}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 60,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis 
                      dataKey="guild" 
                      stroke="#94A3B8"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="#94A3B8" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        color: '#F1F5F9'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="activePlayers" 
                      stackId="players" 
                      fill="#10B981" 
                      name="Active Players (24h)"
                    />
                    <Bar 
                      dataKey="inactivePlayers" 
                      stackId="players" 
                      fill="#6B7280" 
                      name="Inactive Players"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Guild Data Distribution - CSS Bar Chart */}
              <div className="card-wh40k p-4">
                <h3 className="subheading-wh40k">
                  📊 # of Records per Guild - Season {selectedSeason}
                </h3>
                <div className="space-y-2">
                  {guildCountData.sort((a, b) => b.count - a.count).map((guild, index) => (
                    <div key={guild.guild} className="flex items-center space-x-3">
                      <div className="w-12 text-sm font-bold text-center">{guild.guild}</div>
                      <div className="flex-1 bg-slate-700 rounded-full h-8 overflow-hidden relative">
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
              <div className="card-wh40k p-4">
                <h3 className="subheading-wh40k text-green-400">
                  🏆 AVG Damage per Guild
                </h3>
                <div className="space-y-2">
                  {guildPerformanceData.map((guild, index) => (
                    <div key={guild.guild} className="flex items-center space-x-3">
                      <div className="w-12 text-sm font-bold text-center">{guild.guild}</div>
                      <div className="flex-1 bg-slate-700 rounded-full h-8 overflow-hidden relative">
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

            {/* Top Damage Bosses for each guild */}
            {allGuildAverages.sort((a, b) => a.guild.localeCompare(b.guild)).map(guildData => {
              const guildTopBosses = guildData.averages
                .sort((a: any, b: any) => b.average - a.average)
                .slice(0, 6)
                .map((boss: any, index: number) => {
                  // Find the highest hit for this boss from original data
                  const bossHits = allData?.filter(d => 
                    d.Guild === guildData.guild && 
                    d.Name === boss.bossName &&
                    d.displayName &&
                    d.damageDealt > 0
                  ) || []
                  
                  const maxHit = bossHits.length > 0 ? bossHits.reduce((max, hit) => 
                    (hit.damageDealt || 0) > (max.damageDealt || 0) ? hit : max
                  ) : { displayName: 'No Data', damageDealt: 0 }
                  
                  // Format boss name with proper level prefix
                  const displayName = boss.tokenUsage === "Leg. Primes" ? 
                    "Leg. Primes" : 
                    (typeof boss.set === 'number' ? formatBossName(boss.bossName, boss.set) : boss.bossName)
                  
                  return {
                    name: displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName,
                    damage: Math.round(boss.average / 1000),
                    maxHit: Math.round((maxHit.damageDealt || 0) / 1000000 * 100) / 100,
                    player: maxHit.displayName || 'No Data',
                    count: boss.count,
                    color: guildData.guild === selectedGuild ? (GUILD_COLORS[guildData.guild] || '#EF4444') : '#94A3B8',
                    percentage: 0
                  }
                })
              
              const maxDamage = Math.max(...guildTopBosses.map((d: any) => d.damage), 1)
              guildTopBosses.forEach((d: any) => {
                d.percentage = (d.damage / maxDamage) * 100
              })
              
              return (
                <div key={`top-${guildData.guild}`} className="card-wh40k p-4">
                  <h3 className="subheading-wh40k text-purple-400">
                    🎯 {guildData.guild} Top Damage
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {guildTopBosses.map((boss: any, index: number) => (
                      <div key={boss.name} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: boss.color }}
                          ></div>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-slate-300">{boss.name}</div>
                            <div className="text-xs text-slate-400">{boss.count} hits</div>
                          </div>
                          <div className="text-lg font-bold" style={{ color: boss.color }}>
                            {boss.damage}K
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Max: {boss.maxHit}M by <span className="font-bold text-yellow-300">{index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅'} {boss.player}</span>
                        </div>
                        <div className="mt-2 bg-slate-600 rounded-full h-2 overflow-hidden">
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
              )
            })}

            {/* Performance vs Cluster for each guild */}
            {allGuildAverages.sort((a, b) => a.guild.localeCompare(b.guild)).map(guildData => {
              const guildPerformance = guildData.averages.map((guildAvg: any) => {
                const clusterAvg = clusterAverages.find(c => 
                  c.bossName === guildAvg.bossName && c.tokenUsage === guildAvg.tokenUsage
                )
                const vsCluster = clusterAvg && clusterAvg.average > 0 
                  ? ((guildAvg.average / clusterAvg.average) - 1) * 100 
                  : 0
                
                // Format boss name with proper level prefix
                const displayName = guildAvg.tokenUsage === "Leg. Primes" ? 
                  "Leg. Primes" : 
                  (typeof guildAvg.set === 'number' ? formatBossName(guildAvg.bossName, guildAvg.set) : guildAvg.bossName)
                
                return {
                  boss: displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName,
                  fullBoss: displayName,
                  vsCluster: Math.round(vsCluster * 10) / 10,
                  guildCount: guildAvg.count,
                  isPositive: vsCluster >= 0
                }
              }).filter((d: any) => d.guildCount >= 3)
              
              return (
                <div key={guildData.guild} className="card-wh40k p-4">
                  <h3 className="subheading-wh40k text-yellow-400">
                    📈 {guildData.guild} Performance Average
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {guildPerformance.map((perf: any, index: number) => (
                      <div key={perf.boss} className="flex items-center space-x-2 bg-slate-800/30 p-2 rounded">
                        <div className="w-32 text-sm font-medium text-slate-300 truncate" title={perf.fullBoss}>{perf.boss}</div>
                        <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-0.5 h-full bg-slate-400"></div>
                          </div>
                          <div 
                            className={`h-full transition-all duration-1000 ease-out flex items-center text-white text-xs font-bold`}
                            style={{ 
                              width: `${Math.abs(perf.vsCluster) > 0 ? Math.min(Math.abs(perf.vsCluster) * 2, 50) : 0}%`,
                              background: perf.isPositive 
                                ? `linear-gradient(90deg, #10B981dd, #10B981)` 
                                : `linear-gradient(90deg, #EF4444dd, #EF4444)`,
                              animationDelay: `${index * 100}ms`,
                              marginLeft: perf.isPositive ? '50%' : `${50 - Math.min(Math.abs(perf.vsCluster) * 2, 50)}%`,
                              justifyContent: perf.isPositive ? 'flex-end' : 'flex-start',
                              paddingLeft: perf.isPositive ? '0' : '8px',
                              paddingRight: perf.isPositive ? '8px' : '0'
                            }}
                          >
                            {perf.vsCluster > 0 ? '+' : ''}{perf.vsCluster}%
                          </div>
                        </div>
                        <div className="w-12 text-xs text-secondary-wh40k text-right">{perf.guildCount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}


            {/* Refresh Button */}
            <div className="text-center">
              <button 
                onClick={testConnection}
                className="btn-wh40k"
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
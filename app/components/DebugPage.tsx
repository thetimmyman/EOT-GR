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

export default function DebugPage({ selectedGuild, selectedSeason }: DebugPageProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [guilds, setGuilds] = useState<GuildConfig[]>([])
  const [clusterAverages, setClusterAverages] = useState<AverageData[]>([])
  const [guildAverages, setGuildAverages] = useState<AverageData[]>([])

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

      // Basic connection test
      const { data: testData, error } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, displayName, damageType, rarity, tier, set, Name, encounterId, remainingHp, damageDealt')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)  // Exclude last hits
        .limit(10)

      if (error) {
        setConnectionError(`Database error: ${error.message}`)
        console.error('🔧 Supabase error:', error)
        return
      }

      // Get comprehensive data for current season
      const { data: allData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, damageType, rarity, tier, set, Name, encounterId, remainingHp, damageDealt')
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .gte('tier', 4)
        .neq('remainingHp', 0)  // Exclude last hits
        .gt('damageDealt', 0)
        .limit(100000)

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

        setClusterAverages(clusterAvgs)
        setGuildAverages(guildAvgs)
        
        console.log('Cluster averages calculated:', clusterAvgs.length)
        console.log('Guild averages calculated:', guildAvgs.length)
      }

      // Get metadata about all data
      const { data: allMetaData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, damageType, rarity, tier, set')
        .limit(100000)

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
        guildCounts: Object.fromEntries(guildCounts)
      })

    } catch (err) {
      console.error('🔧 Connection failed:', err)
      setConnectionError(`Connection failed: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">🔧 Testing enhanced database connection...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg text-center">
        <h2 className="text-lg font-semibold text-blue-800">🔧 Enhanced Database Debug</h2>
        <p className="text-blue-600">Testing Supabase access and performance calculations</p>
      </div>

      {connectionError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-600 font-semibold mb-2">❌ Connection Failed</div>
          <div className="text-red-500 text-sm">{connectionError}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-800 font-semibold mb-2">✅ Connection Successful!</div>
            <div className="text-green-700 text-sm">Found {data?.totalRecords?.toLocaleString()} total records</div>
            <div className="text-green-700 text-sm">Found {data?.currentSeasonRecords?.toLocaleString()} records for Season {selectedSeason}</div>
          </div>

          {/* Guild Configuration */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">🏛️ Guild Configuration ({guilds.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {guilds.map((guild) => (
                <div key={guild.guild_code} className={`px-2 py-1 rounded text-sm text-center ${
                  guild.enabled 
                    ? (guild.guild_code === selectedGuild ? 'bg-blue-100 font-bold border-2 border-blue-300' : 'bg-green-100') 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className="font-medium">{guild.guild_code}</div>
                  <div className="text-xs">{guild.display_name}</div>
                  <div className="text-xs">{guild.enabled ? 'Active' : 'Disabled'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Guild Data Counts for Current Season */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">📊 Guild Data Counts (Season {selectedSeason})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(data?.guildCounts || {}).map(([guild, count]) => (
                <div key={guild} className={`px-2 py-1 rounded text-sm text-center ${
                  guild === selectedGuild ? 'bg-blue-100 font-bold border-2 border-blue-300' : 'bg-gray-100'
                }`}>
                  <div className="font-medium">{guild}</div>
                  <div className="text-xs">{(count as number).toLocaleString()} records</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cluster Averages Table */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">🌍 Cluster Averages (All Guilds) - Season {selectedSeason}</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full text-xs border">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border p-2 text-left">Boss</th>
                    <th className="border p-2 text-left">Token Usage</th>
                    <th className="border p-2 text-right">Hit Count</th>
                    <th className="border p-2 text-right">Average Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {clusterAverages.map((avg, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="border p-2 font-medium">{avg.bossName}</td>
                      <td className="border p-2">{avg.tokenUsage}</td>
                      <td className="border p-2 text-right">{avg.count.toLocaleString()}</td>
                      <td className="border p-2 text-right">{(avg.average / 1000).toFixed(0)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Guild Averages Table */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">🏛️ Guild Averages ({selectedGuild}) - Season {selectedSeason}</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full text-xs border">
                <thead className="bg-blue-50 sticky top-0">
                  <tr>
                    <th className="border p-2 text-left">Boss</th>
                    <th className="border p-2 text-left">Token Usage</th>
                    <th className="border p-2 text-right">Hit Count</th>
                    <th className="border p-2 text-right">Average Damage</th>
                    <th className="border p-2 text-right">vs Cluster</th>
                  </tr>
                </thead>
                <tbody>
                  {guildAverages.map((guildAvg, i) => {
                    const clusterAvg = clusterAverages.find(c => 
                      c.bossName === guildAvg.bossName && c.tokenUsage === guildAvg.tokenUsage
                    )
                    const vsCluster = clusterAvg && clusterAvg.average > 0 
                      ? ((guildAvg.average / clusterAvg.average) - 1) * 100 
                      : 0
                    
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-blue-25' : 'bg-white'}>
                        <td className="border p-2 font-medium">{guildAvg.bossName}</td>
                        <td className="border p-2">{guildAvg.tokenUsage}</td>
                        <td className="border p-2 text-right">{guildAvg.count.toLocaleString()}</td>
                        <td className="border p-2 text-right">{(guildAvg.average / 1000).toFixed(0)}K</td>
                        <td className={`border p-2 text-right font-medium ${
                          vsCluster > 0 ? 'text-green-600' : vsCluster < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {vsCluster > 0 ? '+' : ''}{vsCluster.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">📈 Available Seasons ({data?.seasons?.length})</h3>
              <div className="space-y-1">
                {data?.seasons?.map((season: string) => (
                  <div key={season} className={`px-2 py-1 rounded text-sm ${
                    season === selectedSeason ? 'bg-blue-100 font-bold' : 'bg-blue-50'
                  }`}>
                    Season {season}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">🎭 Rarity Values ({data?.rarities?.length})</h3>
              <div className="space-y-1">
                {data?.rarities?.map((rarity: string) => (
                  <div key={rarity} className={`px-2 py-1 rounded text-sm ${
                    rarity === 'Legendary' ? 'bg-yellow-100 font-bold' : 'bg-yellow-50'
                  }`}>
                    {rarity}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">⚔️ Damage Types ({data?.damageTypes?.length})</h3>
              <div className="space-y-1">
                {data?.damageTypes?.map((type: string) => (
                  <div key={type} className={`px-2 py-1 rounded text-sm ${
                    type === 'Battle' ? 'bg-red-100 font-bold' : 'bg-red-50'
                  }`}>
                    {type}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sample Data */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">📋 Sample Data (Season {selectedSeason})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2">Season</th>
                    <th className="border p-2">Guild</th>
                    <th className="border p-2">Player</th>
                    <th className="border p-2">Boss</th>
                    <th className="border p-2">Encounter</th>
                    <th className="border p-2">Damage</th>
                    <th className="border p-2">Remaining HP</th>
                    <th className="border p-2">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sample?.map((record: any, i: number) => (
                    <tr key={i}>
                      <td className="border p-2">{record.Season}</td>
                      <td className="border p-2">{record.Guild}</td>
                      <td className="border p-2">{record.displayName}</td>
                      <td className="border p-2">{record.Name}</td>
                      <td className="border p-2">{record.encounterId}</td>
                      <td className="border p-2">{(record.damageDealt / 1000).toFixed(0)}K</td>
                      <td className="border p-2">{record.remainingHp}</td>
                      <td className="border p-2">{record.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center">
            <button 
              onClick={testConnection}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Refresh Enhanced Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

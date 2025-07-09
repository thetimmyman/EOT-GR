'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface DebugPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function DebugPage({ selectedGuild, selectedSeason }: DebugPageProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      setLoading(true)
      setConnectionError(null)

      console.log('🔧 Testing basic connection...')

      // Simple test - just get a few records
      const { data: testData, error } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, displayName, damageType, rarity, tier, set, Name')
        .limit(5)

      if (error) {
        setConnectionError(`Database error: ${error.message}`)
        console.error('🔧 Supabase error:', error)
        return
      }

      // Get ALL records by using a high limit
      const { data: allData } = await supabase
        .from('EOT_GR_data')
        .select('Season, Guild, damageType, rarity, tier, set')
        .limit(100000) // Set high limit to get all records

      // Fix the TypeScript error by using Array.from instead of spread operator
      const seasons = Array.from(new Set(allData?.map(d => d.Season) || [])).sort()
      const guilds = Array.from(new Set(allData?.map(d => d.Guild) || [])).sort()
      const damageTypes = Array.from(new Set(allData?.map(d => d.damageType) || [])).sort()
      const rarities = Array.from(new Set(allData?.map(d => d.rarity) || [])).sort()
      const tiers = Array.from(new Set(allData?.map(d => d.tier) || [])).sort()
      const sets = Array.from(new Set(allData?.map(d => d.set) || [])).sort()

      setData({
        sample: testData,
        seasons,
        guilds,
        damageTypes,
        rarities,
        tiers,
        sets,
        totalRecords: allData?.length || 0
      })

      console.log('🔧 Connection successful!', {
        seasons,
        guilds,
        damageTypes,
        rarities
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
          <p className="mt-4">🔧 Testing database connection...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg text-center">
        <h2 className="text-lg font-semibold text-blue-800">🔧 Database Connection Test</h2>
        <p className="text-blue-600">Testing Supabase access and data structure</p>
      </div>

      {connectionError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800">❌ Connection Failed</h3>
          <p className="text-red-600">{connectionError}</p>
          <button 
            onClick={testConnection}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800">✅ Connection Successful!</h3>
            <p className="text-green-600">Found {data?.totalRecords} total records</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">📅 Available Seasons ({data?.seasons?.length})</h3>
              <div className="space-y-1">
                {data?.seasons?.map((season: string) => (
                  <div key={season} className="bg-blue-50 px-2 py-1 rounded text-sm">
                    Season {season}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">🏰 Available Guilds ({data?.guilds?.length})</h3>
              <div className="space-y-1">
                {data?.guilds?.map((guild: string) => (
                  <div key={guild} className="bg-purple-50 px-2 py-1 rounded text-sm">
                    {guild}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">💎 Rarity Values ({data?.rarities?.length})</h3>
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

          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">📋 Sample Data</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2">Season</th>
                    <th className="border p-2">Guild</th>
                    <th className="border p-2">Player</th>
                    <th className="border p-2">Damage Type</th>
                    <th className="border p-2">Rarity</th>
                    <th className="border p-2">Tier</th>
                    <th className="border p-2">Set</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sample?.map((record: any, i: number) => (
                    <tr key={i}>
                      <td className="border p-2">{record.Season}</td>
                      <td className="border p-2">{record.Guild}</td>
                      <td className="border p-2">{record.displayName}</td>
                      <td className="border p-2">{record.damageType}</td>
                      <td className="border p-2">{record.rarity}</td>
                      <td className="border p-2">{record.tier}</td>
                      <td className="border p-2">{record.set}</td>
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
              🔄 Refresh Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
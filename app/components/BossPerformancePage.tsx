'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
}

interface LapData {
  loopIndex: number
  bossTokens: number
  prime1Tokens: number
  prime2Tokens: number
  bossAvgDamage: number
  prime1AvgDamage: number
  prime2AvgDamage: number
}

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
  const [overallStats, setOverallStats] = useState({
    avgDamagePerHit: 0,
    totalBossTokens: 0,
    totalPrimeTokens: 0,
    totalTokens: 0,
    topDamagePlayer: '',
    topDamageAmount: 0,
    biggestHitPlayer: '',
    biggestHitAmount: 0
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
    
    // Correct filters: Legendary rarity, specific set, Battle damage
    const { data, error } = await supabase
      .from('EOT_GR_data')
      .select('*')
      .eq('Guild', selectedGuild)
      .eq('Season', selectedSeason)
      .eq('rarity', 'Legendary')
      .eq('set', level - 1)  // L1=0, L2=1, L3=2, L4=3, L5=4
      .eq('damageType', 'Battle')

    if (error) {
      console.error('Error fetching level data:', error)
      setLoading(false)
      return
    }

    if (data && data.length > 0) {
      setLevelData(data)
      
      // Extract boss names from the data
      const bossData = data.filter(d => d.encounterId === 0)
      const prime1Data = data.filter(d => d.encounterId === 1)
      const prime2Data = data.filter(d => d.encounterId === 2)
      
      // Get most common names for each encounter type
      const getBossName = (encounterData: any[]) => {
        const nameCount: {[key: string]: number} = {}
        encounterData.forEach(d => {
          nameCount[d.Name] = (nameCount[d.Name] || 0) + 1
        })
        return Object.entries(nameCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
      }
      
      setBossName(getBossName(bossData))
      setPrime1Name(getBossName(prime1Data))
      setPrime2Name(getBossName(prime2Data))
      
      // Filter out last hits for calculations
      const filteredData = data.filter(d => !isLastHit(d, data))
      
      // Calculate overall stats
      const totalDamage = filteredData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const avgDamagePerHit = filteredData.length > 0 ? totalDamage / filteredData.length : 0
      
      // Separate data by encounter type
      const filteredBossData = filteredData.filter(d => d.encounterId === 0)
      const filteredPrime1Data = filteredData.filter(d => d.encounterId === 1)
      const filteredPrime2Data = filteredData.filter(d => d.encounterId === 2)
      
      const totalBossTokens = filteredBossData.length
      const totalPrimeTokens = filteredPrime1Data.length + filteredPrime2Data.length
      const totalTokens = filteredData.length
      
      // Find biggest hit across all data (including last hits for this stat)
      const biggestHit = Math.max(...data.map(d => d.damageDealt || 0))
      const biggestHitEntry = data.find(d => d.damageDealt === biggestHit)
      
      // Calculate player stats for each encounter type
      const calculatePlayerStats = (encounterData: any[]) => {
        const playerData: {[key: string]: {
          totalDamage: number,
          tokenCount: number,
          biggestHit: number,
          hitCount: number,
          damageSum: number
        }} = {}
        
        encounterData.forEach(d => {
          const player = d.displayName
          if (!playerData[player]) {
            playerData[player] = { 
              totalDamage: 0, 
              tokenCount: 0, 
              biggestHit: 0,
              hitCount: 0,
              damageSum: 0
            }
          }
          
          playerData[player].damageSum += d.damageDealt || 0
          playerData[player].tokenCount += 1
          playerData[player].hitCount += 1
          playerData[player].biggestHit = Math.max(playerData[player].biggestHit, d.damageDealt || 0)
        })
        
        // Include total damage from all hits (including last hits) for each encounter type
        const allEncounterData = data.filter(d => 
          encounterData.length > 0 ? d.encounterId === encounterData[0].encounterId : false
        )
        allEncounterData.forEach(d => {
          const player = d.displayName
          if (playerData[player]) {
            playerData[player].totalDamage += d.damageDealt || 0
          }
        })

        return Object.entries(playerData)
          .map(([name, stats]) => ({
            displayName: name,
            avgDamage: stats.hitCount > 0 ? stats.damageSum / stats.hitCount : 0,
            totalDamage: stats.totalDamage,
            tokenCount: stats.tokenCount,
            biggestHit: stats.biggestHit,
            hitCount: stats.hitCount
          }))
          .sort((a, b) => b.avgDamage - a.avgDamage)
      }

      // Calculate stats for each encounter type
      setBossPlayerStats(calculatePlayerStats(filteredBossData))
      setPrime1PlayerStats(calculatePlayerStats(filteredPrime1Data))
      setPrime2PlayerStats(calculatePlayerStats(filteredPrime2Data))

      // Find top damage player across all encounters
      const allPlayerStats = calculatePlayerStats(filteredData)
      const topDamagePlayer = allPlayerStats.reduce((prev, current) => 
        current.totalDamage > prev.totalDamage ? current : prev
      )

      // Calculate lap data (tokens per loopIndex with stacked data)
      const lapMap: {[key: number]: {
        bossTokens: number, 
        prime1Tokens: number, 
        prime2Tokens: number,
        bossDamageSum: number,
        prime1DamageSum: number,
        prime2DamageSum: number,
        bossHitCount: number,
        prime1HitCount: number,
        prime2HitCount: number
      }} = {}
      
      filteredData.forEach(d => {
        const lap = d.loopIndex
        if (!lapMap[lap]) {
          lapMap[lap] = { 
            bossTokens: 0, 
            prime1Tokens: 0, 
            prime2Tokens: 0,
            bossDamageSum: 0,
            prime1DamageSum: 0,
            prime2DamageSum: 0,
            bossHitCount: 0,
            prime1HitCount: 0,
            prime2HitCount: 0
          }
        }
        
        if (d.encounterId === 0) {
          lapMap[lap].bossTokens += 1
          lapMap[lap].bossDamageSum += d.damageDealt || 0
          lapMap[lap].bossHitCount += 1
        } else if (d.encounterId === 1) {
          lapMap[lap].prime1Tokens += 1
          lapMap[lap].prime1DamageSum += d.damageDealt || 0
          lapMap[lap].prime1HitCount += 1
        } else if (d.encounterId === 2) {
          lapMap[lap].prime2Tokens += 1
          lapMap[lap].prime2DamageSum += d.damageDealt || 0
          lapMap[lap].prime2HitCount += 1
        }
      })

      const lapDataArray = Object.entries(lapMap)
        .map(([lap, stats]) => ({
          loopIndex: parseInt(lap),
          bossTokens: stats.bossTokens,
          prime1Tokens: stats.prime1Tokens,
          prime2Tokens: stats.prime2Tokens,
          bossAvgDamage: stats.bossHitCount > 0 ? stats.bossDamageSum / stats.bossHitCount : 0,
          prime1AvgDamage: stats.prime1HitCount > 0 ? stats.prime1DamageSum / stats.prime1HitCount : 0,
          prime2AvgDamage: stats.prime2HitCount > 0 ? stats.prime2DamageSum / stats.prime2HitCount : 0
        }))
        .sort((a, b) => a.loopIndex - b.loopIndex)

      setOverallStats({
        avgDamagePerHit,
        totalBossTokens,
        totalPrimeTokens,
        totalTokens,
        topDamagePlayer: topDamagePlayer?.displayName || '',
        topDamageAmount: topDamagePlayer?.totalDamage || 0,
        biggestHitPlayer: biggestHitEntry?.displayName || '',
        biggestHitAmount: biggestHit
      })
      
      setLapData(lapDataArray)
    }
    
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <div className="spinner-modern w-8 h-8"></div>
      </div>
    )
  }

  // Show message if no guild or season selected
  if (!selectedGuild || !selectedSeason) {
    return (
      <div className="container-modern py-16">
        <div className="text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="heading-secondary mb-2">Select Guild and Season</h2>
          <p className="text-secondary">Please select both a guild and season from the dropdown menus above to view L{level} boss analysis.</p>
        </div>
      </div>
    )
  }

  // Show message if no data found
  if (levelData.length === 0) {
    return (
      <div className="container-modern py-16">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="heading-secondary mb-2">No L{level} Data Found</h2>
          <p className="text-secondary">No data found for {selectedGuild} guild in Season {selectedSeason} at Level {level}.</p>
        </div>
      </div>
    )
  }

  const maxTokensPerLap = Math.max(...lapData.map(l => l.bossTokens + l.prime1Tokens + l.prime2Tokens))

  return (
    <div className="container-modern py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gradient mb-3">
          L{level} {bossName || 'Boss Analysis'}
        </h2>
        <p className="text-secondary font-medium">
          Season {selectedSeason} • {selectedGuild} Guild • Level {level} Combat Data
        </p>
        {/* Filter Indicator */}
        <div className="mt-2 text-sm text-muted">
          Legendary Tier Only • No Last Hits • No Bombs • Battles per Boss
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid-stats">
        <div className="stat-card bg-accent-blue">
          <div className="stat-display accent-blue">
            {(overallStats.avgDamagePerHit / 1000000).toFixed(2)}M
          </div>
          <div className="text-xs text-secondary font-semibold">Avg Damage/Hit</div>
        </div>
        <div className="stat-card bg-accent-green">
          <div className="stat-display accent-green">
            {overallStats.totalBossTokens}
          </div>
          <div className="text-xs text-secondary font-semibold">Total Boss Tokens</div>
        </div>
        <div className="stat-card bg-accent-purple">
          <div className="stat-display accent-purple">
            {overallStats.totalPrimeTokens}
          </div>
          <div className="text-xs text-secondary font-semibold">Total Prime Tokens</div>
        </div>
        <div className="stat-card bg-accent-orange">
          <div className="stat-display accent-orange">
            {overallStats.totalTokens}
          </div>
          <div className="text-xs text-secondary font-semibold">Total Tokens</div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-elevated p-6">
          <h3 className="font-bold text-secondary text-lg mb-4 flex items-center">
            🏆 Top Total Damage
          </h3>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 mb-2">
              {overallStats.topDamagePlayer}
            </div>
            <div className="stat-display accent-warning">
              {(overallStats.topDamageAmount / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h3 className="font-bold text-secondary text-lg mb-4 flex items-center">
            💥 Biggest Single Hit
          </h3>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 mb-2">
              {overallStats.biggestHitPlayer}
            </div>
            <div className="stat-display accent-red">
              {(overallStats.biggestHitAmount / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>
      </div>

      {/* Tokens Per Lap Stacked Chart */}
      <div className="card-elevated p-6">
        <h3 className="font-bold text-secondary text-lg mb-4">
          📊 Tokens Per Lap (Stacked)
        </h3>
        <div className="space-y-3">
          {lapData.map((lap) => {
            const totalTokens = lap.bossTokens + lap.prime1Tokens + lap.prime2Tokens
            const bossPercent = totalTokens > 0 ? (lap.bossTokens / maxTokensPerLap) * 100 : 0
            const prime1Percent = totalTokens > 0 ? (lap.prime1Tokens / maxTokensPerLap) * 100 : 0
            const prime2Percent = totalTokens > 0 ? (lap.prime2Tokens / maxTokensPerLap) * 100 : 0
            
            return (
              <div key={lap.loopIndex} className="flex items-center space-x-4">
                <div className="w-12 text-center text-sm font-mono text-secondary font-semibold">
                  L{lap.loopIndex + 1}
                </div>
                <div className="flex-1">
                  <div className="progress-bar h-6 relative flex rounded-lg overflow-hidden">
                    {/* Boss tokens - blue */}
                    <div 
                      className="bg-blue-500 h-6 flex items-center justify-center text-xs font-mono text-white"
                      style={{ width: `${bossPercent}%` }}
                    >
                      {lap.bossTokens > 0 && lap.bossTokens}
                    </div>
                    {/* Prime 1 tokens - green */}
                    <div 
                      className="bg-green-500 h-6 flex items-center justify-center text-xs font-mono text-white"
                      style={{ width: `${prime1Percent}%` }}
                    >
                      {lap.prime1Tokens > 0 && lap.prime1Tokens}
                    </div>
                    {/* Prime 2 tokens - purple */}
                    <div 
                      className="bg-purple-500 h-6 flex items-center justify-center text-xs font-mono text-white"
                      style={{ width: `${prime2Percent}%` }}
                    >
                      {lap.prime2Tokens > 0 && lap.prime2Tokens}
                    </div>
                  </div>
                </div>
                <div className="w-20 text-right text-sm font-mono text-secondary font-semibold">
                  {totalTokens}
                </div>
              </div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="mt-4 flex justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-secondary">{bossName || 'Boss'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-secondary">{prime1Name || 'Prime 1'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-secondary">{prime2Name || 'Prime 2'}</span>
          </div>
        </div>
      </div>

      {/* Boss Rankings */}
      {bossPlayerStats.length > 0 && (
        <div className="card-elevated p-6">
          <h3 className="font-bold text-secondary text-lg mb-4">
            ⚔️ {bossName || 'Boss'} Rankings - Average Damage
          </h3>
          
          <div className="space-y-3">
            {bossPlayerStats.slice(0, 15).map((player, index) => (
              <div key={player.displayName} className="player-card hover-lift">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold accent-blue w-8">#{index + 1}</span>
                    <div>
                      <div className="font-semibold text-sm text-primary">{player.displayName}</div>
                      <div className="text-xs text-secondary font-mono">{player.hitCount} hits</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-display accent-blue">
                      {(player.avgDamage / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-xs text-muted">avg damage</div>
                  </div>
                </div>
                
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-mono accent-cyan">{(player.totalDamage / 1000000).toFixed(1)}M</div>
                    <div className="text-secondary">Total DMG</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-blue">{player.tokenCount}</div>
                    <div className="text-secondary">Tokens</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-red">{(player.biggestHit / 1000000).toFixed(2)}M</div>
                    <div className="text-secondary">Best Hit</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prime 1 Rankings */}
      {prime1PlayerStats.length > 0 && (
        <div className="card-elevated p-6">
          <h3 className="font-bold text-secondary text-lg mb-4">
            🎯 {prime1Name || 'Prime 1'} Rankings - Average Damage
          </h3>
          
          <div className="space-y-3">
            {prime1PlayerStats.slice(0, 15).map((player, index) => (
              <div key={player.displayName} className="player-card hover-lift">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold accent-green w-8">#{index + 1}</span>
                    <div>
                      <div className="font-semibold text-sm text-primary">{player.displayName}</div>
                      <div className="text-xs text-secondary font-mono">{player.hitCount} hits</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-display accent-green">
                      {(player.avgDamage / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-xs text-muted">avg damage</div>
                  </div>
                </div>
                
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-mono accent-cyan">{(player.totalDamage / 1000000).toFixed(1)}M</div>
                    <div className="text-secondary">Total DMG</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-green">{player.tokenCount}</div>
                    <div className="text-secondary">Tokens</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-red">{(player.biggestHit / 1000000).toFixed(2)}M</div>
                    <div className="text-secondary">Best Hit</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prime 2 Rankings */}
      {prime2PlayerStats.length > 0 && (
        <div className="card-elevated p-6">
          <h3 className="font-bold text-secondary text-lg mb-4">
            🔥 {prime2Name || 'Prime 2'} Rankings - Average Damage
          </h3>
          
          <div className="space-y-3">
            {prime2PlayerStats.slice(0, 15).map((player, index) => (
              <div key={player.displayName} className="player-card hover-lift">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold accent-purple w-8">#{index + 1}</span>
                    <div>
                      <div className="font-semibold text-sm text-primary">{player.displayName}</div>
                      <div className="text-xs text-secondary font-mono">{player.hitCount} hits</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-display accent-purple">
                      {(player.avgDamage / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-xs text-muted">avg damage</div>
                  </div>
                </div>
                
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-mono accent-cyan">{(player.totalDamage / 1000000).toFixed(1)}M</div>
                    <div className="text-secondary">Total DMG</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-purple">{player.tokenCount}</div>
                    <div className="text-secondary">Tokens</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono accent-red">{(player.biggestHit / 1000000).toFixed(2)}M</div>
                    <div className="text-secondary">Best Hit</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
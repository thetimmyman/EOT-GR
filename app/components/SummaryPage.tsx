'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface SummaryPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface BossTokenUsage {
  bossName: string
  tokensUsed: number
  percentage: number
  avgPerLoop: number
}

export default function SummaryPage({ selectedGuild, selectedSeason }: SummaryPageProps) {
  const [stats, setStats] = useState({
    completedLoops: 0,
    totalDamage: 0,
    totalTokens: 0,
    totalBombs: 0,
    avgDamagePerPrime: 0,
    tokensPerLoop: 0,
    tokensPerBossPerLoop: 0
  })
  const [bossAverages, setBossAverages] = useState<{[key: string]: number}>({})
  const [bossTokenUsage, setBossTokenUsage] = useState<BossTokenUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      fetchSummaryData()
    }
  }, [selectedGuild, selectedSeason])

  const fetchSummaryData = async () => {
    setLoading(true)
    
    // Get battle data with PROPER filters
    const { data: battleData } = await supabase
      .from('EOT_GR_data')
      .select('*')
      .eq('Guild', selectedGuild)
      .eq('Season', selectedSeason)
      .eq('damageType', 'Battle')
      .eq('rarity', 'Legendary')        // ✅ ADDED
      .gte('tier', 4)                   // ✅ ADDED

    // Get bomb data with proper filters
    const { data: bombData } = await supabase
      .from('EOT_GR_data')
      .select('damageDealt')
      .eq('Guild', selectedGuild)
      .eq('Season', selectedSeason)
      .eq('damageType', 'Bomb')
      .eq('rarity', 'Legendary')        // ✅ ADDED
      .gte('tier', 4)                   // ✅ ADDED

    if (battleData) {
      const maxLoop = Math.max(...battleData.map(d => d.loopIndex || 0))
      const completedLoops = maxLoop + 1
      const totalDamage = battleData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
      const totalBombDamage = bombData?.reduce((sum, d) => sum + (d.damageDealt || 0), 0) || 0
      const totalTokens = battleData.length
      
      // Calculate prime damage average
      const primeData = battleData.filter(d => d.encounterId > 0)
      const avgDamagePerPrime = primeData.length > 0 ? 
        primeData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / primeData.length : 0

      // Calculate tokens per loop
      const tokensPerLoop = completedLoops > 0 ? totalTokens / completedLoops : 0

      // DYNAMIC: Get unique boss names from the data
      const mainBossData = battleData.filter(d => d.encounterId === 0) // Main bosses only
      const uniqueBosses = [...new Set(mainBossData.map(d => d.Name))].filter(Boolean)
      
      // Calculate boss averages and token usage dynamically
      const bossAvg: {[key: string]: number} = {}
      const bossTokenData: BossTokenUsage[] = []
      const bossTokenCounts: {[key: string]: number} = {}
      
      // Process each unique boss found in the data
      uniqueBosses.forEach(bossName => {
        const bossData = battleData.filter(d => 
          d.Name === bossName && d.encounterId === 0 // Main boss only
        )
        
        if (bossData.length > 0) {
          // Create display name with set level (L1, L2, etc.)
          const setLevel = bossData[0]?.set !== undefined ? `L${parseInt(bossData[0].set) + 1} ` : ''
          const displayName = `${setLevel}${bossName}`
          
          bossAvg[displayName] = bossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / bossData.length
          bossTokenCounts[displayName] = bossData.length
        }
      })

      // Add prime tokens
      const primeTokens = primeData.length
      if (primeTokens > 0) {
        bossTokenCounts['Primes'] = primeTokens
      }

      // Calculate percentages and per-loop averages
      Object.entries(bossTokenCounts).forEach(([boss, tokens]) => {
        const percentage = totalTokens > 0 ? (tokens / totalTokens) * 100 : 0
        const avgPerLoop = completedLoops > 0 ? tokens / completedLoops : 0
        
        bossTokenData.push({
          bossName: boss,
          tokensUsed: tokens,
          percentage,
          avgPerLoop
        })
      })

      // Sort by token usage
      bossTokenData.sort((a, b) => b.tokensUsed - a.tokensUsed)

      // Calculate tokens per boss per loop (average across all main bosses)
      const mainBossTokens = battleData.filter(d => d.encounterId === 0).length
      const tokensPerBossPerLoop = completedLoops > 0 && uniqueBosses.length > 0 ? 
        mainBossTokens / (completedLoops * uniqueBosses.length) : 0

      setStats({
        completedLoops,
        totalDamage,
        totalTokens,
        totalBombs: bombData?.length || 0,
        avgDamagePerPrime,
        tokensPerLoop,
        tokensPerBossPerLoop
      })
      setBossAverages(bossAvg)
      setBossTokenUsage(bossTokenData)
    }
    
    setLoading(false)
  }

  // Show message if no guild or season selected
  if (!selectedGuild || !selectedSeason) {
    return (
      <div className="container-modern py-8 sm:py-16">
        <div className="text-center">
          <div className="text-4xl sm:text-6xl mb-4">⚙️</div>
          <h2 className="heading-secondary mb-2">Select Guild and Season</h2>
          <p className="text-secondary">Please select both a guild and season from the dropdown menus above to view the summary.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-modern py-8 sm:py-16">
        <div className="flex flex-col items-center justify-center">
          <div className="spinner-modern w-8 h-8 mb-4"></div>
          <p className="text-secondary">Loading guild raid data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container-modern py-2 sm:py-3 space-y-2 sm:space-y-3">
      {/* Header - More Compact */}
      <div className="text-center">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-0.5">Guild Raid Summary</h2>
        <p className="text-xs text-secondary">Season {selectedSeason} - {selectedGuild}</p>
        <p className="text-xs text-muted">Legendary Tier Only (Tier 4+)</p>
      </div>

      {/* Main Stats - Responsive Grid */}
      <div className="grid-stats">
        <div className="stat-card bg-accent-blue">
          <div className="stat-display accent-blue">{stats.completedLoops}</div>
          <div className="text-xs font-semibold text-secondary">Completed Loops</div>
        </div>
        <div className="stat-card bg-accent-green">
          <div className="stat-display accent-green">{(stats.totalDamage / 1000000).toFixed(0)}M</div>
          <div className="text-xs font-semibold text-secondary">Total Damage</div>
        </div>
        <div className="stat-card bg-accent-purple">
          <div className="stat-display accent-purple">{stats.totalTokens}</div>
          <div className="text-xs font-semibold text-secondary">Total Tokens</div>
        </div>
        <div className="stat-card bg-accent-orange">
          <div className="stat-display accent-orange">{stats.totalBombs}</div>
          <div className="text-xs font-semibold text-secondary">Bombs Dropped</div>
        </div>
      </div>

      {/* Token Usage Analysis - More Compact */}
      <div className="card-modern p-2 sm:p-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">Token Usage Analysis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="stat-card-compact bg-accent-blue">
            <div className="stat-display-compact accent-blue">{stats.tokensPerLoop.toFixed(1)}</div>
            <div className="text-xs font-medium text-secondary">Tokens per Loop</div>
          </div>
          <div className="stat-card-compact bg-accent-cyan">
            <div className="stat-display-compact accent-cyan">{stats.tokensPerBossPerLoop.toFixed(1)}</div>
            <div className="text-xs font-medium text-secondary">Tokens per Boss per Loop</div>
          </div>
        </div>
      </div>

      {/* Prime Performance - More Compact */}
      <div className="card-modern p-2 sm:p-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">Prime Performance</h3>
        <div className="stat-card-compact bg-accent-red">
          <div className="stat-display-compact accent-red">{(stats.avgDamagePerPrime / 1000000).toFixed(2)}M</div>
          <div className="text-xs font-medium text-secondary">Average Damage per Prime</div>
        </div>
      </div>

      {/* Boss Token Distribution - More Compact */}
      <div className="card-modern p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-2">Token Distribution by Boss</h3>
        <div className="space-y-2">
          {bossTokenUsage.map((boss) => (
            <div key={boss.bossName} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium text-primary text-xs sm:text-sm">{boss.bossName}</span>
                <div className="text-right">
                  <span className="stat-display-compact text-primary">{boss.tokensUsed}</span>
                  <div className="text-xs text-muted">({boss.percentage.toFixed(1)}%)</div>
                </div>
              </div>
              
              {/* Modern Progress Bar */}
              <div className="progress-modern">
                <div 
                  className="progress-fill"
                  style={{ width: `${boss.percentage}%` }}
                />
              </div>
              
              <div className="text-xs text-muted text-right">
                {boss.avgPerLoop.toFixed(1)} per loop
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Boss Averages - More Compact */}
      <div className="card-modern p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-2">Average Boss Damage</h3>
        <div className="space-y-1">
          {Object.entries(bossAverages)
            .filter(([_, avg]) => avg > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([boss, avg]) => (
            <div key={boss} className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
              <span className="font-medium text-primary text-xs sm:text-sm">{boss}</span>
              <span className="stat-display-compact accent-blue">{(avg / 1000000).toFixed(2)}M</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Summary - More Compact */}
      <div className="card-modern p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-2">Performance Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="stat-card-compact">
            <div className="text-xs font-semibold text-secondary mb-0.5">Avg per Token</div>
            <div className="stat-display-compact accent-blue">{stats.totalTokens > 0 ? ((stats.totalDamage / stats.totalTokens) / 1000).toFixed(0) : 0}K</div>
          </div>
          <div className="stat-card-compact">
            <div className="text-xs font-semibold text-secondary mb-0.5">Loops Done</div>
            <div className="stat-display-compact accent-green">{stats.completedLoops}</div>
          </div>
          <div className="stat-card-compact">
            <div className="text-xs font-semibold text-secondary mb-0.5">Bombs/Loop</div>
            <div className="stat-display-compact accent-orange">{stats.completedLoops > 0 ? (stats.totalBombs / stats.completedLoops).toFixed(1) : 0}</div>
          </div>
          <div className="stat-card-compact">
            <div className="text-xs font-semibold text-secondary mb-0.5">Battle Efficiency</div>
            <div className="stat-display-compact accent-purple">{stats.completedLoops > 0 ? ((stats.totalDamage / 1000000) / stats.completedLoops).toFixed(1) : 0}M/loop</div>
          </div>
        </div>
      </div>
    </div>
  )
}
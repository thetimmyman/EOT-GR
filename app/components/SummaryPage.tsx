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
      const bossNamesSet = new Set(mainBossData.map(d => d.Name))
      const uniqueBosses = Array.from(bossNamesSet).filter(Boolean)
      
      // Calculate boss averages and token usage dynamically
      const bossAvg: {[key: string]: number} = {}
      const bossTokens: BossTokenUsage[] = []
      
      uniqueBosses.forEach(bossName => {
        const bossData = battleData.filter(d => d.Name === bossName)
        const bossTokenCount = bossData.length
        const totalBossDamage = bossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0)
        
        bossAvg[bossName] = bossTokenCount > 0 ? totalBossDamage / bossTokenCount : 0
        
        bossTokens.push({
          bossName,
          tokensUsed: bossTokenCount,
          percentage: totalTokens > 0 ? (bossTokenCount / totalTokens) * 100 : 0,
          avgPerLoop: completedLoops > 0 ? bossTokenCount / completedLoops : 0
        })
      })

      // Tokens per boss per loop
      const tokensPerBossPerLoop = completedLoops > 0 && uniqueBosses.length > 0 ? 
        totalTokens / (completedLoops * uniqueBosses.length) : 0

      setStats({
        completedLoops,
        totalDamage: totalDamage + totalBombDamage,
        totalTokens,
        totalBombs: bombData?.length || 0,
        avgDamagePerPrime,
        tokensPerLoop,
        tokensPerBossPerLoop
      })

      setBossAverages(bossAvg)
      setBossTokenUsage(bossTokens.sort((a, b) => b.tokensUsed - a.tokensUsed))
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

  return (
    <div className="container-modern py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gradient mb-3">
          Guild Raid Summary
        </h2>
        <p className="text-secondary font-medium">
          Season {selectedSeason} • {selectedGuild} Performance Overview
        </p>
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
                  className="progress-fill-gradient"
                  style={{ width: `${boss.percentage}%` }}
                />
              </div>
              
              <div className="text-xs text-muted">
                Avg: {boss.avgPerLoop.toFixed(1)} per loop
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Boss Performance Averages */}
      <div className="card-modern p-4">
        <h3 className="text-lg font-semibold text-primary mb-4">Boss Damage Averages</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(bossAverages)
            .sort(([,a], [,b]) => b - a)
            .map(([boss, avg]) => (
              <div key={boss} className="card-modern p-3 hover-lift">
                <div className="text-sm font-medium text-primary mb-1">{boss}</div>
                <div className="stat-display-compact accent-warning">
                  {(avg / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-muted">avg per token</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

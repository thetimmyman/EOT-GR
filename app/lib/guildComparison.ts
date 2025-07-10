// Guild comparison logic verification and debugging utilities
import { CalculatedData } from './calculations'

export interface GuildComparisonDebugInfo {
  bossName: string
  overallTokenUseage: string
  playerName: string
  playerAvg: number
  clusterAvg: number
  guildAvg: number
  vsClusterPct: number
  vsGuildPct: number
  sampleSize: {
    player: number
    cluster: number
    guild: number
  }
}

/**
 * Verify guild comparison logic matches PowerBI DAX measures
 * This function helps debug comparison calculations
 */
export function verifyGuildComparisons(
  playerData: CalculatedData[],
  clusterData: CalculatedData[],
  guildData: CalculatedData[],
  selectedGuild: string,
  selectedPlayer: string
): GuildComparisonDebugInfo[] {
  const results: GuildComparisonDebugInfo[] = []

  // Group player data by boss and overallTokenUseage
  const playerGroups = new Map<string, CalculatedData[]>()
  playerData.forEach(d => {
    const key = `${d.Name}_${d.overallTokenUseage}`
    if (!playerGroups.has(key)) {
      playerGroups.set(key, [])
    }
    playerGroups.get(key)!.push(d)
  })

  // For each player boss/token group, calculate comparisons
  playerGroups.forEach((playerEntries, key) => {
    const [bossName, tokenUseage] = key.split('_')
    
    // Filter data for this specific boss/token combination
    const clusterBossData = clusterData.filter(d => 
      d.Name === bossName && 
      d.overallTokenUseage === tokenUseage &&
      d.SpecialCases !== 'Last Hit' && 
      d.SpecialCases !== 'Crash'
    )
    
    const guildBossData = guildData.filter(d => 
      d.Name === bossName && 
      d.overallTokenUseage === tokenUseage &&
      d.SpecialCases !== 'Last Hit' && 
      d.SpecialCases !== 'Crash'
    )
    
    const playerBossData = playerEntries.filter(d => 
      d.SpecialCases !== 'Last Hit' && 
      d.SpecialCases !== 'Crash'
    )

    if (playerBossData.length >= 2) { // Only include if player has enough data
      const playerAvg = playerBossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / playerBossData.length
      const clusterAvg = clusterBossData.length > 0 ? 
        clusterBossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / clusterBossData.length : 0
      const guildAvg = guildBossData.length > 0 ? 
        guildBossData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / guildBossData.length : 0

      const vsClusterPct = clusterAvg > 0 ? ((playerAvg / clusterAvg) - 1) * 100 : 0
      const vsGuildPct = guildAvg > 0 ? ((playerAvg / guildAvg) - 1) * 100 : 0

      results.push({
        bossName,
        overallTokenUseage: tokenUseage,
        playerName: selectedPlayer,
        playerAvg,
        clusterAvg,
        guildAvg,
        vsClusterPct,
        vsGuildPct,
        sampleSize: {
          player: playerBossData.length,
          cluster: clusterBossData.length,
          guild: guildBossData.length
        }
      })
    }
  })

  return results
}

/**
 * Debug function to log guild comparison calculations
 */
export function logGuildComparisonDebug(debugInfo: GuildComparisonDebugInfo[]): void {
  console.log('Guild Comparison Debug Info:')
  console.table(debugInfo.map(info => ({
    Boss: `${info.bossName} (${info.overallTokenUseage})`,
    Player: info.playerName,
    'Player Avg': `${(info.playerAvg / 1000).toFixed(0)}K`,
    'Cluster Avg': `${(info.clusterAvg / 1000).toFixed(0)}K`,
    'Guild Avg': `${(info.guildAvg / 1000).toFixed(0)}K`,
    'vs Cluster': `${info.vsClusterPct > 0 ? '+' : ''}${info.vsClusterPct.toFixed(1)}%`,
    'vs Guild': `${info.vsGuildPct > 0 ? '+' : ''}${info.vsGuildPct.toFixed(1)}%`,
    'Sample Sizes': `P:${info.sampleSize.player} C:${info.sampleSize.cluster} G:${info.sampleSize.guild}`
  })))
}

/**
 * Validate that guild comparisons match PowerBI DAX logic
 */
export function validateGuildComparisons(debugInfo: GuildComparisonDebugInfo[]): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  debugInfo.forEach(info => {
    // Check for reasonable sample sizes
    if (info.sampleSize.cluster < 10) {
      issues.push(`${info.bossName}: Low cluster sample size (${info.sampleSize.cluster})`)
    }
    
    if (info.sampleSize.guild < 5) {
      issues.push(`${info.bossName}: Low guild sample size (${info.sampleSize.guild})`)
    }

    // Check for reasonable comparison values
    if (Math.abs(info.vsClusterPct) > 300) {
      issues.push(`${info.bossName}: Extreme cluster comparison (${info.vsClusterPct.toFixed(1)}%)`)
    }
    
    if (Math.abs(info.vsGuildPct) > 300) {
      issues.push(`${info.bossName}: Extreme guild comparison (${info.vsGuildPct.toFixed(1)}%)`)
    }

    // Check that averages are reasonable
    if (info.clusterAvg === 0) {
      issues.push(`${info.bossName}: Zero cluster average`)
    }
    
    if (info.guildAvg === 0) {
      issues.push(`${info.bossName}: Zero guild average`)
    }
  })

  return {
    isValid: issues.length === 0,
    issues
  }
}
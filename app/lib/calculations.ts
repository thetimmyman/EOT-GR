// PowerBI DAX calculations reimplemented in TypeScript
// Based on the DAX measures provided in CLAUDE.md

import { GuildRaidData } from './supabase'

// Helper type for calculated fields
export interface CalculatedData extends GuildRaidData {
  Bosses?: string
  overallTokenUseage?: string
  SpecialCases?: string
  WeightedContribution?: number
  Index_SeasonLoopBoss?: number
  PlayerTokenInd?: number
}

/**
 * Calculate the Bosses field
 * Bosses = IF(tier >= 4, CONCATENATE("L", set + 1, " ", Name), "non-leg")
 */
export function calculateBosses(data: GuildRaidData): string {
  if (data.tier >= 4) {
    // Convert set to number, add 1, then concatenate
    const setNumber = parseInt(data.set?.toString() || '0', 10)
    return `L${setNumber + 1} ${data.Name}`
  }
  return 'non-leg'
}

/**
 * Calculate the overallTokenUseage field
 * overallTokenUseage = IF(tier >= 4, IF(encounterId = 0, Bosses, "Leg. Primes"), "Non-Leg.")
 */
export function calculateOverallTokenUseage(data: GuildRaidData): string {
  if (data.tier >= 4) {
    if (data.encounterId === 0) {
      return calculateBosses(data)
    }
    return 'Leg. Primes'
  }
  return 'Non-Leg.'
}

/**
 * Calculate SpecialCases field
 * Determines if a hit is "Last Hit", "One Shot", "Standard", or "Crash"
 */
export function calculateSpecialCases(
  currentData: GuildRaidData,
  allData: GuildRaidData[]
): string {
  // Handle null/undefined damage
  if (!currentData.damageDealt || currentData.damageDealt === 0) {
    return 'Crash'
  }

  const loop = currentData.loopIndex
  const boss = currentData.Name
  const tier = currentData.tier
  const season = currentData.Season
  const currentRemainingHp = currentData.remainingHp

  // Filter data for this specific boss encounter
  const encounterData = allData.filter(d => 
    d.loopIndex === loop &&
    d.Name === boss &&
    d.tier === tier &&
    d.Season === season
  )

  // Find minimum remaining HP (the finishing blow)
  const minRemainingHp = Math.min(...encounterData.map(d => d.remainingHp || 0))

  // Count total hits for this encounter
  const totalHits = encounterData.length

  // Determine if this is a last hit (minimum remaining HP AND Battle damage type)
  const isLastHit = currentRemainingHp === minRemainingHp && currentData.damageType === 'Battle'

  // Determine if this is a one shot (last hit with only 1 total hit)
  const isOneShot = isLastHit && totalHits === 1

  // Return the appropriate classification
  if (isOneShot) {
    return 'One Shot'
  } else if (isLastHit) {
    return 'Last Hit'
  } else {
    return 'Standard'
  }
}

/**
 * Calculate WeightedContribution
 * Complex calculation involving RMS, seasonal averages, and modifiers
 */
export function calculateWeightedContribution(
  currentData: CalculatedData,
  allData: CalculatedData[]
): number {
  const season = currentData.Season
  const boss = currentData.Name
  const specialCases = currentData.SpecialCases || 'Standard'
  const tier = currentData.tier
  const damageDealt = currentData.damageDealt || 0

  // Filter for RMS calculation (exclude last hits, battle damage only)
  const rmsData = allData.filter(d => 
    d.Season === season &&
    d.Name === boss &&
    d.SpecialCases !== 'Last Hit' &&
    d.damageType === 'Battle'
  )

  // Calculate RMS (Root Mean Square) for this season/boss
  const rmsPerSeasonPerBoss = rmsData.length > 0 ? 
    Math.sqrt(rmsData.reduce((sum, d) => sum + Math.pow(d.damageDealt || 0, 2), 0) / rmsData.length) : 0

  // Filter for season average calculation
  const seasonData = allData.filter(d => 
    d.Season === season &&
    d.SpecialCases !== 'Last Hit' &&
    d.damageType === 'Battle'
  )

  // Calculate season average
  const seasonAvg = seasonData.length > 0 ?
    seasonData.reduce((sum, d) => sum + (d.damageDealt || 0), 0) / seasonData.length : 0

  // Calculate weight value
  const weightValue = rmsPerSeasonPerBoss === 0 ? 0.01 : (seasonAvg / rmsPerSeasonPerBoss) + 0.01

  // Apply modifier based on special cases
  let modifier = 1
  if (specialCases === 'Last Hit') {
    modifier = 1.25
  } else if (specialCases === 'One Shot') {
    modifier = 1.5
  }

  // Final calculation
  let result: number
  if (tier < 4) {
    result = seasonAvg
  } else {
    result = damageDealt * weightValue * modifier
  }

  return result
}

/**
 * Add calculated fields to raw data
 */
export function addCalculatedFields(data: GuildRaidData[]): CalculatedData[] {
  // First pass: add basic calculated fields
  const withBasicFields = data.map(item => ({
    ...item,
    Bosses: calculateBosses(item),
    overallTokenUseage: calculateOverallTokenUseage(item),
  }))

  // Second pass: add fields that depend on the full dataset
  const withSpecialCases = withBasicFields.map(item => ({
    ...item,
    SpecialCases: calculateSpecialCases(item, data),
  }))

  // Third pass: add weighted contribution (depends on special cases)
  const withWeightedContribution = withSpecialCases.map(item => ({
    ...item,
    WeightedContribution: calculateWeightedContribution(item, withSpecialCases),
  }))

  return withWeightedContribution
}

/**
 * Calculate PowerBI-style indexing
 * This replicates the complex grouping and indexing logic from PowerBI
 */
export function addPowerBIIndexing(data: CalculatedData[]): CalculatedData[] {
  // Sort by startedOn date in descending order (like PowerBI)
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a.startedOn || 0)
    const dateB = new Date(b.startedOn || 0)
    return dateB.getTime() - dateA.getTime()
  })

  // Group by Guild/Season/loopIndex/Name and add Index_SeasonLoopBoss
  const groupedForBossIndex = new Map<string, CalculatedData[]>()
  
  sortedData.forEach(item => {
    const key = `${item.Guild}-${item.Season}-${item.loopIndex}-${item.Name}`
    if (!groupedForBossIndex.has(key)) {
      groupedForBossIndex.set(key, [])
    }
    groupedForBossIndex.get(key)!.push(item)
  })

  // Add Index_SeasonLoopBoss to each group
  groupedForBossIndex.forEach(group => {
    group.forEach((item, index) => {
      item.Index_SeasonLoopBoss = index
    })
  })

  // Group by Guild/displayName/damageType and add PlayerTokenInd
  const groupedForPlayerToken = new Map<string, CalculatedData[]>()
  
  sortedData.forEach(item => {
    const key = `${item.Guild}-${item.displayName}-${item.damageType}`
    if (!groupedForPlayerToken.has(key)) {
      groupedForPlayerToken.set(key, [])
    }
    groupedForPlayerToken.get(key)!.push(item)
  })

  // Add PlayerTokenInd to each group
  groupedForPlayerToken.forEach(group => {
    group.forEach((item, index) => {
      item.PlayerTokenInd = index
    })
  })

  return sortedData
}
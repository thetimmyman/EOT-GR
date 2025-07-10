/**
 * Application configuration
 * These values should eventually be moved to database tables for full maintenance-free operation
 */

// Boss configuration by level
export const BOSS_CONFIG = {
  1: { name: 'Ghazghkull', tier: 1, icon: '⚔️' },
  2: { name: 'Avatar', tier: 2, icon: '⚔️' },
  3: { name: 'SilentKing', tier: 3, icon: '⚔️' },
  4: { name: 'Mortarion', tier: 4, icon: '⚔️' },
  5: { name: 'Magnus', tier: 5, icon: '⚔️' }
} as const

// Level to set mapping (L1=set0, L2=set1, etc.)
export const LEVEL_TO_SET = (level: number): number => level - 1

// Damage type constants
export const DAMAGE_TYPES = {
  BATTLE: 'Battle',
  BOMB: 'Bomb'
} as const

// Rarity constants
export const RARITIES = {
  LEGENDARY: 'Legendary',
  EPIC: 'Epic',
  RARE: 'Rare'
} as const

// Tier thresholds
export const TIER_THRESHOLDS = {
  MIN_BOSS_TIER: 4,
  MIN_PRIME_TIER: 1
} as const

// Cache TTL values (in milliseconds) - optimized for maintenance-free operation
export const CACHE_DURATIONS = {
  GUILD_CONFIG: 30 * 60 * 1000,    // 30 minutes - guild configs rarely change
  SEASONS: 15 * 60 * 1000,         // 15 minutes - seasons change infrequently
  PLAYER_DATA: 5 * 60 * 1000,      // 5 minutes - player data updates moderately
  BOSS_DATA: 10 * 60 * 1000,       // 10 minutes - boss data is fairly stable
  SUMMARY_DATA: 3 * 60 * 1000,     // 3 minutes - summary data aggregates slowly
  TOKEN_DATA: 5 * 60 * 1000,       // 5 minutes - token usage is moderate
  DEBUG_DATA: 60 * 1000            // 1 minute - for debugging, faster refresh
} as const

// Database limits
export const DB_LIMITS = {
  MAX_RECORDS: 999999,
  SAMPLE_SIZE: 1000
} as const

export type BossLevel = keyof typeof BOSS_CONFIG
export type DamageType = typeof DAMAGE_TYPES[keyof typeof DAMAGE_TYPES]
export type Rarity = typeof RARITIES[keyof typeof RARITIES]
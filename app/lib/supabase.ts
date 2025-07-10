import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface GuildRaidData {
  id: number
  Guild: string
  Season: string
  displayName: string
  Name: string
  enemyHp: number
  enemyHpLeft: number
  damageType: string
  damageDealt: number
  loopIndex: number
  tier: number
  set: string
  encounterId: number
  startedOn: string
  completedOn: string
  timestamp: string
  rarity: string
  userId: string
  encounterIndex: number
  remainingHp: number
}
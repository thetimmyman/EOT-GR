import { createClient } from '@supabase/supabase-js'

// Use ANON key for client-side, not service role key!
const supabaseUrl = 'https://ctzowkkbsnztaojllwta.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0em93a2tic256dGFvamxsd3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MjI2MTIsImV4cCI6MjA1OTA5ODYxMn0.Trla4YlafiLDNZcl1iJGasHnVoW6zU6A8KaFfg3Jz3Y'

export const supabase = createClient(supabaseUrl, supabaseKey)

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
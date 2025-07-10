'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cache, CACHE_TTL } from '../lib/cache'
import { DB_LIMITS } from '../lib/config'

interface GuildConfig {
  guild_code: string
  display_name: string
  enabled: boolean
  icon?: string
  color?: string
}

interface GuildOption {
  value: string
  label: string
  displayName: string
  color: string
  icon: string
}

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
  availableSeasons: string[]
  selectedSeason: string
  onSeasonChange: (season: string) => void
  selectedGuild: string
  onGuildChange: (guild: string) => void
  onRefresh: () => void
}

export default function Navigation({
  currentPage,
  onPageChange,
  availableSeasons,
  selectedSeason,
  onSeasonChange,
  selectedGuild,
  onGuildChange,
  onRefresh
}: NavigationProps) {
  const [guildOptions, setGuildOptions] = useState<GuildOption[]>([])
  const [loading, setLoading] = useState(false)

  const pages = [
    { id: 'summary', name: 'Overview', icon: '📊', shortName: 'Summary' },
    { id: 'player-perf', name: 'Performance', icon: '👥', shortName: 'Players' },
    { id: 'player-search', name: 'Search', icon: '🔍', shortName: 'Search' },
    { id: 'token-usage', name: 'Tokens', icon: '🎯', shortName: 'Tokens' },
    { id: 'l1-boss', name: 'L1', icon: '⚔️', shortName: 'L1' },
    { id: 'l2-boss', name: 'L2', icon: '⚔️', shortName: 'L2' },
    { id: 'l3-boss', name: 'L3', icon: '⚔️', shortName: 'L3' },
    { id: 'l4-boss', name: 'L4', icon: '⚔️', shortName: 'L4' },
    { id: 'l5-boss', name: 'L5', icon: '⚔️', shortName: 'L5' },
    { id: 'votlw', name: 'VOTLW', icon: '🏆', shortName: 'VOTLW' },
    { id: 'debug', name: 'Debug', icon: '🔧', shortName: 'Debug' }
  ]

  useEffect(() => {
    fetchGuildConfig()
  }, [])

  // Function to force refresh guild data (clears cache)
  const refreshGuildData = () => {
    cache.invalidatePrefix('guild_')
    fetchGuildConfig()
    onRefresh() // Call the parent refresh function
  }

  const fetchGuildConfig = async () => {
    try {
      setLoading(true)
      
      
      // Use cache to fetch guild options
      const guildOptions = await cache.getOrFetch(
        'guild_options',
        async () => {
          // Step 1: Get unique guilds that actually have data
          const { data: dataGuilds, error: dataError } = await supabase
            .from('EOT_GR_data')
            .select('Guild')
            .not('Guild', 'is', null)
            .limit(DB_LIMITS.MAX_RECORDS)
          
          if (dataError) {
            console.error('Error fetching guild data:', dataError)
            throw dataError
          }
          
          if (!dataGuilds || dataGuilds.length === 0) {
            return []
          }
          
          const uniqueGuilds = Array.from(new Set(dataGuilds.map(d => d.Guild)))
          
          // Step 2: Get guild config for these guilds
          const { data: guildConfigs, error: configError } = await supabase
            .from('guild_config')
            .select('guild_code, display_name, enabled')
            .in('guild_code', uniqueGuilds)
          
          // Step 3: Build guild options with cross-reference
          let guildOptions: GuildOption[] = []
          
          if (configError || !guildConfigs) {
            // Fallback: Just use guild codes
            guildOptions = uniqueGuilds.map(guildCode => ({
              value: guildCode,
              label: `${guildCode} - ${guildCode}`,
              displayName: `${guildCode} - ${guildCode}`,
              color: 'from-gray-600 to-gray-800',
              icon: '⚔️'
            }))
          } else {
            // Create a map of guild configs for quick lookup
            const configMap = new Map<string, any>()
            guildConfigs.forEach(config => {
              configMap.set(config.guild_code, config)
            })
            
            // Build options for guilds that have data, with display names from config
            guildOptions = uniqueGuilds.map(guildCode => {
              const config = configMap.get(guildCode)
              
              if (config && config.enabled) {
                return {
                  value: guildCode,
                  label: `${guildCode} - ${config.display_name}`,
                  displayName: `${guildCode} - ${config.display_name}`,
                  color: 'from-gray-600 to-gray-800',
                  icon: '⚔️'
                }
              } else {
                // Guild has data but no config or disabled - still include but with code only
                return {
                  value: guildCode,
                  label: `${guildCode} - ${guildCode}`,
                  displayName: `${guildCode} - ${guildCode}`,
                  color: 'from-gray-600 to-gray-800',
                  icon: '⚔️'
                }
              }
            }).filter(Boolean) // Remove any null entries
          }
          
          // Sort alphabetically by guild code
          guildOptions.sort((a, b) => a.value.localeCompare(b.value))
          return guildOptions
        },
        {}, // No additional parameters
        CACHE_TTL.GUILD_CONFIG // Cache for 10 minutes
      )
      
      setGuildOptions(guildOptions)
      
      // If no guild is currently selected and we have options, select the first one
      if (!selectedGuild && guildOptions.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('No guild selected, setting to first available:', guildOptions[0].value)
        }
        onGuildChange(guildOptions[0].value)
      }
      
    } catch (error) {
      console.error('Error in fetchGuildConfig:', error)
      // Final fallback - discover from any available data
      try {
        const { data: fallbackData } = await supabase
          .from('EOT_GR_data')
          .select('Guild')
          .not('Guild', 'is', null)
          .limit(DB_LIMITS.MAX_RECORDS)
        
        if (fallbackData && fallbackData.length > 0) {
          const uniqueGuilds = Array.from(new Set(fallbackData.map(d => d.Guild)))
          const fallbackOptions = uniqueGuilds.map(guildCode => ({
            value: guildCode,
            label: `${guildCode} - ${guildCode}`,
            displayName: `${guildCode} - ${guildCode}`,
            color: 'from-gray-600 to-gray-800',
            icon: '⚔️'
          }))
          setGuildOptions(fallbackOptions)
        }
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError)
        setGuildOptions([])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card-wh40k shadow-lg border-b border-accent-wh40k sticky top-0 z-50">
      {/* Header - Compact */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-primary-wh40k">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-primary-wh40k to-accent-wh40k rounded-lg flex items-center justify-center shadow-md">
                <span className="text-black font-bold text-xs sm:text-sm">GR</span>
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gradient">
                  Guild Raid Analytics
                </h1>
                <p className="text-xs sm:text-sm text-secondary-wh40k font-medium hidden sm:block">Performance Dashboard</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm"></div>
            <span className="text-xs sm:text-sm text-primary-wh40k font-medium hidden sm:inline">Online</span>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 bg-card-bg border-b border-primary-wh40k">
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
          {/* Guild Selector */}
          <div className="flex flex-col">
            <label htmlFor="guild-select" className="text-xs font-semibold text-accent-wh40k mb-1 uppercase tracking-wide">
              Guild
            </label>
            <select 
              id="guild-select"
              name="guild"
              value={selectedGuild} 
              onChange={(e) => onGuildChange(e.target.value)}
              className="input-wh40k min-w-0 sm:min-w-[120px]"
              aria-label="Select guild"
              disabled={loading}
            >
              {guildOptions.map(guild => (
                <option key={guild.value} value={guild.value}>
                  {guild.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Season Selector */}
          <div className="flex flex-col">
            <label htmlFor="season-select" className="text-xs font-semibold text-accent-wh40k mb-1 uppercase tracking-wide">
              Season
            </label>
            <select 
              id="season-select"
              name="season"
              value={selectedSeason} 
              onChange={(e) => onSeasonChange(e.target.value)}
              className="input-wh40k min-w-0 sm:min-w-[100px]"
              aria-label="Select season"
            >
              <option value="">Select Season</option>
              {availableSeasons.map(season => (
                <option key={season} value={season}>
                  Season {season}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-accent-wh40k mb-1 uppercase tracking-wide">
              Actions
            </label>
            <button 
              onClick={refreshGuildData}
              className="btn-wh40k"
              aria-label="Refresh data"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Current Selection Display - Hidden on mobile */}
          {selectedSeason && (
            <div className="hidden lg:flex flex-col ml-auto">
              <label className="text-xs font-semibold text-accent-wh40k mb-1 uppercase tracking-wide">
                Current Selection
              </label>
              <div className="flex items-center space-x-3">
                <span className="badge-wh40k">
                  {selectedGuild}
                </span>
                <span className="badge-accent-wh40k">
                  Season {selectedSeason}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-card-bg">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => onPageChange(page.id)}
              className={`nav-tab-wh40k ${
                currentPage === page.id
                  ? 'active'
                  : ''
              }`}
              aria-label={`Navigate to ${page.name} page`}
              aria-pressed={currentPage === page.id}
            >
              <span className="text-xs">{page.icon}</span>
              <span className="hidden sm:inline text-xs">{page.name}</span>
              <span className="sm:hidden text-xs">{page.shortName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
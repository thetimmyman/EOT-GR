'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cache, CACHE_TTL } from '../lib/cache'
import { DB_LIMITS } from '../lib/config'
import { useThemeStore } from '../lib/themeStore'
import { getGuildTheme } from '../lib/themes'

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
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'guild'>('guild')
  
  // Theme mode rotation: light -> dark -> guild (40k themed)
  const themeModes = [
    { mode: 'light' as const, icon: '☀️', label: 'Light' },
    { mode: 'dark' as const, icon: '🌙', label: 'Dark' }, 
    { mode: 'guild' as const, icon: '💀', label: '40K' }
  ]
  
  const applyThemeMode = (mode: 'light' | 'dark' | 'guild', guildCode?: string) => {
    const rootElement = document.documentElement
    rootElement.setAttribute('data-theme-mode', mode)
    
    if (mode === 'light') {
      // Light mode - simple white background, black text, black borders
      rootElement.style.setProperty('--primary', '#000000')  // Black
      rootElement.style.setProperty('--secondary', '#333333') // Dark gray
      rootElement.style.setProperty('--accent', '#666666')   // Medium gray
      rootElement.style.setProperty('--bg-from', '#ffffff')
      rootElement.style.setProperty('--bg-via', '#ffffff')
      rootElement.style.setProperty('--bg-to', '#ffffff')
      rootElement.style.setProperty('--card-bg', '#ffffff')
      rootElement.style.setProperty('--card-border', '#000000')
      rootElement.style.setProperty('--text-primary', '#000000')  // Black text
      rootElement.style.setProperty('--text-secondary', '#333333') // Dark gray text
      rootElement.style.setProperty('--text-accent', '#000000')   // Black accent
      
      // Chart-specific overrides for light mode
      rootElement.style.setProperty('--chart-text', '#000000')  // Black chart text
      rootElement.style.setProperty('--chart-axis', '#000000')  // Black axis lines
      rootElement.style.setProperty('--chart-grid', '#cccccc')  // Light gray grid
      rootElement.style.setProperty('--chart-background', '#ffffff')  // White chart background
      
      // Remove any conflicting classes and glows
      document.body.className = document.body.className.replace(/bg-wh40k|pattern-\w+|glow-\w+/g, '')
      document.body.style.background = '#ffffff'
      
      // Apply light mode styles to all chart text elements and card content
      const existingStyle = document.getElementById('light-mode-chart-styles')
      if (existingStyle) {
        existingStyle.remove()
      }
      
      const style = document.createElement('style')
      style.id = 'light-mode-chart-styles'
      style.textContent = `
        /* Chart text and elements */
        [data-theme-mode="light"] .recharts-text,
        [data-theme-mode="light"] .recharts-cartesian-axis-tick,
        [data-theme-mode="light"] .recharts-legend-item-text,
        [data-theme-mode="light"] .recharts-tooltip-wrapper,
        [data-theme-mode="light"] .recharts-default-legend .recharts-legend-item,
        [data-theme-mode="light"] .recharts-polar-angle-axis-tick,
        [data-theme-mode="light"] .recharts-polar-radius-axis-tick {
          fill: #000000 !important;
          color: #000000 !important;
        }
        
        [data-theme-mode="light"] .recharts-cartesian-grid line,
        [data-theme-mode="light"] .recharts-polar-grid .recharts-polar-grid-angle line,
        [data-theme-mode="light"] .recharts-polar-grid .recharts-polar-grid-concentric-polygon {
          stroke: #cccccc !important;
        }
        
        [data-theme-mode="light"] .recharts-cartesian-axis line {
          stroke: #000000 !important;
        }
        
        [data-theme-mode="light"] .recharts-tooltip-wrapper .recharts-default-tooltip {
          background-color: #ffffff !important;
          border: 1px solid #000000 !important;
          color: #000000 !important;
        }
        
        /* Card and text overrides for light theme */
        [data-theme-mode="light"] .text-slate-300,
        [data-theme-mode="light"] .text-slate-400,
        [data-theme-mode="light"] .text-slate-500,
        [data-theme-mode="light"] .text-gray-300,
        [data-theme-mode="light"] .text-gray-400,
        [data-theme-mode="light"] .text-gray-500,
        [data-theme-mode="light"] .text-secondary-wh40k {
          color: #000000 !important;
        }
        
        [data-theme-mode="light"] .text-primary-wh40k {
          color: #000000 !important;
        }
        
        [data-theme-mode="light"] .bg-slate-700,
        [data-theme-mode="light"] .bg-slate-800,
        [data-theme-mode="light"] .bg-gray-700,
        [data-theme-mode="light"] .bg-gray-800 {
          background-color: #f3f4f6 !important;
        }
        
        [data-theme-mode="light"] .border-slate-600,
        [data-theme-mode="light"] .border-slate-700,
        [data-theme-mode="light"] .border-gray-600 {
          border-color: #d1d5db !important;
        }
        
        /* Button styling for light mode */
        [data-theme-mode="light"] .btn-wh40k {
          background-color: #e5e7eb !important;
          color: #000000 !important;
          border-color: #d1d5db !important;
        }
        
        [data-theme-mode="light"] .btn-wh40k:hover {
          background-color: #d1d5db !important;
          color: #000000 !important;
        }
      `
      document.head.appendChild(style)
    } else {
      // Remove light mode chart styles when switching away from light mode
      const existingStyle = document.getElementById('light-mode-chart-styles')
      if (existingStyle) {
        existingStyle.remove()
      }
    }
    
    if (mode === 'dark') {
      // Dark mode overrides - comprehensive  
      rootElement.style.setProperty('--primary', '#60a5fa')
      rootElement.style.setProperty('--secondary', '#93c5fd')
      rootElement.style.setProperty('--accent', '#3b82f6')
      rootElement.style.setProperty('--bg-from', '#0f0f23')
      rootElement.style.setProperty('--bg-via', '#1e1e3f')
      rootElement.style.setProperty('--bg-to', '#0f0f23')
      rootElement.style.setProperty('--card-bg', 'rgba(30, 30, 63, 0.6)')
      rootElement.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.15)')
      rootElement.style.setProperty('--text-primary', '#f1f5f9')
      rootElement.style.setProperty('--text-secondary', '#cbd5e1')
      rootElement.style.setProperty('--text-accent', '#60a5fa')
      // Remove any conflicting classes
      document.body.className = document.body.className.replace(/bg-wh40k|pattern-\w+/g, '')
      document.body.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1e1e3f 50%, #0f0f23 100%)'
    } else if (mode === 'guild') {
      // Guild mode - completely restore guild theme
      const cssVariables = [
        '--primary', '--secondary', '--accent', '--bg-from', '--bg-via', '--bg-to',
        '--card-bg', '--card-border', '--text-primary', '--text-secondary', '--text-accent'
      ]
      
      // Remove all overrides
      cssVariables.forEach(prop => rootElement.style.removeProperty(prop))
      
      // Apply the current guild's theme directly
      const currentGuild = guildCode || selectedGuild
      if (currentGuild) {
        const guildTheme = getGuildTheme(currentGuild)
        if (guildTheme) {
          // Convert guild theme to CSS variables and apply
          rootElement.style.setProperty('--primary', guildTheme.primary)
          rootElement.style.setProperty('--secondary', guildTheme.secondary)
          rootElement.style.setProperty('--accent', guildTheme.accent)
          rootElement.style.setProperty('--bg-from', guildTheme.background.from)
          rootElement.style.setProperty('--bg-via', guildTheme.background.via)
          rootElement.style.setProperty('--bg-to', guildTheme.background.to)
          rootElement.style.setProperty('--card-bg', guildTheme.cardBg)
          rootElement.style.setProperty('--card-border', guildTheme.cardBorder)
          rootElement.style.setProperty('--text-primary', guildTheme.text.primary)
          rootElement.style.setProperty('--text-secondary', guildTheme.text.secondary)
          rootElement.style.setProperty('--text-accent', guildTheme.text.accent)
        }
      }
      
      // Restore body classes
      document.body.style.removeProperty('background')
      if (!document.body.className.includes('bg-wh40k')) {
        document.body.className += ' bg-wh40k'
      }
    }
  }

  const handleThemeToggle = () => {
    const currentIndex = themeModes.findIndex(t => t.mode === themeMode)
    const nextIndex = (currentIndex + 1) % themeModes.length
    const nextMode = themeModes[nextIndex].mode
    setThemeMode(nextMode)
    applyThemeMode(nextMode, selectedGuild)
  }
  
  const currentThemeMode = themeModes.find(t => t.mode === themeMode) || themeModes[2]
  
  // Handle guild change while preserving theme mode
  const handleGuildChange = (newGuild: string) => {
    onGuildChange(newGuild)
    // Reapply theme mode after guild change to maintain override
    if (themeMode !== 'guild') {
      setTimeout(() => applyThemeMode(themeMode, newGuild), 100)
    }
  }

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
  
  // Apply theme mode when guild changes
  useEffect(() => {
    if (selectedGuild && themeMode !== 'guild') {
      applyThemeMode(themeMode, selectedGuild)
    }
  }, [selectedGuild, themeMode])

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
          
          <div className="flex items-center space-x-3">
            {/* Theme Mode Switcher */}
            <button
              onClick={handleThemeToggle}
              className="flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
              title={`Switch to ${themeModes[(themeModes.findIndex(t => t.mode === themeMode) + 1) % themeModes.length].label} mode`}
            >
              <span className="text-xs text-primary-wh40k font-medium hidden sm:inline">Theme:</span>
              <span className="text-sm">{currentThemeMode.icon}</span>
              <span className="text-xs text-primary-wh40k font-medium hidden md:inline">
                {currentThemeMode.label}
              </span>
            </button>
            
            {/* Online Status */}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm"></div>
              <span className="text-xs sm:text-sm text-primary-wh40k font-medium hidden sm:inline">Online</span>
            </div>
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
              onChange={(e) => handleGuildChange(e.target.value)}
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
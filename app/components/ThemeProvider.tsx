'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getGuildTheme, GuildTheme } from '../lib/themes'

interface ThemeContextType {
  theme: GuildTheme
  guildCode: string
  setGuildCode: (code: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ 
  children, 
  initialGuild = 'IW' 
}: { 
  children: React.ReactNode
  initialGuild?: string 
}) {
  const [guildCode, setGuildCode] = useState(initialGuild)
  const [theme, setTheme] = useState(getGuildTheme(initialGuild))

  useEffect(() => {
    const newTheme = getGuildTheme(guildCode)
    setTheme(newTheme)
    
    // Apply CSS variables for the theme
    const root = document.documentElement
    root.style.setProperty('--primary', newTheme.primary)
    root.style.setProperty('--secondary', newTheme.secondary)
    root.style.setProperty('--accent', newTheme.accent)
    root.style.setProperty('--bg-from', newTheme.background.from)
    root.style.setProperty('--bg-via', newTheme.background.via)
    root.style.setProperty('--bg-to', newTheme.background.to)
    root.style.setProperty('--card-bg', newTheme.cardBg)
    root.style.setProperty('--card-border', newTheme.cardBorder)
    root.style.setProperty('--text-primary', newTheme.text.primary)
    root.style.setProperty('--text-secondary', newTheme.text.secondary)
    root.style.setProperty('--text-accent', newTheme.text.accent)
  }, [guildCode])

  return (
    <ThemeContext.Provider value={{ theme, guildCode, setGuildCode }}>
      {children}
    </ThemeContext.Provider>
  )
}
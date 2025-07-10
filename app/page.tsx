'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { cache, CACHE_TTL } from './lib/cache'
import { DB_LIMITS } from './lib/config'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import Navigation from './components/Navigation'
import SummaryPage from './components/SummaryPage'
import PlayerPerformancePage from './components/PlayerPerformancePage'
import PlayerSearchPage from './components/PlayerSearchPage'
import TokenUsagePage from './components/TokenUsagePage'
import L1BossPage from './components/L1BossPage'
import L2BossPage from './components/L2BossPage'
import L3BossPage from './components/L3BossPage'
import L4BossPage from './components/L4BossPage'
import L5BossPage from './components/L5BossPage'
import VOTLWPage from './components/VOTLWPage'
import DebugPage from './components/DebugPage'

function DashboardContent() {
  const [currentPage, setCurrentPage] = useState('summary')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState('')
  const [selectedGuild, setSelectedGuild] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { setGuildCode } = useTheme()

  const testConnection = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Testing connection to Supabase...')
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      }
      
      // Test basic connection with timeout
      const connectionPromise = supabase
        .from('EOT_GR_data')
        .select('Season')
        .limit(1)
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
      )
      
      const { data: testData, error: testError } = await Promise.race([
        connectionPromise,
        timeoutPromise
      ]) as any

      if (testError) {
        console.error('Connection failed:', testError)
        setConnected(false)
        setLoading(false)
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Connection successful:', testData)
      }
      setConnected(true)

      // Efficient season fetching with caching
      const allSeasons = await cache.getOrFetch(
        'available_seasons',
        async () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Fetching available seasons...')
          }
          let seasons: string[] = []
          
          try {
            // Approach 1: Try getting seasons 70-80 (recent range)
            const seasonPromises = []
            for (let season = 70; season <= 80; season++) {
              seasonPromises.push(
                supabase
                  .from('EOT_GR_data')
                  .select('Season')
                  .eq('Season', season.toString())
                  .limit(1)
                  .then(({ data }) => data && data.length > 0 ? season.toString() : null)
              )
            }
            
            // Execute all season checks in parallel with timeout
            const seasonResults = await Promise.race([
              Promise.all(seasonPromises),
              new Promise<(string | null)[]>((resolve) => 
                setTimeout(() => resolve([]), 5000) // 5 second timeout
              )
            ])
            
            seasons = seasonResults.filter(s => s !== null) as string[]
            
            // If we didn't find many seasons, try a broader approach
            if (seasons.length < 3) {
              const { data: seasonData } = await supabase
                .from('EOT_GR_data')
                .select('Season')
                .not('Season', 'is', null)
                .order('Season', { ascending: false })
                .limit(DB_LIMITS.MAX_RECORDS)
              
              if (seasonData) {
                const seasonSet = new Set(seasonData.map(d => d.Season))
                seasons = Array.from(seasonSet)
              }
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Found seasons:', seasons)
            }
            return seasons.sort((a, b) => parseInt(b) - parseInt(a))
          } catch (seasonError) {
            console.error('Error fetching seasons:', seasonError)
            // Fallback - return empty array
            return []
          }
        },
        {}, // No additional parameters
        CACHE_TTL.SEASONS // Cache for 5 minutes
      )
      
      setSeasons(allSeasons)
      
      if (allSeasons.length > 0 && !selectedSeason) {
        setSelectedSeason(allSeasons[0]) // Set to latest season
      } else if (allSeasons.length === 0 && testData && testData[0]?.Season) {
        // Ultimate fallback - use test data season
        setSeasons([testData[0].Season])
        if (!selectedSeason) {
          setSelectedSeason(testData[0].Season)
        }
      }
      
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    testConnection()
  }, [testConnection])

  const handleRefresh = useCallback(() => {
    // Clear relevant caches on refresh
    cache.invalidatePrefix('available_seasons')
    cache.invalidatePrefix('guild_')
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Cache cleared, refreshing data...')
    }
    setRefreshKey(prev => prev + 1)
    // Re-test connection to get fresh data
    testConnection()
  }, [testConnection])

  const handleGuildChange = useCallback((newGuild: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Guild changed to:', newGuild)
    }
    setSelectedGuild(newGuild)
    setGuildCode(newGuild) // Update theme provider
  }, [setGuildCode])

  const renderCurrentPage = () => {
    const baseProps = { selectedGuild, selectedSeason, key: refreshKey }
    
    switch (currentPage) {
      case 'summary':
        return <SummaryPage {...baseProps} />
      case 'player-perf':
        return <PlayerPerformancePage {...baseProps} />
      case 'player-search':
        return <PlayerSearchPage {...baseProps} />
      case 'token-usage':
        return <TokenUsagePage {...baseProps} />
      case 'l1-boss':
        return <L1BossPage {...baseProps} />
      case 'l2-boss':
        return <L2BossPage {...baseProps} />
      case 'l3-boss':
        return <L3BossPage {...baseProps} />
      case 'l4-boss':
        return <L4BossPage {...baseProps} />
      case 'l5-boss':
        return <L5BossPage {...baseProps} />
      case 'votlw':
        return <VOTLWPage {...baseProps} />
      case 'debug':
        return <DebugPage {...baseProps} />
      default:
        return <SummaryPage {...baseProps} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-wh40k flex items-center justify-center">
        <div className="text-center card-wh40k p-8">
          <div className="spinner-modern mx-auto"></div>
          <p className="mt-4 text-primary-wh40k font-semibold">Testing connection...</p>
          <div className="mt-2 text-secondary-wh40k text-sm">Establishing link to the Omnissiah...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-wh40k relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pattern-gothic opacity-5"></div>
      
      <Navigation
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        availableSeasons={seasons}
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        selectedGuild={selectedGuild}
        onGuildChange={handleGuildChange}
        onRefresh={handleRefresh}
      />
      
      {/* Main content area */}
      <div className="pb-16 relative z-10">
        {connected ? (
          renderCurrentPage()
        ) : (
          <div className="container-modern py-16">
            <div className="card-wh40k p-8 text-center max-w-md mx-auto">
              <div className="text-accent-wh40k text-6xl mb-4">⚠️</div>
              <h2 className="heading-wh40k text-red-400 mb-4">Vox Connection Lost</h2>
              <p className="text-secondary-wh40k mb-6">Unable to establish link with the Omnissiah&apos;s data-vaults</p>
              <button 
                onClick={testConnection}
                className="btn-wh40k"
              >
                Retry Vox Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <ThemeProvider initialGuild="IW">
      <DashboardContent />
    </ThemeProvider>
  )
}

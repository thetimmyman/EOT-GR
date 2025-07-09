'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
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

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState('summary')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState('')
  const [selectedGuild, setSelectedGuild] = useState('IW')
  const [refreshKey, setRefreshKey] = useState(0)

  const testConnection = useCallback(async () => {
    try {
      console.log('Testing connection...')
      
      // Test basic connection
      const { data: testData, error: testError } = await supabase
        .from('EOT_GR_data')
        .select('Season')
        .limit(1)

      if (testError) {
        console.error('Connection failed:', testError)
        setConnected(false)
        setLoading(false)
        return
      }

      console.log('Connection successful:', testData)
      setConnected(true)

      // Efficient season fetching - get a sample from each potential season
      // We'll try multiple approaches to get all seasons
      let allSeasons: string[] = []
      
      try {
        // Approach 1: Try getting seasons 70-80 (recent range)
        for (let season = 70; season <= 80; season++) {
          const { data: seasonCheck } = await supabase
            .from('EOT_GR_data')
            .select('Season')
            .eq('Season', season.toString())
            .limit(1)
          
          if (seasonCheck && seasonCheck.length > 0) {
            allSeasons.push(season.toString())
          }
        }
        
        // If we didn't find many seasons, try a broader approach
        if (allSeasons.length < 3) {
          const { data: seasonData } = await supabase
            .from('EOT_GR_data')
            .select('Season')
            .not('Season', 'is', null)
            .order('Season', { ascending: false })
            .limit(5000) // Higher limit to catch more seasons
          
          if (seasonData) {
            const seasonSet = new Set(seasonData.map(d => d.Season))
            allSeasons = Array.from(seasonSet)
          }
        }
        
        console.log('Found seasons:', allSeasons)
        const sortedSeasons = allSeasons.sort((a, b) => parseInt(b) - parseInt(a))
        setSeasons(sortedSeasons)
        
        if (sortedSeasons.length > 0 && !selectedSeason) {
          setSelectedSeason(sortedSeasons[0]) // Set to latest season
        }
        
      } catch (seasonError) {
        console.error('Error fetching seasons:', seasonError)
        // Fallback - just use the season from the test data
        if (testData && testData[0]?.Season) {
          setSeasons([testData[0].Season])
          setSelectedSeason(testData[0].Season)
        }
      }
      
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [selectedSeason])

  useEffect(() => {
    testConnection()
  }, [testConnection])

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-modern mx-auto"></div>
          <p className="mt-4 text-gray-600">Testing connection...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        availableSeasons={seasons}
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        selectedGuild={selectedGuild}
        onGuildChange={setSelectedGuild}
        onRefresh={handleRefresh}
      />
      
      {/* Main content area */}
      <div className="pb-16">
        {connected ? (
          renderCurrentPage()
        ) : (
          <div className="container mx-auto py-16 px-6">
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <h2 className="text-2xl font-semibold text-red-600 mb-4">Connection Failed</h2>
              <p className="text-gray-600 mb-4">Unable to connect to the database</p>
              <button 
                onClick={testConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

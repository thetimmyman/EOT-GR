'use client'

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

  const guilds = [
    { code: 'IW', name: 'Iron Warriors' },
    { code: 'AL', name: 'Alpha Legion' },
    { code: 'IH', name: 'Iron Hydras' },
    { code: 'RG', name: 'Raven Guard' },
    { code: 'HL', name: 'Heresy Lodge' },
    { code: 'DA', name: 'Dark Angels' },
    { code: 'TS', name: 'Thousand Sons' }
  ]

  return (
    <div className="bg-white shadow-sm border-b sticky top-0 z-50">
      {/* Header - Compact */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xs sm:text-sm">GR</span>
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Guild Raid Analytics
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 font-medium hidden sm:block">Performance Dashboard</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm"></div>
            <span className="text-xs sm:text-sm text-gray-600 font-medium hidden sm:inline">Online</span>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
          {/* Guild Selector */}
          <div className="flex flex-col">
            <label htmlFor="guild-select" className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
              Guild
            </label>
            <select 
              id="guild-select"
              name="guild"
              value={selectedGuild} 
              onChange={(e) => onGuildChange(e.target.value)}
              className="select-modern min-w-0 sm:min-w-[120px]"
              aria-label="Select guild"
            >
              {guilds.map(guild => (
                <option key={guild.code} value={guild.code}>
                  {guild.code} - {guild.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Season Selector */}
          <div className="flex flex-col">
            <label htmlFor="season-select" className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
              Season
            </label>
            <select 
              id="season-select"
              name="season"
              value={selectedSeason} 
              onChange={(e) => onSeasonChange(e.target.value)}
              className="select-modern min-w-0 sm:min-w-[100px]"
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
            <label className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
              Actions
            </label>
            <button 
              onClick={onRefresh}
              className="btn-primary"
              aria-label="Refresh data"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Current Selection Display - Hidden on mobile */}
          {selectedSeason && (
            <div className="hidden lg:flex flex-col ml-auto">
              <label className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                Current Selection
              </label>
              <div className="flex items-center space-x-3">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedGuild}
                </span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Season {selectedSeason}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-white">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => onPageChange(page.id)}
              className={`nav-tab ${
                currentPage === page.id
                  ? 'nav-tab-active'
                  : 'nav-tab-inactive'
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
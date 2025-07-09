'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface VOTLWPageProps {
  selectedGuild: string
  selectedSeason: string
}

interface PlayerPoints {
  displayName: string
  totalPoints: number
  awards: {
    goldMedals: number
    silverMedals: number
    bronzeMedals: number
    mostDamageAwards: number
    sideBossWins: number
    biggestHitAwards: number
    topKiller: boolean
    bestBomber: boolean
    sideBoss1Wins?: number
    sideBoss2Wins?: number
  }
  breakdown: string[]
}

interface SetWinner {
  set: number
  gold: string
  goldValue?: number
  silver: string
  silverValue?: number
  bronze: string
  bronzeValue?: number
  mostDamage: string
  mostDamageValue?: number
  sideBoss1: string
  sideBoss1Value?: number
  sideBoss2: string
  sideBoss2Value?: number
  biggestHit: string
  biggestHitValue?: number
}

export default function VOTLWPage({ selectedGuild, selectedSeason }: VOTLWPageProps) {
  const [playerPoints, setPlayerPoints] = useState<PlayerPoints[]>([])
  const [setWinners, setSetWinners] = useState<SetWinner[]>([])
  const [seasonAwards, setSeasonAwards] = useState({
    topKiller: { player: '', value: 0 },
    bestBomber: { player: '', value: 0 }
  })
  const [loading, setLoading] = useState(true)

  // Helper function to identify last hits
  const isLastHit = (entry: any) => {
    return entry.damageType === 'Battle' && entry.remainingHp === 0
  }

  useEffect(() => {
    if (selectedSeason && selectedGuild) {
      calculateVOTLW()
    }
  }, [selectedGuild, selectedSeason])

  const calculateVOTLW = async () => {
    setLoading(true)
    
    try {
      // Get all battle data for the season
      const { data: allBattleData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Battle')
        .eq('rarity', 'Legendary')     // ✅ ADD THIS LINE
        .gte('tier', 4)                // ✅ ADD THIS LINE

      // Get bomb data
      const { data: bombData } = await supabase
        .from('EOT_GR_data')
        .select('*')
        .eq('Guild', selectedGuild)
        .eq('Season', selectedSeason)
        .eq('damageType', 'Bomb')

      if (allBattleData) {
        // Separate last hits from regular battle data
        const lastHitData = allBattleData.filter(entry => isLastHit(entry))
        const battleData = allBattleData.filter(entry => !isLastHit(entry))

        // Calculate season-wide awards first - Fix the null issue
        const seasonResults = calculateSeasonAwards(lastHitData, bombData || [])
        
        // Calculate set-by-set winners
        const setResults = calculateSetWinners(battleData)
        
        // Calculate final player points
        const finalPoints = calculatePlayerPoints(setResults, seasonResults)
        
        setSeasonAwards(seasonResults)
        setSetWinners(setResults)
        setPlayerPoints(finalPoints)
      }
    } catch (error) {
      console.error('Error calculating VOTLW:', error)
    }
    
    setLoading(false)
  }

  const calculateSeasonAwards = (lastHitData: any[], bombData: any[]) => {
    // Top Killer - most last hits
    const killerCounts: {[key: string]: number} = {}
    lastHitData?.forEach(hit => {
      killerCounts[hit.displayName] = (killerCounts[hit.displayName] || 0) + 1
    })
    const topKillerEntry = Object.entries(killerCounts).sort((a, b) => b[1] - a[1])[0]
    
    // Best Bomber - highest single bomb damage
    let bestBomber = { player: '', value: 0 }
    bombData?.forEach(bomb => {
      if (bomb.damageDealt > bestBomber.value) {
        bestBomber = { player: bomb.displayName, value: bomb.damageDealt }
      }
    })

    return {
      topKiller: { 
        player: topKillerEntry?.[0] || '', 
        value: topKillerEntry?.[1] || 0 
      },
      bestBomber
    }
  }

  const calculateSetWinners = (battleData: any[]): SetWinner[] => {
    const sets = [0, 1, 2, 3, 4] // L1, L2, L3, L4, L5
    const results: SetWinner[] = []

    sets.forEach(setNum => {
      const setData = battleData.filter(d => 
        parseInt(d.set) === setNum && 
        d.encounterId === 0 // Main boss only for most calculations
      )

      if (setData.length === 0) {
        results.push({
          set: setNum,
          gold: '',
          goldValue: 0,
          silver: '',
          silverValue: 0,
          bronze: '',
          bronzeValue: 0,
          mostDamage: '',
          mostDamageValue: 0,
          sideBoss1: '',
          sideBoss1Value: 0,
          sideBoss2: '',
          sideBoss2Value: 0,
          biggestHit: '',
          biggestHitValue: 0
        })
        return
      }

      // Calculate player averages (need multiple battles)
      const playerStats: {[key: string]: {total: number, count: number}} = {}
      setData.forEach(d => {
        if (!playerStats[d.displayName]) {
          playerStats[d.displayName] = { total: 0, count: 0 }
        }
        playerStats[d.displayName].total += d.damageDealt || 0
        playerStats[d.displayName].count += 1
      })

      // Filter players with multiple battles for medals
      const qualifiedPlayers = Object.entries(playerStats)
        .filter(([_, stats]) => stats.count > 1)
        .map(([player, stats]) => ({
          player,
          avgDamage: stats.total / stats.count,
          totalDamage: stats.total
        }))
        .sort((a, b) => b.avgDamage - a.avgDamage)

      // Calculate total damage winners (all players)
      const totalDamageWinners = Object.entries(playerStats)
        .map(([player, stats]) => ({
          player,
          totalDamage: stats.total
        }))
        .sort((a, b) => b.totalDamage - a.totalDamage)

      // Side boss winners (encounter 1 and 2)
      const sideBoss1Result = calculateSideBossWinner(battleData, setNum, 1)
      const sideBoss2Result = calculateSideBossWinner(battleData, setNum, 2)

      // Biggest single hit (include all battle data for this set, even last hits)
      const allSetData = battleData.filter(d => parseInt(d.set) === setNum && d.encounterId === 0)
      const biggestHit = allSetData.reduce((max, d) => 
        (d.damageDealt || 0) > (max.damageDealt || 0) ? d : max
      , { displayName: '', damageDealt: 0 })

      results.push({
        set: setNum,
        gold: qualifiedPlayers[0]?.player || '',
        goldValue: qualifiedPlayers[0]?.avgDamage,
        silver: qualifiedPlayers[1]?.player || '',
        silverValue: qualifiedPlayers[1]?.avgDamage,
        bronze: qualifiedPlayers[2]?.player || '',
        bronzeValue: qualifiedPlayers[2]?.avgDamage,
        mostDamage: totalDamageWinners[0]?.player || '',
        mostDamageValue: totalDamageWinners[0]?.totalDamage,
        sideBoss1: sideBoss1Result.player,
        sideBoss1Value: sideBoss1Result.value,
        sideBoss2: sideBoss2Result.player,
        sideBoss2Value: sideBoss2Result.value,
        biggestHit: biggestHit.displayName,
        biggestHitValue: biggestHit.damageDealt
      })
    })

    return results
  }

  const calculateSideBossWinner = (battleData: any[], setNum: number, encounterIndex: number): {player: string, value: number} => {
    const sideBossData = battleData.filter(d => 
      parseInt(d.set) === setNum && 
      d.encounterIndex === encounterIndex
    )

    if (sideBossData.length === 0) return {player: '', value: 0}

    const playerStats: {[key: string]: {total: number, count: number}} = {}
    sideBossData.forEach(d => {
      if (!playerStats[d.displayName]) {
        playerStats[d.displayName] = { total: 0, count: 0 }
      }
      playerStats[d.displayName].total += d.damageDealt || 0
      playerStats[d.displayName].count += 1
    })

    const winner = Object.entries(playerStats)
      .map(([player, stats]) => ({
        player,
        avgDamage: stats.total / stats.count
      }))
      .sort((a, b) => b.avgDamage - a.avgDamage)[0]

    return {
      player: winner?.player || '',
      value: winner?.avgDamage || 0
    }
  }

  const calculatePlayerPoints = (setResults: SetWinner[], seasonResults: any): PlayerPoints[] => {
    const playerPoints: {[key: string]: PlayerPoints} = {}

    // Initialize all players
    const allPlayers = new Set<string>()
    setResults.forEach(set => {
      [set.gold, set.silver, set.bronze, set.mostDamage, set.sideBoss1, set.sideBoss2, set.biggestHit]
        .filter(Boolean)
        .forEach(player => allPlayers.add(player))
    })
    if (seasonResults.topKiller.player) allPlayers.add(seasonResults.topKiller.player)
    if (seasonResults.bestBomber.player) allPlayers.add(seasonResults.bestBomber.player)

    allPlayers.forEach(player => {
      playerPoints[player] = {
        displayName: player,
        totalPoints: 0,
        awards: {
          goldMedals: 0,
          silverMedals: 0,
          bronzeMedals: 0,
          mostDamageAwards: 0,
          sideBossWins: 0,
          biggestHitAwards: 0,
          topKiller: false,
          bestBomber: false,
          sideBoss1Wins: 0,
          sideBoss2Wins: 0
        },
        breakdown: []
      }
    })

    // Calculate points from sets
    setResults.forEach((set, index) => {
      const setName = `L${index + 1}`
      
      if (set.gold && playerPoints[set.gold]) {
        playerPoints[set.gold].totalPoints += 3
        playerPoints[set.gold].awards.goldMedals += 1
        playerPoints[set.gold].breakdown.push(`${setName} Gold (3pts)`)
      }
      
      if (set.silver && playerPoints[set.silver]) {
        playerPoints[set.silver].totalPoints += 2
        playerPoints[set.silver].awards.silverMedals += 1
        playerPoints[set.silver].breakdown.push(`${setName} Silver (2pts)`)
      }
      
      if (set.bronze && playerPoints[set.bronze]) {
        playerPoints[set.bronze].totalPoints += 1
        playerPoints[set.bronze].awards.bronzeMedals += 1
        playerPoints[set.bronze].breakdown.push(`${setName} Bronze (1pt)`)
      }
      
      if (set.mostDamage && playerPoints[set.mostDamage]) {
        playerPoints[set.mostDamage].totalPoints += 1
        playerPoints[set.mostDamage].awards.mostDamageAwards += 1
        playerPoints[set.mostDamage].breakdown.push(`${setName} Most Damage (1pt)`)
      }
      
      if (set.sideBoss1 && playerPoints[set.sideBoss1]) {
        playerPoints[set.sideBoss1].totalPoints += 2
        playerPoints[set.sideBoss1].awards.sideBoss1Wins! += 1
        playerPoints[set.sideBoss1].breakdown.push(`${setName} Side Boss 1 (2pts)`)
      }
      
      if (set.sideBoss2 && playerPoints[set.sideBoss2]) {
        playerPoints[set.sideBoss2].totalPoints += 2
        playerPoints[set.sideBoss2].awards.sideBoss2Wins! += 1
        playerPoints[set.sideBoss2].breakdown.push(`${setName} Side Boss 2 (2pts)`)
      }
      
      if (set.biggestHit && playerPoints[set.biggestHit]) {
        playerPoints[set.biggestHit].totalPoints += 1
        playerPoints[set.biggestHit].awards.biggestHitAwards += 1
        playerPoints[set.biggestHit].breakdown.push(`${setName} Biggest Hit (1pt)`)
      }
    })

    // Season awards
    if (seasonResults.topKiller.player && playerPoints[seasonResults.topKiller.player]) {
      playerPoints[seasonResults.topKiller.player].totalPoints += 3
      playerPoints[seasonResults.topKiller.player].awards.topKiller = true
      playerPoints[seasonResults.topKiller.player].breakdown.push('Top Killer (3pts)')
    }
    
    if (seasonResults.bestBomber.player && playerPoints[seasonResults.bestBomber.player]) {
      playerPoints[seasonResults.bestBomber.player].totalPoints += 0.5
      playerPoints[seasonResults.bestBomber.player].awards.bestBomber = true
      playerPoints[seasonResults.bestBomber.player].breakdown.push('Best Bomber (0.5pts)')
    }

    return Object.values(playerPoints)
      .filter(p => p.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  const veteran = playerPoints[0]
  const runnerUp = playerPoints[1]

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Veteran of the Long War</h2>
        <p className="text-sm text-gray-600">Season {selectedSeason} - {selectedGuild}</p>
      </div>

      {/* Winner Cards */}
      <div className="space-y-3">
        {veteran && (
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-4 text-center text-white">
            <h3 className="text-lg font-bold">🏆 Veteran of the Long War</h3>
            <p className="text-2xl font-bold mt-2">{veteran.displayName}</p>
            <p className="text-sm opacity-90">{veteran.totalPoints} total points</p>
          </div>
        )}

        {runnerUp && (
          <div className="bg-gradient-to-r from-gray-400 to-gray-600 rounded-lg p-4 text-center text-white">
            <h3 className="text-lg font-bold">🥈 Runner Up</h3>
            <p className="text-xl font-bold mt-2">{runnerUp.displayName}</p>
            <p className="text-sm opacity-90">{runnerUp.totalPoints} total points</p>
          </div>
        )}
      </div>

      {/* Season Awards */}
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="font-semibold mb-3">Season Awards</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>🔪 Top Killer:</span>
            <span className="font-medium">{seasonAwards.topKiller.player} ({seasonAwards.topKiller.value} kills)</span>
          </div>
          <div className="flex justify-between">
            <span>💣 Best Bomber:</span>
            <span className="font-medium">{seasonAwards.bestBomber.player} ({(seasonAwards.bestBomber.value / 1000000).toFixed(1)}M dmg)</span>
          </div>
        </div>
      </div>

      {/* Player Rankings */}
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="font-semibold mb-3">Player Rankings</h3>
        <div className="space-y-3">
          {playerPoints.slice(0, 10).map((player, index) => (
            <div key={player.displayName} className={`p-3 rounded border ${index < 3 ? 'bg-yellow-50' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">
                  {index + 1}. {player.displayName}
                </span>
                <span className="font-bold text-lg">{player.totalPoints} pts</span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex space-x-4">
                  <span>🥇 {player.awards.goldMedals}</span>
                  <span>🥈 {player.awards.silverMedals}</span>
                  <span>🥉 {player.awards.bronzeMedals}</span>
                  <span>💥 {player.awards.mostDamageAwards}</span>
                  <span>👹 {(player.awards.sideBoss1Wins || 0) + (player.awards.sideBoss2Wins || 0)}</span>
                  <span>🎯 {player.awards.biggestHitAwards}</span>
                </div>
                {player.awards.topKiller && <div className="text-green-600">🔪 Top Killer</div>}
                {player.awards.bestBomber && <div className="text-red-600">💣 Best Bomber</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Set Winners Table */}
      <div className="bg-white rounded-lg p-4 shadow overflow-x-auto">
        <h3 className="font-semibold mb-3">Set Winners</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Set</th>
              <th className="text-left p-2">🥇 Gold</th>
              <th className="text-left p-2">🥈 Silver</th>
              <th className="text-left p-2">🥉 Bronze</th>
              <th className="text-left p-2">💥 Most Dmg</th>
              <th className="text-left p-2">👹 Side 1</th>
              <th className="text-left p-2">👹 Side 2</th>
              <th className="text-left p-2">🎯 Big Hit</th>
            </tr>
          </thead>
          <tbody>
            {setWinners.map((set, index) => (
              <tr key={set.set} className="border-b">
                <td className="p-2 font-medium">L{index + 1}</td>
                <td className="p-2">{set.gold}</td>
                <td className="p-2">{set.silver}</td>
                <td className="p-2">{set.bronze}</td>
                <td className="p-2">{set.mostDamage}</td>
                <td className="p-2">{set.sideBoss1}</td>
                <td className="p-2">{set.sideBoss2}</td>
                <td className="p-2">{set.biggestHit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

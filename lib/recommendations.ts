import type { GameRecommendation, DateRecommendation } from '@/types'

interface GameWithStats {
  id: string
  gameId: number
  name: string
  thumbnail?: string | null
  minPlayers: number
  maxPlayers: number
  playingTime: number
  bggRating?: number | null
  userRatings: number[]
  proposedBy: { id: string; name: string }
  owner?: { id: string; name: string } | null
  isRecommended: boolean
  votes: number
}

interface DateWithVotes {
  id: string
  proposedDate: string
  startTime?: string | null
  endTime?: string | null
  availableCount: number
  totalParticipants: number
}

export function calculateGameRecommendations(
  games: GameWithStats[],
  playerCount: number
): GameRecommendation[] {
  return games
    .map(game => {
      let score = 0
      const reasons: string[] = []

      // Factor 1: Player count compatibility (0-40 points)
      if (playerCount >= game.minPlayers && playerCount <= game.maxPlayers) {
        // Best range
        const optimalMin = game.minPlayers + Math.floor((game.maxPlayers - game.minPlayers) * 0.25)
        const optimalMax = game.minPlayers + Math.floor((game.maxPlayers - game.minPlayers) * 0.75)
        
        if (playerCount >= optimalMin && playerCount <= optimalMax) {
          score += 40
          reasons.push('Número óptimo de jugadores')
        } else {
          score += 30
          reasons.push('Soporta el número de jugadores')
        }
      } else if (playerCount === game.minPlayers - 1 || playerCount === game.maxPlayers + 1) {
        score += 10
        reasons.push('Casi en el rango de jugadores')
      }

      // Factor 2: BGG Rating (0-25 points)
      if (game.bggRating) {
        const ratingScore = Math.min((game.bggRating / 10) * 25, 25)
        score += ratingScore
        if (game.bggRating >= 7.5) {
          reasons.push(`Alta puntuación en BGG (${game.bggRating.toFixed(1)})`)
        }
      }

      // Factor 3: User ratings from participants (0-25 points)
      if (game.userRatings.length > 0) {
        const avgUserRating = game.userRatings.reduce((a, b) => a + b, 0) / game.userRatings.length
        const userRatingScore = Math.min((avgUserRating / 10) * 25, 25)
        score += userRatingScore
        if (avgUserRating >= 7) {
          reasons.push('Bien valorado por los participantes')
        }
      }

      // Factor 4: Votes (0-10 points)
      if (game.votes > 0) {
        score += Math.min(game.votes * 2, 10)
        reasons.push(`${game.votes} voto(s) a favor`)
      }

      return {
        game: {
          id: game.id,
          game: {
            bggId: game.gameId,
            name: game.name,
            thumbnail: game.thumbnail || undefined,
            minPlayers: game.minPlayers,
            maxPlayers: game.maxPlayers,
            playingTime: game.playingTime,
            bggRating: game.bggRating || undefined,
          },
          proposedBy: game.proposedBy,
          isRecommended: game.isRecommended,
          owner: game.owner || undefined,
          votes: game.votes,
        },
        score,
        reasons,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function calculateDateRecommendations(
  dates: DateWithVotes[]
): DateRecommendation[] {
  return dates
    .map(date => ({
      date: {
        id: date.id,
        proposedDate: date.proposedDate,
        startTime: date.startTime || undefined,
        endTime: date.endTime || undefined,
      },
      availableCount: date.availableCount,
      percentage: date.totalParticipants > 0 
        ? Math.round((date.availableCount / date.totalParticipants) * 100)
        : 0,
    }))
    .sort((a, b) => b.availableCount - a.availableCount)
}

export function getRecommendedGamesForEvent(
  games: GameWithStats[],
  participantCount: number,
  topN: number = 3
): GameRecommendation[] {
  const recommendations = calculateGameRecommendations(games, participantCount)
  return recommendations.slice(0, topN)
}

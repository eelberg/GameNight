'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { 
  Check, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  Loader2,
  Calendar,
  Gamepad2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface EventRSVPProps {
  event: {
    id: string
    title: string
    response_deadline: string
    status: string
    event_dates: {
      id: string
      proposed_date: string
      start_time: string | null
    }[]
    event_games: {
      id: string
      games: {
        bgg_id: number
        name: string
        thumbnail: string | null
        min_players: number
        max_players: number
      }
      owner: { id: string; name: string } | null
    }[]
  }
  participation: {
    id: string
    status: string
    date_votes: { date_id: string; available: boolean }[]
    game_votes: { event_game_id: string; vote: number }[]
  }
  dateVoteCounts: { dateId: string; count: number }[]
  gameVoteCounts: { gameId: string; count: number }[]
}

export function EventRSVP({ event, participation, dateVoteCounts, gameVoteCounts }: EventRSVPProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>(
    participation.date_votes?.filter(v => v.available).map(v => v.date_id) || []
  )
  const [gameVotes, setGameVotes] = useState<Record<string, number>>(
    Object.fromEntries(
      participation.game_votes?.map(v => [v.event_game_id, v.vote]) || []
    )
  )

  const isDeadlinePassed = new Date(event.response_deadline) < new Date()
  const hasResponded = participation.status !== 'pending'

  async function submitRSVP(interested: boolean) {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Update participant status
      await supabase
        .from('event_participants')
        .update({
          status: interested ? 'interested' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', participation.id)

      if (interested) {
        // Delete existing date votes
        await supabase
          .from('date_votes')
          .delete()
          .eq('participant_id', participation.id)

        // Insert new date votes
        if (selectedDates.length > 0) {
          await supabase
            .from('date_votes')
            .insert(
              selectedDates.map(dateId => ({
                participant_id: participation.id,
                date_id: dateId,
                available: true,
              }))
            )
        }

        // Delete existing game votes
        await supabase
          .from('game_votes')
          .delete()
          .eq('participant_id', participation.id)

        // Insert new game votes
        const gameVoteEntries = Object.entries(gameVotes).filter(([_, vote]) => vote !== 0)
        if (gameVoteEntries.length > 0) {
          await supabase
            .from('game_votes')
            .insert(
              gameVoteEntries.map(([eventGameId, vote]) => ({
                participant_id: participation.id,
                event_game_id: eventGameId,
                vote,
              }))
            )
        }
      }

      toast.success(interested ? '¡Respuesta enviada!' : 'Has declinado la invitación')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Error al enviar respuesta')
    } finally {
      setIsLoading(false)
    }
  }

  function toggleGameVote(gameId: string, vote: number) {
    setGameVotes(prev => ({
      ...prev,
      [gameId]: prev[gameId] === vote ? 0 : vote,
    }))
  }

  if (event.status === 'confirmed' || event.status === 'completed') {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Quedada confirmada</h3>
          <p className="text-muted-foreground">
            Los detalles finales están arriba
          </p>
        </CardContent>
      </Card>
    )
  }

  if (participation.status === 'declined') {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <X className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Has declinado esta invitación</h3>
          <p className="text-muted-foreground">
            Si cambias de opinión, puedes responder de nuevo
          </p>
          <Button 
            className="mt-4" 
            variant="outline"
            onClick={() => submitRSVP(true)}
            disabled={isLoading || isDeadlinePassed}
          >
            Cambiar respuesta
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Response status */}
      {hasResponded && participation.status === 'interested' && (
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="h-5 w-5" />
              <span className="font-medium">Has confirmado tu interés</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Puedes actualizar tus preferencias hasta que el organizador confirme la quedada
            </p>
          </CardContent>
        </Card>
      )}

      {/* Date selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Disponibilidad
          </CardTitle>
          <CardDescription>
            Selecciona las fechas en las que puedes asistir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.event_dates?.map((date) => {
            const voteCount = dateVoteCounts.find(v => v.dateId === date.id)?.count || 0
            
            return (
              <label
                key={date.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedDates.includes(date.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedDates.includes(date.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedDates(prev => [...prev, date.id])
                      } else {
                        setSelectedDates(prev => prev.filter(id => id !== date.id))
                      }
                    }}
                    disabled={isDeadlinePassed}
                  />
                  <div>
                    <p className="font-medium">{formatDate(date.proposed_date)}</p>
                    {date.start_time && (
                      <p className="text-sm text-muted-foreground">
                        {date.start_time.slice(0, 5)}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">
                  {voteCount} disponible{voteCount !== 1 ? 's' : ''}
                </Badge>
              </label>
            )
          })}
        </CardContent>
      </Card>

      {/* Game voting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Votar juegos
          </CardTitle>
          <CardDescription>
            Indica qué juegos te gustaría jugar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.event_games?.map((eventGame) => {
            const game = eventGame.games
            const voteCount = gameVoteCounts.find(v => v.gameId === eventGame.id)?.count || 0
            const myVote = gameVotes[eventGame.id] || 0

            return (
              <div
                key={eventGame.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {game.thumbnail && (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{game.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {game.min_players}-{game.max_players} jugadores
                      {eventGame.owner && ` • ${eventGame.owner.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {voteCount > 0 ? `+${voteCount}` : voteCount}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant={myVote === 1 ? 'default' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => toggleGameVote(eventGame.id, 1)}
                      disabled={isDeadlinePassed}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant={myVote === -1 ? 'destructive' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => toggleGameVote(eventGame.id, -1)}
                      disabled={isDeadlinePassed}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Action buttons */}
      {!isDeadlinePassed && (
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => submitRSVP(false)}
            disabled={isLoading}
          >
            <X className="mr-2 h-4 w-4" />
            No puedo asistir
          </Button>
          <Button
            onClick={() => submitRSVP(true)}
            disabled={isLoading || selectedDates.length === 0}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {hasResponded ? 'Actualizar respuesta' : 'Confirmar asistencia'}
          </Button>
        </div>
      )}

      {isDeadlinePassed && (
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardContent className="py-4 text-center">
            <p className="text-yellow-700 dark:text-yellow-400 font-medium">
              La fecha límite de respuesta ha pasado
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

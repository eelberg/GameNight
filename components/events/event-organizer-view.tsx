'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { 
  Check, 
  Clock, 
  Users, 
  Gamepad2,
  Loader2,
  Calendar,
  Star,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface EventOrganizerViewProps {
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
      game_id: number
      games: {
        bgg_id: number
        name: string
        thumbnail: string | null
        min_players: number
        max_players: number
      }
      owner: { id: string; name: string } | null
    }[]
    event_participants: {
      id: string
      status: string
      user: {
        id: string
        name: string
        email: string
        avatar_url: string | null
      }
      date_votes: { date_id: string; available: boolean }[]
      game_votes: { event_game_id: string; vote: number }[]
    }[]
  }
  dateVoteCounts: { dateId: string; count: number }[]
  gameVoteCounts: { gameId: string; count: number }[]
}

const participantStatusConfig = {
  pending: { label: 'Pendiente', color: 'bg-muted text-muted-foreground' },
  interested: { label: 'Interesado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  declined: { label: 'Declinado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

export function EventOrganizerView({ event, dateVoteCounts, gameVoteCounts }: EventOrganizerViewProps) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [selectedDateId, setSelectedDateId] = useState<string>('')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])
  const [gameResponsibles, setGameResponsibles] = useState<Record<string, string>>({})

  const totalParticipants = event.event_participants?.length || 0
  const respondedCount = event.event_participants?.filter(
    p => p.status !== 'pending'
  ).length || 0
  const interestedCount = event.event_participants?.filter(
    p => p.status === 'interested' || p.status === 'confirmed'
  ).length || 0

  // Sort dates by vote count
  const sortedDates = [...(event.event_dates || [])].sort((a, b) => {
    const aVotes = dateVoteCounts.find(v => v.dateId === a.id)?.count || 0
    const bVotes = dateVoteCounts.find(v => v.dateId === b.id)?.count || 0
    return bVotes - aVotes
  })

  // Sort games by vote count
  const sortedGames = [...(event.event_games || [])].sort((a, b) => {
    const aVotes = gameVoteCounts.find(v => v.gameId === a.id)?.count || 0
    const bVotes = gameVoteCounts.find(v => v.gameId === b.id)?.count || 0
    return bVotes - aVotes
  })

  // Get interested participants for assigning game responsibility
  const interestedParticipants = event.event_participants?.filter(
    p => p.status === 'interested' || p.status === 'confirmed'
  ) || []

  async function confirmEvent() {
    if (!selectedDateId) {
      toast.error('Selecciona una fecha')
      return
    }

    if (selectedGameIds.length === 0) {
      toast.error('Selecciona al menos un juego')
      return
    }

    // Check all games have a responsible
    const missingResponsible = selectedGameIds.some(id => !gameResponsibles[id])
    if (missingResponsible) {
      toast.error('Asigna un responsable a cada juego')
      return
    }

    setIsConfirming(true)
    const supabase = createClient()

    try {
      // Update event status and final date
      await supabase
        .from('events')
        .update({
          status: 'confirmed',
          final_date_id: selectedDateId,
        })
        .eq('id', event.id)

      // Add final games
      const finalGames = selectedGameIds.map(gameId => {
        const eventGame = event.event_games?.find(g => g.id === gameId)
        return {
          event_id: event.id,
          game_id: eventGame?.game_id,
          responsible_user_id: gameResponsibles[gameId],
        }
      })

      await supabase
        .from('event_final_games')
        .insert(finalGames)

      // Update participant statuses to confirmed
      await supabase
        .from('event_participants')
        .update({ status: 'confirmed' })
        .eq('event_id', event.id)
        .in('status', ['interested'])

      toast.success('¡Quedada confirmada!')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Error al confirmar la quedada')
    } finally {
      setIsConfirming(false)
    }
  }

  function toggleGameSelection(gameId: string) {
    setSelectedGameIds(prev => 
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    )
  }

  if (event.status === 'confirmed' || event.status === 'completed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes confirmados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.event_participants?.filter(p => p.status === 'confirmed').map(participant => (
            <div key={participant.id} className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={participant.user.avatar_url || undefined} />
                <AvatarFallback>
                  {participant.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{participant.user.name}</p>
                <p className="text-sm text-muted-foreground">{participant.user.email}</p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-800">Confirmado</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Response progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Respuestas
          </CardTitle>
          <CardDescription>
            {respondedCount} de {totalParticipants} han respondido
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={(respondedCount / totalParticipants) * 100} />
          
          <div className="space-y-3">
            {event.event_participants?.map(participant => {
              const statusConfig = participantStatusConfig[participant.status as keyof typeof participantStatusConfig]
              
              return (
                <div key={participant.id} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={participant.user.avatar_url || undefined} />
                    <AvatarFallback>
                      {participant.user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{participant.user.name}</p>
                    <p className="text-sm text-muted-foreground">{participant.user.email}</p>
                  </div>
                  <Badge className={statusConfig.color}>
                    {statusConfig.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Date results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Disponibilidad por fecha
          </CardTitle>
          <CardDescription>
            Ordenadas por número de personas disponibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedDates.map((date, index) => {
            const voteCount = dateVoteCounts.find(v => v.dateId === date.id)?.count || 0
            const percentage = interestedCount > 0 ? (voteCount / interestedCount) * 100 : 0
            const isTopChoice = index === 0 && voteCount > 0
            
            return (
              <div
                key={date.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedDateId === date.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                  isTopChoice && 'ring-2 ring-yellow-400'
                )}
                onClick={() => setSelectedDateId(date.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isTopChoice && <Star className="h-4 w-4 text-yellow-500" />}
                    <span className="font-medium">{formatDate(date.proposed_date)}</span>
                    {date.start_time && (
                      <span className="text-sm text-muted-foreground">
                        {date.start_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <Badge variant={isTopChoice ? 'default' : 'secondary'}>
                    {voteCount} disponible{voteCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Game results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Votación de juegos
          </CardTitle>
          <CardDescription>
            Selecciona los juegos para la quedada y asigna responsables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedGames.map((eventGame, index) => {
            const game = eventGame.games
            const voteCount = gameVoteCounts.find(v => v.gameId === eventGame.id)?.count || 0
            const isTopChoice = index === 0 && voteCount > 0
            const isSelected = selectedGameIds.includes(eventGame.id)
            
            return (
              <div
                key={eventGame.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                  isTopChoice && 'ring-2 ring-yellow-400'
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleGameSelection(eventGame.id)}
                    className="h-4 w-4"
                  />
                  {game.thumbnail && (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isTopChoice && <Star className="h-4 w-4 text-yellow-500" />}
                      <span className="font-medium">{game.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {game.min_players}-{game.max_players} jugadores
                      {eventGame.owner && ` • Tiene: ${eventGame.owner.name}`}
                    </p>
                  </div>
                  <Badge variant={voteCount > 0 ? 'default' : voteCount < 0 ? 'destructive' : 'secondary'}>
                    {voteCount > 0 ? `+${voteCount}` : voteCount}
                  </Badge>
                </div>
                
                {isSelected && (
                  <div className="mt-3 pl-7">
                    <label className="text-sm font-medium">Responsable de llevar:</label>
                    <Select
                      value={gameResponsibles[eventGame.id] || ''}
                      onValueChange={(value) => 
                        setGameResponsibles(prev => ({ ...prev, [eventGame.id]: value }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        {interestedParticipants.map(p => (
                          <SelectItem key={p.user.id} value={p.user.id}>
                            {p.user.name}
                            {eventGame.owner?.id === p.user.id && ' (tiene el juego)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Separator />

      {/* Confirm action */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmar quedada</CardTitle>
          <CardDescription>
            Una vez confirmes, se notificará a todos los participantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interestedCount === 0 ? (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <span>Espera a que algunos invitados confirmen su interés</span>
            </div>
          ) : (
            <Button
              onClick={confirmEvent}
              disabled={isConfirming || !selectedDateId || selectedGameIds.length === 0}
              className="w-full"
            >
              {isConfirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Confirmar quedada ({interestedCount} asistentes)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

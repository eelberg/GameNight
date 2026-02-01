import { notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Gamepad2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Share2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import { EventRSVP } from '@/components/events/event-rsvp'
import { EventOrganizerView } from '@/components/events/event-organizer-view'

interface Props {
  params: Promise<{ id: string }>
}

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground', icon: AlertCircle },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Get event with all related data
  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      organizer:profiles!events_organizer_id_fkey (id, name, email, avatar_url),
      event_dates (*),
      event_games (
        *,
        games (*),
        proposed_by_user:profiles!event_games_proposed_by_fkey (id, name),
        owner:profiles!event_games_owner_id_fkey (id, name)
      ),
      event_participants (
        *,
        user:profiles!event_participants_user_id_fkey (id, name, email, avatar_url),
        date_votes (*),
        game_votes (*)
      ),
      event_final_games (
        *,
        games (*),
        responsible:profiles!event_final_games_responsible_user_id_fkey (id, name)
      )
    `)
    .eq('id', id)
    .single()

  if (!event) {
    notFound()
  }

  // Check if user is organizer or participant
  const isOrganizer = event.organizer_id === user.id
  const myParticipation = event.event_participants?.find(
    (p: { user_id: string }) => p.user_id === user.id
  )

  if (!isOrganizer && !myParticipation) {
    notFound()
  }

  const status = statusConfig[event.status as keyof typeof statusConfig]
  const StatusIcon = status.icon

  // Calculate date votes
  const dateVoteCounts = event.event_dates?.map((date: { id: string }) => {
    const votes = event.event_participants?.flatMap(
      (p: { date_votes: { date_id: string; available: boolean }[] }) => 
        p.date_votes?.filter((v: { date_id: string; available: boolean }) => v.date_id === date.id && v.available) || []
    ) || []
    return { dateId: date.id, count: votes.length }
  }) || []

  // Calculate game votes
  const gameVoteCounts = event.event_games?.map((game: { id: string }) => {
    const votes = event.event_participants?.flatMap(
      (p: { game_votes: { event_game_id: string; vote: number }[] }) => 
        p.game_votes?.filter((v: { event_game_id: string }) => v.event_game_id === game.id) || []
    ) || []
    const totalVotes = votes.reduce((sum: number, v: { vote: number }) => sum + v.vote, 0)
    return { gameId: game.id, count: totalVotes }
  }) || []

  return (
    <div className="container py-8 max-w-4xl">
      <Link href="/events">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a quedadas
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          {event.description && (
            <p className="text-muted-foreground">{event.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </Button>
        </div>
      </div>

      {/* Quick info */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {event.event_dates?.length || 0} fechas propuestas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {event.event_participants?.length || 0} invitados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {event.event_games?.length || 0} juegos propuestos
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">{event.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organizer info */}
      {!isOrganizer && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Organizador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={event.organizer?.avatar_url || undefined} />
                <AvatarFallback>
                  {event.organizer?.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{event.organizer?.name}</p>
                <p className="text-sm text-muted-foreground">{event.organizer?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmed event details */}
      {event.status === 'confirmed' && event.final_date_id && (
        <Card className="mb-6 border-green-200 dark:border-green-900">
          <CardHeader className="bg-green-50 dark:bg-green-900/20">
            <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              ¡Quedada confirmada!
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {event.event_dates?.find((d: { id: string }) => d.id === event.final_date_id) && (
              <div className="mb-4">
                <p className="font-medium">
                  📅 {formatDate(event.event_dates.find((d: { id: string }) => d.id === event.final_date_id)?.proposed_date)}
                </p>
                {event.event_dates.find((d: { id: string }) => d.id === event.final_date_id)?.start_time && (
                  <p className="text-muted-foreground">
                    🕐 {event.event_dates.find((d: { id: string }) => d.id === event.final_date_id)?.start_time?.slice(0, 5)}
                  </p>
                )}
                {event.location && (
                  <p className="text-muted-foreground">📍 {event.location}</p>
                )}
              </div>
            )}
            
            {event.event_final_games && event.event_final_games.length > 0 && (
              <div>
                <p className="font-medium mb-2">Juegos a jugar:</p>
                <div className="space-y-2">
                  {event.event_final_games.map((fg: { id: string; games: { name: string; thumbnail: string | null }; responsible: { name: string } }) => (
                    <div key={fg.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      {fg.games?.thumbnail && (
                        <img 
                          src={fg.games.thumbnail} 
                          alt={fg.games?.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{fg.games?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Lleva: {fg.responsible?.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Show different views based on role */}
      {isOrganizer ? (
        <EventOrganizerView 
          event={event}
          dateVoteCounts={dateVoteCounts}
          gameVoteCounts={gameVoteCounts}
        />
      ) : (
        <EventRSVP
          event={event}
          participation={myParticipation}
          dateVoteCounts={dateVoteCounts}
          gameVoteCounts={gameVoteCounts}
        />
      )}
    </div>
  )
}

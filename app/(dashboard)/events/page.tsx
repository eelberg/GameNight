import Link from 'next/link'
import { Plus, Calendar, Clock, Users, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/utils'

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get events organized by user
  const { data: organizedEvents } = await supabase
    .from('events')
    .select(`
      *,
      event_dates (id, proposed_date, start_time),
      event_participants (id, user_id, status)
    `)
    .eq('organizer_id', user?.id)
    .order('created_at', { ascending: false })

  // Get events user is invited to
  const { data: invitedEvents } = await supabase
    .from('event_participants')
    .select(`
      status,
      events (
        *,
        organizer_id,
        profiles!events_organizer_id_fkey (name, avatar_url),
        event_dates (id, proposed_date, start_time),
        event_participants (id, user_id, status)
      )
    `)
    .eq('user_id', user?.id)

  const myEvents = organizedEvents || []
  
  type InvitedEventRow = {
    status: string
    events: {
      id: string
      title: string
      description?: string | null
      location?: string | null
      status: string
      response_deadline: string
      event_dates?: { id: string; proposed_date: string; start_time?: string | null }[]
      event_participants?: { id: string; user_id: string; status: string }[]
      profiles?: { name: string; avatar_url?: string | null }
    }
  }
  
  const invitations = (invitedEvents as unknown as InvitedEventRow[] | null)?.map(e => ({
    ...e.events,
    myStatus: e.status,
    organizer: e.events?.profiles
  })).filter(Boolean) || []

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quedadas</h1>
          <p className="text-muted-foreground mt-1">
            Organiza y participa en quedadas de juegos de mesa
          </p>
        </div>
        <Link href="/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva quedada
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="organized" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organized">
            Mis quedadas ({myEvents.length})
          </TabsTrigger>
          <TabsTrigger value="invited">
            Invitaciones ({invitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organized" className="space-y-4">
          {myEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tienes quedadas</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crea tu primera quedada para reunirte con amigos a jugar
                </p>
                <Link href="/events/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear quedada
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            myEvents.map((event) => (
              <EventCard key={event.id} event={event} isOrganizer />
            ))
          )}
        </TabsContent>

        <TabsContent value="invited" className="space-y-4">
          {invitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tienes invitaciones</h3>
                <p className="text-muted-foreground text-center">
                  Cuando tus amigos te inviten a una quedada, aparecerá aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            invitations.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                organizer={event.organizer}
                myStatus={event.myStatus}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface EventCardProps {
  event: {
    id: string
    title: string
    description?: string | null
    location?: string | null
    status: string
    response_deadline: string
    event_dates?: { id: string; proposed_date: string; start_time?: string | null }[]
    event_participants?: { id: string; user_id: string; status: string }[]
  }
  isOrganizer?: boolean
  organizer?: { name: string; avatar_url?: string | null } | null
  myStatus?: string
}

function EventCard({ event, isOrganizer, organizer, myStatus }: EventCardProps) {
  const nextDate = event.event_dates?.[0]
  const participantCount = event.event_participants?.length || 0
  const confirmedCount = event.event_participants?.filter(p => 
    p.status === 'confirmed' || p.status === 'interested'
  ).length || 0

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{event.title}</CardTitle>
              {event.description && (
                <CardDescription className="line-clamp-2">
                  {event.description}
                </CardDescription>
              )}
            </div>
            <Badge className={statusColors[event.status]}>
              {statusLabels[event.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {nextDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(nextDate.proposed_date)}</span>
              </div>
            )}
            {nextDate?.start_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{nextDate.start_time.slice(0, 5)}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{confirmedCount}/{participantCount} confirmados</span>
            </div>
          </div>

          {!isOrganizer && organizer && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Avatar className="h-6 w-6">
                <AvatarImage src={organizer.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {organizer.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Organizada por <span className="font-medium text-foreground">{organizer.name}</span>
              </span>
              {myStatus && (
                <Badge variant="outline" className="ml-auto">
                  {myStatus === 'pending' ? 'Pendiente de respuesta' : 
                   myStatus === 'interested' ? 'Interesado' :
                   myStatus === 'confirmed' ? 'Confirmado' : 'Declinado'}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

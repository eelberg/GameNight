'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { 
  Loader2, 
  Plus, 
  X, 
  Calendar as CalendarIcon,
  Users,
  Gamepad2,
  ArrowLeft,
  ArrowRight,
  Check
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const eventSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  location: z.string().optional(),
  responseDeadline: z.date({ message: 'Selecciona una fecha límite de respuesta' }),
})

type EventForm = z.infer<typeof eventSchema>

interface Friend {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface Game {
  bgg_id: number
  name: string
  thumbnail: string | null
  min_players: number
  max_players: number
  owner_id: string
  owner_name: string
}

interface ProposedDate {
  date: Date
  startTime: string
}

export default function NewEventPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [availableGames, setAvailableGames] = useState<Game[]>([])
  const [selectedGames, setSelectedGames] = useState<number[]>([])
  const [proposedDates, setProposedDates] = useState<ProposedDate[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      location: '',
      responseDeadline: addDays(new Date(), 7),
    },
  })

  useEffect(() => {
    loadFriends()
  }, [])

  useEffect(() => {
    if (selectedFriends.length > 0) {
      loadGamesFromCollections()
    } else {
      setAvailableGames([])
    }
  }, [selectedFriends])

  async function loadFriends() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: friendships } = await supabase
      .from('friendships')
      .select(`
        requester_id,
        addressee_id,
        requester:profiles!friendships_requester_id_fkey (id, name, email, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey (id, name, email, avatar_url)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (friendships) {
      const friendList: Friend[] = (friendships as unknown as Array<{
        requester_id: string
        addressee_id: string
        requester: { id: string; name: string; email: string; avatar_url: string | null }
        addressee: { id: string; name: string; email: string; avatar_url: string | null }
      }>).map(f => {
        const friendData = f.requester_id === user.id ? f.addressee : f.requester
        if (!friendData) return null
        return {
          id: friendData.id,
          name: friendData.name,
          email: friendData.email,
          avatar_url: friendData.avatar_url,
        }
      }).filter((f): f is Friend => f !== null)

      setFriends(friendList)
    }
  }

  async function loadGamesFromCollections() {
    const supabase = createClient()
    const userIds = currentUserId ? [currentUserId, ...selectedFriends] : selectedFriends

    const { data: collections } = await supabase
      .from('game_collections')
      .select(`
        user_id,
        games (*),
        profiles!game_collections_user_id_fkey (name)
      `)
      .in('user_id', userIds)
      .eq('own', true)

    if (collections) {
      const gamesMap = new Map<number, Game>()
      
      type CollectionRow = {
        user_id: string
        games: {
          bgg_id: number
          name: string
          thumbnail: string | null
          min_players: number
          max_players: number
        }
        profiles: { name: string }
      }
      
      ;(collections as unknown as CollectionRow[]).forEach(c => {
        const game = c.games
        const profile = c.profiles
        
        if (!gamesMap.has(game.bgg_id)) {
          gamesMap.set(game.bgg_id, {
            ...game,
            owner_id: c.user_id,
            owner_name: profile.name,
          })
        }
      })

      setAvailableGames(Array.from(gamesMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  function addDate() {
    setProposedDates(prev => [...prev, { date: new Date(), startTime: '18:00' }])
  }

  function removeDate(index: number) {
    setProposedDates(prev => prev.filter((_, i) => i !== index))
  }

  function updateDate(index: number, updates: Partial<ProposedDate>) {
    setProposedDates(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d))
  }

  async function onSubmit(data: EventForm) {
    if (proposedDates.length === 0) {
      toast.error('Añade al menos una fecha propuesta')
      return
    }

    if (selectedFriends.length === 0) {
      toast.error('Selecciona al menos un amigo para invitar')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          location: data.location,
          responseDeadline: data.responseDeadline.toISOString(),
          dates: proposedDates.map(d => ({
            date: format(d.date, 'yyyy-MM-dd'),
            startTime: d.startTime,
          })),
          games: selectedGames.map(gameId => {
            const game = availableGames.find(g => g.bgg_id === gameId)
            return {
              gameId,
              ownerId: game?.owner_id,
            }
          }),
          participants: selectedFriends,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      // Send invitations
      await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: result.eventId,
          userIds: selectedFriends,
          sendEmail: true,
        }),
      })

      toast.success('¡Quedada creada y invitaciones enviadas!')
      router.push(`/events/${result.eventId}`)
    } catch (error) {
      toast.error('Error al crear la quedada')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalSteps = 4

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Nueva quedada</h1>
        <p className="text-muted-foreground mt-1">
          Paso {step} de {totalSteps}
        </p>
        
        {/* Progress bar */}
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Información básica</CardTitle>
                <CardDescription>
                  Define el título y detalles de la quedada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título de la quedada</FormLabel>
                      <FormControl>
                        <Input placeholder="Noche de Catan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe la quedada..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lugar (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Casa de Juan, Calle Mayor 10..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responseDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha límite de respuesta</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP', { locale: es }) : 'Selecciona fecha'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Los invitados deberán responder antes de esta fecha
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Friends */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Invitar amigos
                </CardTitle>
                <CardDescription>
                  Selecciona los amigos que quieres invitar ({selectedFriends.length} seleccionados)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tienes amigos agregados aún</p>
                    <Button variant="link" onClick={() => router.push('/friends')}>
                      Agregar amigos
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <label
                        key={friend.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedFriends.includes(friend.id) 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedFriends.includes(friend.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFriends(prev => [...prev, friend.id])
                            } else {
                              setSelectedFriends(prev => prev.filter(id => id !== friend.id))
                            }
                          }}
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback>
                            {friend.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{friend.name}</p>
                          <p className="text-sm text-muted-foreground">{friend.email}</p>
                        </div>
                        {selectedFriends.includes(friend.id) && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Proposed Dates */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Fechas propuestas
                </CardTitle>
                <CardDescription>
                  Añade las fechas posibles para la quedada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {proposedDates.map((pd, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Fecha</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(pd.date, 'PPP', { locale: es })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={pd.date}
                            onSelect={(date) => date && updateDate(index, { date })}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-32">
                      <label className="text-sm font-medium mb-2 block">Hora</label>
                      <Input
                        type="time"
                        value={pd.startTime}
                        onChange={(e) => updateDate(index, { startTime: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDate(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Button type="button" variant="outline" onClick={addDate} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir fecha
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Select Games */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Juegos propuestos
                </CardTitle>
                <CardDescription>
                  Selecciona juegos de las colecciones de los invitados ({selectedGames.length} seleccionados)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableGames.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay juegos disponibles</p>
                    <p className="text-sm">Los invitados deben sincronizar sus colecciones de BGG</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {availableGames.map((game) => (
                      <label
                        key={game.bgg_id}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
                          selectedGames.includes(game.bgg_id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedGames.includes(game.bgg_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedGames(prev => [...prev, game.bgg_id])
                            } else {
                              setSelectedGames(prev => prev.filter(id => id !== game.bgg_id))
                            }
                          }}
                        />
                        {game.thumbnail && (
                          <img
                            src={game.thumbnail}
                            alt={game.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{game.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {game.min_players}-{game.max_players} jugadores
                          </p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {game.owner_name}
                          </Badge>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step > 1 ? 'Anterior' : 'Cancelar'}
            </Button>

            {step < totalSteps ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1) {
                    form.trigger(['title', 'responseDeadline']).then(valid => {
                      if (valid) setStep(step + 1)
                    })
                  } else if (step === 2 && selectedFriends.length === 0) {
                    toast.error('Selecciona al menos un amigo')
                  } else if (step === 3 && proposedDates.length === 0) {
                    toast.error('Añade al menos una fecha')
                  } else {
                    setStep(step + 1)
                  }
                }}
              >
                Siguiente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Crear y enviar invitaciones
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

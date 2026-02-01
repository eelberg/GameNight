'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Users, Clock, Star, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'

interface CollectionGame {
  id: string
  game_id: number
  user_rating: number | null
  own: boolean
  want_to_play: boolean
  num_plays: number
  last_synced: string
  games: {
    bgg_id: number
    name: string
    thumbnail: string | null
    min_players: number
    max_players: number
    playing_time: number
    bgg_rating: number | null
    year_published: number | null
  }
}

export default function CollectionPage() {
  const router = useRouter()
  const [collection, setCollection] = useState<CollectionGame[]>([])
  const [filteredCollection, setFilteredCollection] = useState<CollectionGame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [bggUsername, setBggUsername] = useState<string | null>(null)

  useEffect(() => {
    loadCollection()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = collection.filter(item =>
        item.games.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredCollection(filtered)
    } else {
      setFilteredCollection(collection)
    }
  }, [searchQuery, collection])

  async function loadCollection() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('bgg_username')
      .eq('id', user.id)
      .single()

    setBggUsername(profile?.bgg_username || null)

    const { data } = await supabase
      .from('game_collections')
      .select(`
        *,
        games (*)
      `)
      .eq('user_id', user.id)
      .order('games(name)')

    setCollection((data as CollectionGame[]) || [])
    setFilteredCollection((data as CollectionGame[]) || [])
    setIsLoading(false)
  }

  async function syncCollection() {
    if (!bggUsername) {
      toast.error('Configura tu usuario de BGG primero')
      router.push('/settings')
      return
    }

    setIsSyncing(true)
    try {
      const response = await fetch('/api/bgg/collection', {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      toast.success(result.message)
      await loadCollection()
    } catch (error) {
      toast.error('Error al sincronizar: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Colección</h1>
          <p className="text-muted-foreground mt-1">
            {collection.length} juegos en tu colección
          </p>
        </div>
        <Button onClick={syncCollection} disabled={isSyncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar con BGG'}
        </Button>
      </div>

      {!bggUsername && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Usuario de BGG no configurado</AlertTitle>
          <AlertDescription>
            Para sincronizar tu colección, configura tu usuario de BoardGameGeek en{' '}
            <Link href="/settings" className="font-medium underline">
              Configuración
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {collection.length === 0 && bggUsername ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              🎲
            </div>
            <h3 className="text-lg font-semibold mb-2">Colección vacía</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Sincroniza tu colección de BoardGameGeek para ver tus juegos aquí
            </p>
            <Button onClick={syncCollection} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar ahora
            </Button>
          </CardContent>
        </Card>
      ) : collection.length > 0 ? (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en tu colección..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCollection.map((item) => (
              <GameCard key={item.id} item={item} />
            ))}
          </div>

          {filteredCollection.length === 0 && searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron juegos que coincidan con "{searchQuery}"
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function GameCard({ item }: { item: CollectionGame }) {
  const game = item.games

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {game.thumbnail && (
          <div className="w-24 h-24 flex-shrink-0">
            <img
              src={game.thumbnail}
              alt={game.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <h3 className="font-semibold line-clamp-1">{game.name}</h3>
          {game.year_published && (
            <p className="text-sm text-muted-foreground">({game.year_published})</p>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {game.min_players}-{game.max_players}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {game.playing_time} min
            </Badge>
            {game.bgg_rating && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                {game.bgg_rating.toFixed(1)}
              </Badge>
            )}
          </div>
          
          {item.user_rating && (
            <p className="text-xs text-muted-foreground mt-2">
              Tu rating: {item.user_rating.toFixed(1)} ⭐
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

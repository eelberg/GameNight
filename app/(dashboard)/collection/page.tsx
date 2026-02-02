'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Users, Clock, Star, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import type { BGGCollectionItem } from '@/types'

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

  // Fetch BGG collection via our API proxy
  async function fetchBGGCollection(username: string): Promise<BGGCollectionItem[]> {
    const MAX_ATTEMPTS = 15
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      toast.info(`Contactando BGG... (intento ${attempt}/${MAX_ATTEMPTS})`)
      
      try {
        const response = await fetch(`/api/bgg/collection?username=${encodeURIComponent(username)}`)
        
        // Check for processing status (202 or JSON error with retry flag)
        if (response.status === 202) {
          toast.info('BGG está procesando tu colección...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }
        
        const contentType = response.headers.get('content-type') || ''
        
        // If JSON, it's an error response
        if (contentType.includes('application/json')) {
          const errorData = await response.json()
          if (errorData.retry || response.status >= 500) {
            await new Promise(resolve => setTimeout(resolve, 4000))
            continue
          }
          throw new Error(errorData.error || `Error ${response.status}`)
        }
        
        // Otherwise it's XML - parse it
        const xml = await response.text()
        
        if (!xml.includes('<items')) {
          await new Promise(resolve => setTimeout(resolve, 4000))
          continue
        }
        
        return parseBGGXML(xml)
      } catch (error) {
        console.error('Fetch error:', error)
        if (attempt === MAX_ATTEMPTS) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 4000))
      }
    }
    
    throw new Error('BGG tardó demasiado. Intenta de nuevo en unos minutos.')
  }

  function parseBGGXML(xml: string): BGGCollectionItem[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    
    const items = doc.querySelectorAll('item')
    const collection: BGGCollectionItem[] = []
    
    items.forEach(item => {
      const bggId = parseInt(item.getAttribute('objectid') || '0', 10)
      const nameEl = item.querySelector('name')
      const name = nameEl?.textContent || 'Unknown'
      const thumbnail = item.querySelector('thumbnail')?.textContent || undefined
      const image = item.querySelector('image')?.textContent || undefined
      const yearEl = item.querySelector('yearpublished')
      const yearPublished = yearEl ? parseInt(yearEl.textContent || '0', 10) : undefined
      const numPlays = parseInt(item.querySelector('numplays')?.textContent || '0', 10)
      
      const stats = item.querySelector('stats')
      const minPlayers = parseInt(stats?.getAttribute('minplayers') || '1', 10)
      const maxPlayers = parseInt(stats?.getAttribute('maxplayers') || '99', 10)
      const playingTime = parseInt(stats?.getAttribute('playingtime') || '0', 10)
      
      const rating = item.querySelector('rating')
      const userRatingVal = rating?.getAttribute('value')
      const userRating = userRatingVal && userRatingVal !== 'N/A' ? parseFloat(userRatingVal) : undefined
      
      const avgRating = rating?.querySelector('average')?.getAttribute('value')
      const bggRating = avgRating ? parseFloat(avgRating) : undefined
      
      const status = item.querySelector('status')
      const own = status?.getAttribute('own') === '1'
      const wantToPlay = status?.getAttribute('wanttoplay') === '1'
      
      collection.push({
        bggId,
        name,
        thumbnail,
        image,
        minPlayers,
        maxPlayers,
        playingTime,
        bggRating,
        yearPublished,
        userRating,
        own,
        wantToPlay,
        numPlays,
      })
    })
    
    return collection
  }

  async function handleCSVImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsSyncing(true)
    toast.info('Procesando archivo CSV...')

    try {
      const text = await file.text()
      const lines = text.split('\n')
      
      // Parse CSV header
      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      
      // Find column indices
      const objectIdIdx = header.findIndex(h => h === 'objectid' || h === 'bggid')
      const nameIdx = header.findIndex(h => h === 'objectname' || h === 'name')
      const yearIdx = header.findIndex(h => h === 'yearpublished')
      const ratingIdx = header.findIndex(h => h === 'rating' || h === 'userrating')
      const numPlaysIdx = header.findIndex(h => h === 'numplays')
      const ownIdx = header.findIndex(h => h === 'own')
      const minPlayersIdx = header.findIndex(h => h === 'minplayers')
      const maxPlayersIdx = header.findIndex(h => h === 'maxplayers')
      const playingTimeIdx = header.findIndex(h => h === 'playingtime')
      const thumbnailIdx = header.findIndex(h => h === 'thumbnail')
      const imageIdx = header.findIndex(h => h === 'image' || h === 'imageid')
      const avgRatingIdx = header.findIndex(h => h === 'avgrating' || h === 'average')

      if (objectIdIdx === -1 || nameIdx === -1) {
        throw new Error('CSV inválido. Asegúrate de exportarlo desde BGG.')
      }

      const collection: BGGCollectionItem[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Parse CSV line (handle quoted values with commas)
        const values: string[] = []
        let current = ''
        let inQuotes = false
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        values.push(current.trim())

        const bggId = parseInt(values[objectIdIdx], 10)
        if (isNaN(bggId)) continue

        const own = ownIdx !== -1 ? values[ownIdx] === '1' : true
        if (!own) continue // Only import owned games

        collection.push({
          bggId,
          name: values[nameIdx]?.replace(/"/g, '') || 'Unknown',
          thumbnail: thumbnailIdx !== -1 ? values[thumbnailIdx] : undefined,
          image: imageIdx !== -1 ? values[imageIdx] : undefined,
          minPlayers: minPlayersIdx !== -1 ? parseInt(values[minPlayersIdx], 10) || 1 : 1,
          maxPlayers: maxPlayersIdx !== -1 ? parseInt(values[maxPlayersIdx], 10) || 99 : 99,
          playingTime: playingTimeIdx !== -1 ? parseInt(values[playingTimeIdx], 10) || 0 : 0,
          bggRating: avgRatingIdx !== -1 ? parseFloat(values[avgRatingIdx]) || undefined : undefined,
          yearPublished: yearIdx !== -1 ? parseInt(values[yearIdx], 10) || undefined : undefined,
          userRating: ratingIdx !== -1 && values[ratingIdx] !== 'N/A' && values[ratingIdx] !== '' 
            ? parseFloat(values[ratingIdx]) || undefined 
            : undefined,
          own: true,
          wantToPlay: false,
          numPlays: numPlaysIdx !== -1 ? parseInt(values[numPlaysIdx], 10) || 0 : 0,
        })
      }

      if (collection.length === 0) {
        throw new Error('No se encontraron juegos en el CSV')
      }

      toast.info(`Guardando ${collection.length} juegos...`)

      // Save to database in batches
      const BATCH_SIZE = 50
      for (let i = 0; i < collection.length; i += BATCH_SIZE) {
        const batch = collection.slice(i, i + BATCH_SIZE)
        
        const response = await fetch('/api/bgg/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: batch }),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.details || result.error || 'Error al guardar')
        }
      }

      toast.success(`Importados ${collection.length} juegos desde CSV`)
      await loadCollection()
    } catch (error) {
      toast.error('Error al importar: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSyncing(false)
      // Reset the file input
      event.target.value = ''
    }
  }

  async function syncCollection() {
    if (!bggUsername) {
      toast.error('Configura tu usuario de BGG primero')
      router.push('/settings')
      return
    }

    setIsSyncing(true)
    try {
      // Step 1: Fetch collection directly from BGG (client-side, no timeout!)
      const collection = await fetchBGGCollection(bggUsername)
      
      if (collection.length === 0) {
        toast.info('No se encontraron juegos en tu colección de BGG')
        setIsSyncing(false)
        return
      }

      // Step 2: Save to database in batches
      toast.info(`Guardando ${collection.length} juegos...`)
      const BATCH_SIZE = 50
      
      for (let i = 0; i < collection.length; i += BATCH_SIZE) {
        const batch = collection.slice(i, i + BATCH_SIZE)
        toast.info(`Guardando juegos ${i + 1}-${Math.min(i + BATCH_SIZE, collection.length)}...`)
        
        const response = await fetch('/api/bgg/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: batch }),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.details || result.error || 'Error al guardar')
        }
      }

      toast.success(`Sincronizados ${collection.length} juegos`)
      await loadCollection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Error al sincronizar: ' + message)
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
        <div className="flex gap-2">
          <Button onClick={syncCollection} disabled={isSyncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar con BGG'}
          </Button>
          <label>
            <Button variant="outline" asChild disabled={isSyncing}>
              <span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVImport}
                  disabled={isSyncing}
                />
                Importar CSV
              </span>
            </Button>
          </label>
        </div>
      </div>

      {!bggUsername && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Usuario de BGG no configurado</AlertTitle>
          <AlertDescription>
            Configura tu usuario de BoardGameGeek en{' '}
            <Link href="/settings" className="font-medium underline">
              Configuración
            </Link>
            {' '}o importa tu colección usando el botón &quot;Importar CSV&quot;.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>¿Problemas con la sincronización?</AlertTitle>
        <AlertDescription>
          Si la sincronización automática falla, puedes importar tu colección manualmente:
          <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
            <li>Ve a <a href="https://boardgamegeek.com/collection/user/" target="_blank" rel="noopener noreferrer" className="underline">tu colección en BGG</a></li>
            <li>Haz clic en el botón &quot;⋯&quot; (más opciones) arriba de tu colección</li>
            <li>Selecciona &quot;Export Collection to CSV&quot;</li>
            <li>Descarga el archivo y usa el botón &quot;Importar CSV&quot; aquí</li>
          </ol>
        </AlertDescription>
      </Alert>

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

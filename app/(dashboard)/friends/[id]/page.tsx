import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Clock, Star, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FriendProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Check if they are friends
  const { data: friendship } = await supabase
    .from('friendships')
    .select('status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .single()

  if (!friendship) {
    notFound()
  }

  // Get friend's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) {
    notFound()
  }

  // Get friend's collection
  const { data: collection } = await supabase
    .from('game_collections')
    .select(`
      *,
      games (*)
    `)
    .eq('user_id', id)
    .order('games(name)')

  return (
    <div className="container py-8 max-w-6xl">
      <Link href="/friends">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a amigos
        </Button>
      </Link>

      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="flex items-center gap-6 py-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {profile.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-muted-foreground">{profile.email}</p>
            {profile.bgg_username && (
              <a 
                href={`https://boardgamegeek.com/user/${profile.bgg_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
              >
                BGG: {profile.bgg_username}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{collection?.length || 0}</div>
            <div className="text-sm text-muted-foreground">juegos</div>
          </div>
        </CardContent>
      </Card>

      {/* Collection */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Colección de juegos</h2>
        
        {!collection || collection.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                🎲
              </div>
              <h3 className="text-lg font-semibold mb-2">Colección vacía</h3>
              <p className="text-muted-foreground text-center">
                {profile.name} no ha sincronizado su colección de BGG
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collection.map((item) => {
              const game = item.games as {
                bgg_id: number
                name: string
                thumbnail: string | null
                min_players: number
                max_players: number
                playing_time: number
                bgg_rating: number | null
                year_published: number | null
              }
              
              return (
                <Card key={item.id} className="overflow-hidden">
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
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

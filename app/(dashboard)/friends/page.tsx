'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, UserPlus, Users, Check, X, Clock, Mail, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Friend {
  id: string
  name: string
  email: string
  bgg_username: string | null
  avatar_url: string | null
  friendshipId: string
  status: 'pending' | 'accepted'
  isRequester: boolean
}

interface SearchResult {
  id: string
  name: string
  email: string
  avatar_url: string | null
  bgg_username: string | null
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadFriends()
  }, [])

  async function loadFriends() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // Get all friendships where user is requester or addressee
    const { data: friendships } = await supabase
      .from('friendships')
      .select(`
        id,
        status,
        requester_id,
        addressee_id,
        requester:profiles!friendships_requester_id_fkey (id, name, email, avatar_url, bgg_username),
        addressee:profiles!friendships_addressee_id_fkey (id, name, email, avatar_url, bgg_username)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (friendships) {
      const accepted: Friend[] = []
      const pending: Friend[] = []

      type FriendshipRow = {
        id: string
        status: string
        requester_id: string
        addressee_id: string
        requester: { id: string; name: string; email: string; avatar_url: string | null; bgg_username: string | null }
        addressee: { id: string; name: string; email: string; avatar_url: string | null; bgg_username: string | null }
      }

      ;(friendships as unknown as FriendshipRow[]).forEach((f) => {
        const isRequester = f.requester_id === user.id
        const friendProfile = isRequester ? f.addressee : f.requester
        
        if (!friendProfile) return

        const friend: Friend = {
          id: friendProfile.id,
          name: friendProfile.name,
          email: friendProfile.email,
          bgg_username: friendProfile.bgg_username,
          avatar_url: friendProfile.avatar_url,
          friendshipId: f.id,
          status: f.status as 'pending' | 'accepted',
          isRequester,
        }

        if (f.status === 'accepted') {
          accepted.push(friend)
        } else if (f.status === 'pending') {
          pending.push(friend)
        }
      })

      setFriends(accepted)
      setPendingRequests(pending)
    }

    setIsLoading(false)
  }

  async function searchUsers() {
    if (!searchQuery || searchQuery.length < 2) return

    setIsSearching(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, bgg_username')
      .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .neq('id', currentUserId)
      .limit(10)

    // Filter out existing friends
    const friendIds = new Set([...friends, ...pendingRequests].map(f => f.id))
    const filtered = data?.filter(u => !friendIds.has(u.id)) || []

    setSearchResults(filtered)
    setIsSearching(false)
  }

  async function sendFriendRequest(userId: string) {
    const supabase = createClient()

    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: currentUserId,
        addressee_id: userId,
        status: 'pending',
      })

    if (error) {
      toast.error('Error al enviar solicitud')
      return
    }

    toast.success('Solicitud enviada')
    setSearchResults(prev => prev.filter(u => u.id !== userId))
    await loadFriends()
  }

  async function handleFriendRequest(friendshipId: string, accept: boolean) {
    const supabase = createClient()

    if (accept) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

      if (error) {
        toast.error('Error al aceptar solicitud')
        return
      }
      toast.success('Solicitud aceptada')
    } else {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) {
        toast.error('Error al rechazar solicitud')
        return
      }
      toast.success('Solicitud rechazada')
    }

    await loadFriends()
  }

  async function removeFriend(friendshipId: string) {
    const supabase = createClient()

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    if (error) {
      toast.error('Error al eliminar amigo')
      return
    }

    toast.success('Amigo eliminado')
    await loadFriends()
  }

  const incomingRequests = pendingRequests.filter(r => !r.isRequester)
  const outgoingRequests = pendingRequests.filter(r => r.isRequester)

  if (isLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Amigos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus amigos de GameNight
          </p>
        </div>
        
        <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Buscar amigos
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buscar usuarios</DialogTitle>
              <DialogDescription>
                Busca usuarios por nombre o email para añadirlos como amigos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                />
                <Button onClick={searchUsers} disabled={isSearching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => sendFriendRequest(user.id)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {searchResults.length === 0 && searchQuery && !isSearching && (
                  <p className="text-center text-muted-foreground py-4">
                    No se encontraron usuarios
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="friends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="friends">
            Amigos ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Solicitudes ({incomingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Enviadas ({outgoingRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {friends.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin amigos aún</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Busca usuarios para añadirlos como amigos
                </p>
                <Button onClick={() => setShowSearchDialog(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Buscar amigos
                </Button>
              </CardContent>
            </Card>
          ) : (
            friends.map((friend) => (
              <FriendCard 
                key={friend.id} 
                friend={friend}
                onRemove={() => removeFriend(friend.friendshipId)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {incomingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Sin solicitudes pendientes</h3>
              </CardContent>
            </Card>
          ) : (
            incomingRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={request.avatar_url || undefined} />
                      <AvatarFallback>
                        {request.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleFriendRequest(request.friendshipId, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleFriendRequest(request.friendshipId, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {outgoingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Sin solicitudes enviadas</h3>
              </CardContent>
            </Card>
          ) : (
            outgoingRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={request.avatar_url || undefined} />
                      <AvatarFallback>
                        {request.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Pendiente
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FriendCard({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <Link href={`/friends/${friend.id}`} className="flex items-center gap-3 flex-1">
          <Avatar className="h-12 w-12">
            <AvatarImage src={friend.avatar_url || undefined} />
            <AvatarFallback>
              {friend.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{friend.name}</p>
            <p className="text-sm text-muted-foreground">{friend.email}</p>
            {friend.bgg_username && (
              <p className="text-xs text-muted-foreground">BGG: {friend.bgg_username}</p>
            )}
          </div>
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/friends/${friend.id}`}>
              Ver colección
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

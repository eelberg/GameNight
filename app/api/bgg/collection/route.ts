import { NextRequest, NextResponse } from 'next/server'
import { getUserCollection } from '@/lib/bgg/api'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get('username')

  if (!username) {
    return NextResponse.json(
      { error: 'Username is required' },
      { status: 400 }
    )
  }

  try {
    const collection = await getUserCollection(username)
    return NextResponse.json(collection)
  } catch (error) {
    console.error('BGG API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection from BoardGameGeek' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Sync collection to database
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('bgg_username')
      .eq('id', user.id)
      .single()

    if (!profile?.bgg_username) {
      return NextResponse.json(
        { error: 'No BGG username configured' },
        { status: 400 }
      )
    }

    const collection = await getUserCollection(profile.bgg_username)

    // Upsert games
    for (const item of collection) {
      await supabase.from('games').upsert({
        bgg_id: item.bggId,
        name: item.name,
        thumbnail: item.thumbnail,
        image: item.image,
        min_players: item.minPlayers,
        max_players: item.maxPlayers,
        playing_time: item.playingTime,
        bgg_rating: item.bggRating,
        year_published: item.yearPublished,
      }, { onConflict: 'bgg_id' })

      // Upsert collection entry
      await supabase.from('game_collections').upsert({
        user_id: user.id,
        game_id: item.bggId,
        user_rating: item.userRating,
        own: item.own,
        want_to_play: item.wantToPlay,
        num_plays: item.numPlays,
        last_synced: new Date().toISOString(),
      }, { onConflict: 'user_id,game_id' })
    }

    return NextResponse.json({ 
      success: true, 
      count: collection.length,
      message: `Sincronizados ${collection.length} juegos`
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync collection' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getUserCollection } from '@/lib/bgg/api'
import { createClient } from '@/lib/supabase/server'

// Extend timeout for large collections (max 60s on Vercel Pro, 10s on free)
export const maxDuration = 60

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

    // Prepare batch data
    const gamesData = collection.map(item => ({
      bgg_id: item.bggId,
      name: item.name,
      thumbnail: item.thumbnail,
      image: item.image,
      min_players: item.minPlayers,
      max_players: item.maxPlayers,
      playing_time: item.playingTime,
      bgg_rating: item.bggRating,
      year_published: item.yearPublished,
    }))

    const collectionData = collection.map(item => ({
      user_id: user.id,
      game_id: item.bggId,
      user_rating: item.userRating,
      own: item.own,
      want_to_play: item.wantToPlay,
      num_plays: item.numPlays,
      last_synced: new Date().toISOString(),
    }))

    // Batch upsert games (in chunks of 100 to avoid payload limits)
    const CHUNK_SIZE = 100
    for (let i = 0; i < gamesData.length; i += CHUNK_SIZE) {
      const chunk = gamesData.slice(i, i + CHUNK_SIZE)
      const { error: gameError } = await supabase
        .from('games')
        .upsert(chunk, { onConflict: 'bgg_id' })

      if (gameError) {
        console.error('Games batch upsert error:', gameError)
        throw new Error(`Games upsert failed: ${gameError.message}`)
      }
    }

    // Batch upsert collection entries
    for (let i = 0; i < collectionData.length; i += CHUNK_SIZE) {
      const chunk = collectionData.slice(i, i + CHUNK_SIZE)
      const { error: collectionError } = await supabase
        .from('game_collections')
        .upsert(chunk, { onConflict: 'user_id,game_id' })

      if (collectionError) {
        console.error('Collection batch upsert error:', collectionError)
        throw new Error(`Collection upsert failed: ${collectionError.message}`)
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: collection.length,
      message: `Sincronizados ${collection.length} juegos`
    })
  } catch (error) {
    console.error('Sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to sync collection', details: errorMessage },
      { status: 500 }
    )
  }
}

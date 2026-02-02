import { NextRequest, NextResponse } from 'next/server'
import { getUserCollection } from '@/lib/bgg/api'
import { createClient } from '@/lib/supabase/server'
import type { BGGCollectionItem } from '@/types'

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

// POST now receives collection data from client (client fetches from BGG)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const collection: BGGCollectionItem[] = body.collection

    if (!collection || !Array.isArray(collection)) {
      return NextResponse.json(
        { error: 'Collection data is required' },
        { status: 400 }
      )
    }

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

    // Batch upsert games
    const { error: gameError } = await supabase
      .from('games')
      .upsert(gamesData, { onConflict: 'bgg_id' })

    if (gameError) {
      console.error('Games batch upsert error:', gameError)
      throw new Error(`Games upsert failed: ${gameError.message}`)
    }

    // Batch upsert collection entries
    const { error: collectionError } = await supabase
      .from('game_collections')
      .upsert(collectionData, { onConflict: 'user_id,game_id' })

    if (collectionError) {
      console.error('Collection batch upsert error:', collectionError)
      throw new Error(`Collection upsert failed: ${collectionError.message}`)
    }

    return NextResponse.json({ 
      success: true, 
      count: collection.length,
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

import { NextRequest, NextResponse } from 'next/server'
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

  const BGG_URL = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`
  
  // Try using a CORS proxy service
  const PROXY_URL = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(BGG_URL)}`

  try {
    // First try direct fetch
    let response = await fetch(BGG_URL, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    // If direct fetch fails with 401/403, try proxy
    if (response.status === 401 || response.status === 403) {
      console.log('Direct BGG fetch blocked, trying proxy...')
      response = await fetch(PROXY_URL)
    }

    // BGG returns 202 when processing - tell client to retry
    if (response.status === 202) {
      return NextResponse.json(
        { error: 'BGG está procesando', retry: true },
        { status: 202 }
      )
    }

    if (!response.ok) {
      console.error('BGG response not ok:', response.status)
      return NextResponse.json(
        { error: `BGG error: ${response.status}`, retry: response.status >= 500 },
        { status: 502 }
      )
    }

    const xml = await response.text()

    // Check for processing message in XML
    if (xml.includes('Your request for this collection has been accepted')) {
      return NextResponse.json(
        { error: 'BGG está procesando', retry: true },
        { status: 202 }
      )
    }
    
    // Check if we got valid XML
    if (!xml.includes('<items')) {
      console.error('Invalid XML response:', xml.substring(0, 200))
      return NextResponse.json(
        { error: 'Respuesta inválida de BGG', retry: true },
        { status: 502 }
      )
    }

    // Return XML for client to parse
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('BGG API error:', error)
    return NextResponse.json(
      { error: 'Error al contactar BGG', retry: true },
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

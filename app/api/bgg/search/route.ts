import { NextRequest, NextResponse } from 'next/server'
import { searchGames } from '@/lib/bgg/api'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters' },
      { status: 400 }
    )
  }

  try {
    const games = await searchGames(query)
    return NextResponse.json(games)
  } catch (error) {
    console.error('BGG API error:', error)
    return NextResponse.json(
      { error: 'Failed to search BoardGameGeek' },
      { status: 500 }
    )
  }
}

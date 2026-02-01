import { NextRequest, NextResponse } from 'next/server'
import { getGameDetails, getGameExpansions } from '@/lib/bgg/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const gameId = parseInt(id, 10)

  if (isNaN(gameId)) {
    return NextResponse.json(
      { error: 'Invalid game ID' },
      { status: 400 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const includeExpansions = searchParams.get('expansions') === 'true'

  try {
    const [games, expansions] = await Promise.all([
      getGameDetails([gameId]),
      includeExpansions ? getGameExpansions(gameId) : Promise.resolve([]),
    ])

    if (games.length === 0) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...games[0],
      expansions: includeExpansions ? expansions : undefined,
    })
  } catch (error) {
    console.error('BGG API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch game from BoardGameGeek' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, location, responseDeadline, dates, games, participants } = body

    // Create the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        organizer_id: user.id,
        title,
        description,
        location,
        response_deadline: responseDeadline,
        status: 'draft',
      })
      .select()
      .single()

    if (eventError) {
      console.error('Event creation error:', eventError)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    // Add proposed dates
    if (dates && dates.length > 0) {
      const dateInserts = dates.map((d: { date: string; startTime?: string; endTime?: string }) => ({
        event_id: event.id,
        proposed_date: d.date,
        start_time: d.startTime || null,
        end_time: d.endTime || null,
      }))

      const { error: datesError } = await supabase
        .from('event_dates')
        .insert(dateInserts)

      if (datesError) {
        console.error('Dates insertion error:', datesError)
      }
    }

    // Add proposed games
    if (games && games.length > 0) {
      const gameInserts = games.map((g: { gameId: number; ownerId?: string; isRecommended?: boolean }) => ({
        event_id: event.id,
        game_id: g.gameId,
        proposed_by: user.id,
        owner_id: g.ownerId || null,
        is_recommended: g.isRecommended || false,
      }))

      const { error: gamesError } = await supabase
        .from('event_games')
        .insert(gameInserts)

      if (gamesError) {
        console.error('Games insertion error:', gamesError)
      }
    }

    // Add participants (the organizer is automatically included)
    if (participants && participants.length > 0) {
      const participantInserts = participants.map((userId: string) => ({
        event_id: event.id,
        user_id: userId,
        status: 'pending',
      }))

      const { error: participantsError } = await supabase
        .from('event_participants')
        .insert(participantInserts)

      if (participantsError) {
        console.error('Participants insertion error:', participantsError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      eventId: event.id,
      message: 'Quedada creada exitosamente'
    })
  } catch (error) {
    console.error('Event creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

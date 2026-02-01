import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEventInvitation } from '@/lib/email/send'
import { generateInvitationToken, formatDate } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { eventId, userIds, sendEmail = true } = body

    // Verify user is the organizer
    const { data: event } = await supabase
      .from('events')
      .select(`
        *,
        event_dates (proposed_date, start_time)
      `)
      .eq('id', eventId)
      .eq('organizer_id', user.id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found or not authorized' }, { status: 404 })
    }

    // Get organizer name
    const { data: organizer } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Get user emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)

    if (!profiles) {
      return NextResponse.json({ error: 'Users not found' }, { status: 404 })
    }

    const results = []

    for (const profile of profiles) {
      const token = generateInvitationToken()

      // Create participant record
      const { error: insertError } = await supabase
        .from('event_participants')
        .insert({
          event_id: eventId,
          user_id: profile.id,
          status: 'pending',
          invitation_token: token,
        })

      if (insertError) {
        // Participant might already exist
        console.error('Insert error:', insertError)
        continue
      }

      // Send email invitation
      if (sendEmail) {
        const proposedDates = event.event_dates?.map((d: { proposed_date: string; start_time: string | null }) => {
          let dateStr = formatDate(d.proposed_date)
          if (d.start_time) {
            dateStr += ` a las ${d.start_time.slice(0, 5)}`
          }
          return dateStr
        }) || []

        await sendEventInvitation({
          to: profile.email,
          eventTitle: event.title,
          organizerName: organizer?.name || 'Un amigo',
          proposedDates,
          inviteToken: token,
        })
      }

      results.push({ userId: profile.id, success: true })
    }

    // Update event status to pending if it was draft
    if (event.status === 'draft') {
      await supabase
        .from('events')
        .update({ status: 'pending' })
        .eq('id', eventId)
    }

    return NextResponse.json({ 
      success: true, 
      invitations: results,
      message: `Se enviaron ${results.length} invitaciones`
    })
  } catch (error) {
    console.error('Invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    )
  }
}

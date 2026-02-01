import { Resend } from 'resend'
import { getEventInvitationEmailHtml, getEventConfirmedEmailHtml } from './templates'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured, emails will not be sent')
    return null
  }
  return new Resend(apiKey)
}

const FROM_EMAIL = 'GameNight <noreply@gamenight.app>'

export async function sendEventInvitation({
  to,
  eventTitle,
  organizerName,
  proposedDates,
  inviteToken,
}: {
  to: string
  eventTitle: string
  organizerName: string
  proposedDates: string[]
  inviteToken: string
}) {
  const resend = getResendClient()
  if (!resend) {
    console.log('Email would be sent to:', to, 'for event:', eventTitle)
    return { success: true, skipped: true }
  }

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🎲 ${organizerName} te invita a: ${eventTitle}`,
      html: getEventInvitationEmailHtml({
        eventTitle,
        organizerName,
        proposedDates,
        inviteLink,
      }),
    })
    return { success: true }
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return { success: false, error }
  }
}

export async function sendEventConfirmation({
  to,
  eventTitle,
  finalDate,
  finalTime,
  location,
  games,
  eventId,
}: {
  to: string[]
  eventTitle: string
  finalDate: string
  finalTime?: string
  location?: string
  games: { name: string; responsible: string }[]
  eventId: string
}) {
  const resend = getResendClient()
  if (!resend) {
    console.log('Confirmation emails would be sent to:', to, 'for event:', eventTitle)
    return { success: true, skipped: true }
  }

  const eventLink = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}`
  
  try {
    await resend.batch.send(
      to.map(email => ({
        from: FROM_EMAIL,
        to: email,
        subject: `✅ Quedada confirmada: ${eventTitle}`,
        html: getEventConfirmedEmailHtml({
          eventTitle,
          finalDate,
          finalTime,
          location,
          games,
          eventLink,
        }),
      }))
    )
    return { success: true }
  } catch (error) {
    console.error('Error sending confirmation emails:', error)
    return { success: false, error }
  }
}

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Find the invitation
  const { data: participant } = await supabase
    .from('event_participants')
    .select('event_id, user_id')
    .eq('invitation_token', token)
    .single()

  if (!participant) {
    notFound()
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login with return URL
    redirect(`/login?redirect=/events/${participant.event_id}`)
  }

  // If logged in user matches the invitation, redirect to event
  if (user.id === participant.user_id) {
    redirect(`/events/${participant.event_id}`)
  }

  // Otherwise redirect to login
  redirect(`/login?redirect=/events/${participant.event_id}`)
}

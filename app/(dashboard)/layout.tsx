import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/navigation/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userData = {
    id: user.id,
    name: profile?.name || user.email?.split('@')[0] || 'Usuario',
    email: user.email || '',
    avatarUrl: profile?.avatar_url,
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={userData} />
      
      {/* Main content */}
      <main className="lg:pl-64">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}

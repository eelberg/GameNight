'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, User, Link as LinkIcon, Bell, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Introduce un correo válido'),
  bggUsername: z.string().optional(),
  notificationsEmail: z.boolean(),
  defaultDeadlineDays: z.number().min(1).max(30),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function SettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      bggUsername: '',
      notificationsEmail: true,
      defaultDeadlineDays: 7,
    },
  })

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      const preferences = profile.preferences as { 
        notifications?: { email?: boolean }
        defaultResponseDeadlineDays?: number 
      } | null

      form.reset({
        name: profile.name,
        email: profile.email,
        bggUsername: profile.bgg_username || '',
        notificationsEmail: preferences?.notifications?.email ?? true,
        defaultDeadlineDays: preferences?.defaultResponseDeadlineDays ?? 7,
      })
    }

    setIsLoading(false)
  }

  async function onSubmit(data: ProfileForm) {
    setIsSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          bgg_username: data.bggUsername || null,
          preferences: {
            notifications: {
              email: data.notificationsEmail,
            },
            defaultResponseDeadlineDays: data.defaultDeadlineDays,
          },
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Configuración guardada')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Error al guardar la configuración')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu perfil y preferencias
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Perfil
              </CardTitle>
              <CardDescription>
                Información básica de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormDescription>
                      El correo no se puede cambiar
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* BGG Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                BoardGameGeek
              </CardTitle>
              <CardDescription>
                Conecta tu cuenta de BGG para sincronizar tu colección
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bggUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario de BGG</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="tu_usuario_bgg" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Tu nombre de usuario en boardgamegeek.com
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch('bggUsername') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/collection')}
                >
                  Ver mi colección
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configura cómo quieres recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notificationsEmail"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Notificaciones por email
                      </FormLabel>
                      <FormDescription>
                        Recibe emails cuando te inviten a quedadas o haya actualizaciones
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferencias</CardTitle>
              <CardDescription>
                Valores por defecto para tus quedadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="defaultDeadlineDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días para responder (por defecto)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min={1}
                        max={30}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Días antes de la fecha límite de respuesta al crear quedadas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

# GameNight 🎲

Una aplicación web para organizar quedadas de juegos de mesa con amigos. Sincroniza tu colección de BoardGameGeek, invita amigos y vota por los juegos que quieres jugar.

## Características

- **Autenticación**: Registro e inicio de sesión con Supabase Auth
- **Integración con BoardGameGeek**: Sincroniza tu colección de juegos automáticamente
- **Sistema de amigos**: Busca y agrega amigos para invitarlos a quedadas
- **Organización de quedadas**:
  - Propón múltiples fechas
  - Selecciona juegos de las colecciones de los invitados
  - Recibe votos de disponibilidad y preferencias de juegos
  - Sistema de recomendaciones basado en ratings y número de jugadores
- **RSVP y votación**: Los invitados confirman disponibilidad y votan juegos
- **Confirmación**: El organizador confirma fecha final, juegos y responsables
- **Notificaciones**: Invitaciones y confirmaciones por email

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Backend**: Supabase (Auth, Database, Real-time)
- **Email**: Resend
- **API Externa**: BoardGameGeek XML API2
- **Deploy**: Vercel

## Configuración Local

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd gamenight
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ejecuta el script SQL en `supabase/schema.sql` en el SQL Editor
3. Copia las credenciales del proyecto

### 4. Configurar variables de entorno

Copia `env.example` a `.env.local` y completa los valores:

```bash
cp env.example .env.local
```

Variables requeridas:
- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase
- `RESEND_API_KEY`: API key de Resend para emails (opcional para desarrollo)
- `NEXT_PUBLIC_APP_URL`: URL de la aplicación (localhost:3000 en desarrollo)

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Despliegue en Vercel

### 1. Conectar repositorio

1. Ve a [vercel.com](https://vercel.com) e importa tu repositorio
2. Selecciona el framework "Next.js"

### 2. Configurar variables de entorno

En el dashboard de Vercel, añade las siguientes variables:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `RESEND_API_KEY` | API key de Resend |
| `NEXT_PUBLIC_APP_URL` | URL de producción (ej: https://gamenight.vercel.app) |

### 3. Deploy

Vercel desplegará automáticamente con cada push a la rama principal.

## Estructura del Proyecto

```
gamenight/
├── app/
│   ├── (auth)/           # Páginas de login/registro
│   ├── (dashboard)/      # Páginas protegidas
│   │   ├── events/       # Gestión de quedadas
│   │   ├── friends/      # Sistema de amigos
│   │   ├── collection/   # Colección de juegos
│   │   └── settings/     # Configuración
│   ├── api/              # API Routes
│   │   ├── bgg/          # Proxy para BoardGameGeek
│   │   ├── events/       # CRUD de eventos
│   │   └── invitations/  # Sistema de invitaciones
│   └── invite/           # Página de invitación por token
├── components/
│   ├── ui/               # Componentes shadcn/ui
│   ├── events/           # Componentes de eventos
│   └── navigation/       # Navegación
├── lib/
│   ├── supabase/         # Clientes de Supabase
│   ├── bgg/              # Integración BoardGameGeek
│   ├── email/            # Templates y envío de emails
│   └── recommendations.ts # Algoritmo de recomendaciones
├── types/                # TypeScript types
└── supabase/
    └── schema.sql        # Schema de base de datos
```

## BoardGameGeek API

La aplicación usa la API XML de BGG para:
- Obtener colecciones de usuarios
- Obtener detalles de juegos (jugadores, tiempo, rating)
- Buscar juegos

Los datos se cachean en memoria para evitar rate limits.

## Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Añade nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## Licencia

MIT

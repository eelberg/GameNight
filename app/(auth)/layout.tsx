import { Dice5 } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/90 to-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-3">
          <Dice5 className="h-10 w-10" />
          <span className="text-2xl font-bold">GameNight</span>
        </div>
        
        <div className="space-y-6">
          <blockquote className="text-xl font-medium leading-relaxed">
            "La mejor manera de organizar quedadas con amigos para jugar juegos de mesa. 
            Sincroniza tu colección de BoardGameGeek, invita a tus amigos y encuentra 
            el momento perfecto para jugar."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              🎲
            </div>
            <div>
              <p className="font-semibold">Comunidad de jugadores</p>
              <p className="text-sm opacity-80">Miles de quedadas organizadas</p>
            </div>
          </div>
        </div>

        <p className="text-sm opacity-70">
          © {new Date().getFullYear()} GameNight. Hecho con ❤️ para los amantes de los juegos de mesa.
        </p>
      </div>

      {/* Right side - auth form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Dice5 className="h-10 w-10 text-primary" />
            <span className="text-2xl font-bold">GameNight</span>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  )
}

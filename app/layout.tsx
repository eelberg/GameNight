import type { Metadata } from "next";
import { Nunito, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GameNight - Planifica tus quedadas de juegos de mesa",
  description: "Organiza quedadas con amigos para jugar juegos de mesa. Sincroniza tu colección de BoardGameGeek, invita amigos y vota por los juegos.",
  keywords: ["juegos de mesa", "boardgames", "quedadas", "BGG", "BoardGameGeek", "gaming"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${nunito.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

import type { Metadata } from "next"
import { Inter, Press_Start_2P } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import ContextProvider from '@/context'

const inter = Inter({ subsets: ["latin"] })
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel"
})

export const metadata: Metadata = {
  title: "HODL",
  description: "",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} ${pressStart2P.variable}`} suppressHydrationWarning>
        <ContextProvider>
          <ThemeProvider defaultTheme="dark">
            {children}
          </ThemeProvider>
        </ContextProvider>
      </body>
    </html>
  )
}


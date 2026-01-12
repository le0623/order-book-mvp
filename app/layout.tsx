import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { headers } from 'next/headers'
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import ContextProvider from '@/context'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "HODL",
  description: "",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersData = await headers();
  const cookies = headersData.get('cookie');

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ContextProvider cookies={cookies}>
          <ThemeProvider defaultTheme="dark">
            {children}
          </ThemeProvider>
        </ContextProvider>
      </body>
    </html>
  )
}


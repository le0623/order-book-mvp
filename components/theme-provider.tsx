"use client"

import * as React from "react"

type Theme = "dark" | "light"

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme | null
      if (stored && (stored === "light" || stored === "dark")) {
        return stored
      }
    }
    return defaultTheme
  })
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const root = document.documentElement
    const stored = localStorage.getItem("theme") as Theme | null
    
    if (stored && (stored === "light" || stored === "dark")) {
      root.classList.remove("light", "dark")
      root.classList.add(stored)
      setTheme(stored)
    } else {
      root.classList.remove("light", "dark")
      root.classList.add(defaultTheme)
      setTheme(defaultTheme)
    }
  }, [defaultTheme])

  React.useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem("theme", theme)
  }, [theme, mounted])

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }, [])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}


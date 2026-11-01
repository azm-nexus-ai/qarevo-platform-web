'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
import { THEME_KEY as KEY } from '@/lib/theme'

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; ready: boolean }>({ theme: 'light', setTheme: () => {}, ready: false })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>('light')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    updateTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key !== KEY && event.key !== null) return
      const next = event.newValue === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      updateTheme(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next
    updateTheme(next)
    try { localStorage.setItem(KEY, next) } catch { /* Still usable when browser storage is unavailable. */ }
  }
  return <ThemeContext.Provider value={{ theme, setTheme, ready }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

export function ThemeToggle() {
  const { theme, setTheme, ready } = useTheme()
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={ready ? theme === 'dark' : undefined}
    onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}>
    <span aria-hidden="true" className="theme-light-icon">☾</span><span aria-hidden="true" className="theme-dark-icon">☀</span>
    <span>Appearance</span>
  </button>
}

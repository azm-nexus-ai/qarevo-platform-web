'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { THEME_KEY as KEY } from '@/lib/theme'
type Theme = 'light' | 'dark'
const CHANGED = 'qarevo:theme-change'
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; ready: boolean }>({ theme: 'light', setTheme: () => {}, ready: false })
const readTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
const subscribe = (changed: () => void) => {
  const storage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return
    document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light'
    changed()
  }
  window.addEventListener(CHANGED, changed)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(CHANGED, changed); window.removeEventListener('storage', storage) }
}
function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  try { localStorage.setItem(KEY, next) } catch { /* Still usable without storage. */ }
  window.dispatchEvent(new Event(CHANGED))
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme)
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  return <ThemeContext.Provider value={{ theme, setTheme, ready }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)

export function ThemeToggle() {
  const { theme, setTheme, ready } = useTheme()
  const action = ready && theme === 'dark' ? 'Light mode' : 'Dark mode'
  return <button type="button" className="theme-toggle" aria-label={action} title={`Switch to ${action.toLowerCase()}`}
    onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}>
    <span aria-hidden="true">{ready && theme === 'dark' ? '☀' : '☾'}</span>
    <span>{action}</span>
  </button>
}

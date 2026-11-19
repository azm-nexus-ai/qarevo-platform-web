'use client'

import { useTranslations } from 'next-intl'
import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { applyPortalTheme, setPortalTheme, themeKey, THEME_CHANGED, type Theme } from '@/lib/theme'
import { currentPortal, isPortalEvent } from '@/lib/portal-scope'

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; ready: boolean }>({ theme: 'light', setTheme: () => {}, ready: false })
const readTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
const subscribe = (changed: () => void) => {
  const storage = (event: StorageEvent) => {
    if (event.key !== themeKey() && event.key !== null) return
    applyPortalTheme()
    changed()
  }
  const local = (event: Event) => { if (isPortalEvent(event)) changed() }
  window.addEventListener(THEME_CHANGED, local)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(THEME_CHANGED, local); window.removeEventListener('storage', storage) }
}
function setTheme(next: Theme) {
  const portal = currentPortal()
  setPortalTheme(next, portal)
  window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: { portal } }))
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme)
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  useLayoutEffect(() => {
    const portal = currentPortal(pathname)
    applyPortalTheme(portal)
    window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: { portal } }))
  }, [pathname])
  return <ThemeContext.Provider value={{ theme, setTheme, ready }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)

export function ThemeToggle() {
  const { theme, setTheme, ready } = useTheme(), t = useTranslations('common.theme')
  const action = ready && theme === 'dark' ? t('light') : t('dark')
  return <button type="button" className="theme-toggle" aria-label={action} title={ready && theme === 'dark' ? t('switchToLight') : t('switchToDark')}
    onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}>
    <span aria-hidden="true">{ready && theme === 'dark' ? '☀' : '☾'}</span>
    <span>{action}</span>
  </button>
}

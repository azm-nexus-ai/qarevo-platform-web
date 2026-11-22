'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import { PortalNav, type Portal, type PortalNavGroup } from '@/components/layout/PortalNav'
import styles from './portal-mobile.module.css'

type Props = {
  portal: Exclude<Portal, 'patient'>
  className: string
  homeHref: string
  homeLabel: string
  groups: PortalNavGroup[]
  isActive: (pathname: string, href: string) => boolean
  navLabel: string
  summaryLabel: string
  identity: { name: string; description: string; avatar?: ReactNode }
  accountMenu?: ReactNode
  onLogout: () => void
  loggingOut?: boolean
}

/** Phone and tablet navigation: top bar with brand, bell and theme; a focus-managed drawer with the shared nav. */
export default function PortalMobileNavigation(props: Props) {
  const t = useTranslations('shell'), pathname = usePathname()
  const [open, setOpen] = useState(false)
  const drawer = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback((focus = true) => { setOpen(false); if (focus) trigger.current?.focus() }, [])
  useEffect(() => { const timer = window.setTimeout(() => setOpen(false), 0); return () => window.clearTimeout(timer) }, [pathname])
  useEffect(() => {
    if (!open) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    drawer.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || !drawer.current) return
      const focusable = Array.from(drawer.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey) }
  }, [open, close])
  const drawerId = `${props.portal}-mobile-drawer`
  return <div className={styles.root}>
    <div className={`${props.className} portal-mobile-navbar ${styles.topbar}`} role='banner'>
      <Link href={props.homeHref} aria-label={props.homeLabel} className={styles.brand}><AuthenticatedLogo width={100} /></Link>
      <button ref={trigger} type='button' className={styles.iconButton} aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}>
        <Menu size={20} aria-hidden='true' />
      </button>
      <span className={styles.spacer} />
      <NotificationBell portal={props.portal} />
      <ThemeToggle />
      {props.accountMenu}
    </div>
    <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`} aria-hidden='true' onClick={() => close()} />
    <div id={drawerId} ref={drawer} role='dialog' aria-modal={open ? true : undefined} aria-hidden={!open} inert={!open}
      aria-label={t('menu')} className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
      <div className={styles.drawerHeader}>
        <Link href={props.homeHref} className={styles.brand} onClick={() => close(false)} aria-label={props.homeLabel}><AuthenticatedLogo width={120} /></Link>
        <button type='button' className={styles.iconButton} aria-label={t('closeMenu')} onClick={() => close()}><X size={18} aria-hidden='true' /></button>
      </div>
      <section className={styles.identity} aria-label={props.summaryLabel}>
        {props.identity.avatar}
        <div className={styles.identityText}>
          <p className={styles.identityName}>{props.identity.name}</p>
          <p className={styles.identityDescription}>{props.identity.description}</p>
        </div>
      </section>
      <div className={styles.language}><LanguageSwitch /></div>
      <PortalNav portal={props.portal} groups={props.groups} isActive={props.isActive} label={props.navLabel}
        onNavigate={() => close(false)} onLogout={() => { close(false); props.onLogout() }} loggingOut={props.loggingOut} />
    </div>
  </div>
}

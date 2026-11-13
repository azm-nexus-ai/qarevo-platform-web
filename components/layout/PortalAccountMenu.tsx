'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import styles from './PortalAccountMenu.module.css'

export default function PortalAccountMenu({ portal, name, description, avatar, profileHref, settingsHref }: {
  portal: import('@/lib/portal-scope').Portal
  name: string
  description?: string
  avatar: ReactNode
  profileHref: string
  settingsHref: string
}) {
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)
  const label = `${portal[0].toUpperCase()}${portal.slice(1)} account menu`
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      if (details.current?.open && !details.current.contains(event.target as Node)) details.current.open = false
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')) return
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false
        summary.current?.focus()
      }
    }
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', keyboard) }
  }, [])
  const close = () => { if (details.current) details.current.open = false }
  return <details ref={details} className={styles.account}>
    <summary ref={summary} aria-label={label} className={styles.trigger}>
      {avatar}
      <span className={styles.summaryText}><strong>{name}</strong>{description && <span>{description}</span>}</span>
      <span aria-hidden='true' className={styles.chevron}>⌄</span>
    </summary>
    <div className={styles.panel}>
      <div className={styles.identity}>{avatar}<div><strong>{name}</strong>{description && <p>{description}</p>}</div></div>
      <nav aria-label={`${label} links`}>
        <Link href={profileHref} onClick={close}>View profile</Link>
        <Link href={settingsHref} onClick={close}>Settings and security</Link>
      </nav>
    </div>
  </details>
}

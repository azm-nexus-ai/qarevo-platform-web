'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { NavLabel, SigningOut } from '@/components/ui/NavLabel'
import { useUnreadCount } from '@/lib/notifications'
import styles from './portal-sidebar.module.css'

export type Portal = 'patient' | 'doctor' | 'admin' | 'practice'
export type PortalNavItem = { label: string; href: string; icon: LucideIcon; badge?: 'notifications' }
export type PortalNavGroup = { title: string; items: PortalNavItem[] }

type NavProps = {
  portal: Portal
  groups: PortalNavGroup[]
  isActive: (pathname: string, href: string) => boolean
  onNavigate?: () => void
  onLogout?: () => void
  loggingOut?: boolean
  label: string
}

/** Grouped portal navigation shared by the desktop sidebar and the mobile drawer. */
export function PortalNav({ portal, groups, isActive, onNavigate, onLogout, loggingOut, label }: NavProps) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('nav.groups')
  const unread = useUnreadCount(groups.some(group => group.items.some(item => item.badge === 'notifications')))
  return <nav className={styles.nav} aria-label={label}>
    {groups.map(group => <div key={group.title} className={styles.group}>
      <p className={styles.groupTitle}>{t.has(group.title) ? t(group.title) : group.title}</p>
      <ul className={styles.list}>
        {group.items.map(item => {
          const Icon = item.icon, active = isActive(pathname, item.href)
          const count = item.badge === 'notifications' ? unread.count : 0
          return <li key={item.href}>
            <Link className={styles.link} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.8} aria-hidden='true' />
              <span className={styles.label}><NavLabel portal={portal} label={item.label} /></span>
              {count > 0 && <span className={styles.count} aria-label={String(count)}>{count > 99 ? '99+' : count}</span>}
            </Link>
          </li>
        })}
        {onLogout && group === groups[groups.length - 1] && <li>
          <button type='button' className={`${styles.link} ${styles.danger}`} onClick={onLogout} disabled={loggingOut}>
            <LogOut size={17} strokeWidth={1.8} aria-hidden='true' />
            <span className={styles.label}>{loggingOut ? <SigningOut /> : <NavLabel portal={portal} label='Logout' />}</span>
          </button>
        </li>}
      </ul>
    </div>)}
  </nav>
}

type SidebarProps = NavProps & { identity?: { name: string; description: string; avatar?: ReactNode } }

/** Desktop sidebar under the portal header. Collapses with the header's sidebar toggle. */
export function PortalSidebar({ identity, ...nav }: SidebarProps) {
  return <aside id={`${nav.portal}-primary-sidebar`} className={styles.aside}>
    {identity && <section className={styles.identity} aria-label={identity.name}>
      {identity.avatar}
      <div className={styles.identityText}>
        <p className={styles.identityName}>{identity.name}</p>
        <p className={styles.identityDescription}>{identity.description}</p>
      </div>
    </section>}
    <PortalNav {...nav} />
  </aside>
}

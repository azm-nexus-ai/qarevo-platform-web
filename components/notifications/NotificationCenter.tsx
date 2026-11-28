'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import {
  fetchNotifications, markAllNotificationsRead, markNotificationRead, NOTIFICATIONS_CHANGED, useUnreadCount,
  type PortalNotification,
} from '@/lib/notifications'
import styles from './notifications.module.css'

export type NotificationPortal = 'patient' | 'doctor' | 'admin' | 'practice'

const KNOWN_EVENTS = new Set([
  'message_received', 'appointment_booked', 'appointment_rescheduled', 'appointment_cancelled', 'lab_result_received',
  'lab_result_uploaded', 'verification_decided', 'verification_submitted', 'practice_membership_changed',
  'practice_invitation_accepted', 'statement_issued',
])

const eventKey = (type: string) => type.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

/** The event in the reader's language; the stored German or English title is the fallback. */
function useTitle() {
  const t = useTranslations('notifications.events'), locale = useLocale()
  return (item: PortalNotification) => {
    if (KNOWN_EVENTS.has(item.event_type)) return t(eventKey(item.event_type), { actor: item.actor ?? 'Qarevo Health' })
    return locale === 'en' && item.title_en ? item.title_en : item.title
  }
}

function useMeta() {
  const t = useTranslations('notifications'), format = useFormatter()
  return (item: PortalNotification) => {
    const parts: string[] = []
    if (item.actor) parts.push(item.actor)
    if (item.created_at) {
      const date = new Date(item.created_at)
      if (!Number.isNaN(date.getTime())) parts.push(format.relativeTime(date, new Date()))
    }
    if (item.occurrences > 1) parts.push(t('repeated', { count: item.occurrences }))
    return parts.join(' · ')
  }
}

function Item({ item, onOpen }: { item: PortalNotification; onOpen: (item: PortalNotification) => void }) {
  const title = useTitle()(item), meta = useMeta()(item), t = useTranslations('notifications')
  const content = <>
    <span className={styles.dot} aria-hidden='true' />
    <span>
      <span className={styles.itemTitle}>{!item.is_read && <span className='sr-only'>{t('unreadLabel')} </span>}{title}</span>
      {meta && <span className={styles.itemMeta} style={{ display: 'block' }}>{meta}</span>}
    </span>
  </>
  return <li className={`${styles.item} ${item.is_read ? styles.read : styles.unread}`}>
    {item.href
      ? <Link className={styles.itemLink} href={item.href} onClick={() => onOpen(item)}>{content}</Link>
      : <button type='button' className={styles.itemLink} onClick={() => onOpen(item)}>{content}</button>}
  </li>
}

function useList(limit: number, active: boolean) {
  const [items, setItems] = useState<PortalNotification[] | null>(null)
  const [error, setError] = useState(false), [cursor, setCursor] = useState<string | null>(null), [enabled, setEnabled] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(false)
      const page = await fetchNotifications(limit, null, signal)
      if (signal?.aborted) return
      setItems(page.notifications); setCursor(page.has_more ? page.next_cursor : null); setEnabled(page.enabled)
    } catch { if (!signal?.aborted) setError(true) }
  }, [limit])
  const more = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const page = await fetchNotifications(limit, cursor)
      setItems(previous => [...(previous ?? []), ...page.notifications.filter(row => !(previous ?? []).some(old => old.id === row.id))])
      setCursor(page.has_more ? page.next_cursor : null)
    } catch { setError(true) } finally { setLoadingMore(false) }
  }, [cursor, limit])
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const first = window.setTimeout(() => void load(controller.signal), 0)
    const refresh = () => void load()
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    return () => { controller.abort(); window.clearTimeout(first); window.removeEventListener(NOTIFICATIONS_CHANGED, refresh) }
  }, [active, load])
  return { items, setItems, error, enabled, load, more, hasMore: !!cursor, loadingMore }
}

function useOpen(setItems: (update: (rows: PortalNotification[] | null) => PortalNotification[] | null) => void, after?: () => void) {
  const router = useRouter()
  return (item: PortalNotification) => {
    if (!item.is_read) {
      setItems(rows => rows?.map(row => row.id === item.id ? { ...row, is_read: true } : row) ?? rows)
      void markNotificationRead(item.id).catch(() => undefined)
    }
    after?.()
    if (!item.href) router.refresh()
  }
}

/** Header bell: unread count, a short list, mark all as read and a link to the full page. */
export function NotificationBell({ portal }: { portal: NotificationPortal }) {
  const t = useTranslations('notifications'), panelId = useId(), wrap = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const list = useList(8, open)
  const close = useCallback((focus = false) => { setOpen(false); if (focus) button.current?.focus() }, [])
  const openItem = useOpen(list.setItems, () => close())
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    const onClick = (event: MouseEvent) => { if (wrap.current && !wrap.current.contains(event.target as Node)) close() }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open, close])
  if (unread.ready && !unread.enabled) return null
  const count = unread.count, label = count ? t('bellUnread', { count }) : t('bell')
  return <div className={styles.bellWrap} ref={wrap}>
    <button ref={button} type='button' className={styles.bell} aria-label={label} title={label} aria-expanded={open}
      aria-controls={panelId} onClick={() => setOpen(value => !value)} data-notification-bell={portal}>
      <Bell size={18} aria-hidden='true' />
      {count > 0 && <span className={styles.badge} aria-hidden='true'>{count > 99 ? '99+' : count}</span>}
    </button>
    <span className='sr-only' aria-live='polite'>{unread.ready && count ? t('bellUnread', { count }) : ''}</span>
    {open && <div id={panelId} className={styles.panel} role='region' aria-label={t('title')}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t('title')}</h2>
        <button type='button' className={styles.textButton} disabled={!count}
          onClick={() => { list.setItems(rows => rows?.map(row => ({ ...row, is_read: true })) ?? rows); void markAllNotificationsRead().catch(() => undefined) }}>
          {t('markAllRead')}
        </button>
      </div>
      <List list={list} onOpen={openItem} />
      <div className={styles.panelFooter}><Link className={styles.footerLink} href={`/${portal}/notifications`} onClick={() => close()}>{t('viewAll')}</Link></div>
    </div>}
  </div>
}

function List({ list, onOpen }: { list: ReturnType<typeof useList>; onOpen: (item: PortalNotification) => void }) {
  const t = useTranslations('notifications')
  if (list.error && !list.items) return <div className={styles.state} role='alert'>{t('loadFailed')} <button type='button' className={styles.textButton} onClick={() => void list.load()}>{t('retry')}</button></div>
  if (!list.items) return <div className={styles.state} role='status'>{t('loading')}</div>
  if (!list.items.length) return <div className={styles.state}>{t('empty')}</div>
  return <ul className={styles.list}>{list.items.map(item => <Item key={item.id} item={item} onOpen={onOpen} />)}</ul>
}

/** Full notification page for any portal: all or unread, mark all as read, load more. */
export function NotificationInbox() {
  const t = useTranslations('notifications'), list = useList(20, true), unread = useUnreadCount()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const openItem = useOpen(list.setItems)
  const rows = list.items && filter === 'unread' ? list.items.filter(item => !item.is_read) : list.items
  const countKnown = unread.ready && !(list.error && !list.items)
  if (!list.enabled) return <div className={styles.pageCard}><div className={styles.state}>{t('disabled')}</div></div>
  return <div className={styles.page}>
    <div className={styles.pageCard}>
      <div className={styles.pageToolbar}>
        <div className={styles.filters} role='group' aria-label={t('filterLabel')}>
          <button type='button' className={styles.filter} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('filterAll')}</button>
          {/* A count is shown only once it has loaded and the list did not fail; a failed load never claims "Unread (0)". */}
          <button type='button' className={styles.filter} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>{countKnown ? t('filterUnread', { count: unread.count }) : t('filterUnreadPlain')}</button>
        </div>
        <button type='button' className={styles.textButton} disabled={!countKnown || !unread.count}
          onClick={() => { list.setItems(items => items?.map(item => ({ ...item, is_read: true })) ?? items); void markAllNotificationsRead().catch(() => undefined) }}>
          {t('markAllRead')}
        </button>
      </div>
      <List list={{ ...list, items: rows }} onOpen={openItem} />
      {list.hasMore && filter === 'all' && <div className={styles.more}>
        <button type='button' className={styles.textButton} disabled={list.loadingMore} onClick={() => void list.more()}>{list.loadingMore ? t('loading') : t('loadMore')}</button>
      </div>}
    </div>
  </div>
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'

/** One notification, whatever the portal. Content names the event, never clinical details. */
export type PortalNotification = {
  id: string
  event_type: string
  category: string | null
  priority: 'low' | 'normal' | 'high' | string
  title: string
  title_en: string | null
  body: string | null
  href: string | null
  actor: string | null
  occurrences: number
  is_read: boolean
  created_at: string | null
}

export type NotificationPage = { notifications: PortalNotification[]; unread_count: number; has_more: boolean; next_cursor: string | null; enabled: boolean }

const BASE = '/api/v1/notifications'
export const NOTIFICATIONS_CHANGED = 'qarevo:notifications-changed'
const POLL_MS = 30_000

function text(value: unknown, max = 400): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

/** Accept only same-origin portal paths as destinations. */
export function safeHref(value: unknown): string | null {
  const href = text(value, 512)
  return href && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\') ? href : null
}

export function parseNotification(raw: unknown): PortalNotification | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = text(row.id, 64), title = text(row.title, 220), eventType = text(row.event_type, 64)
  if (!id || !title || !eventType) return null
  return {
    id, title, event_type: eventType, category: text(row.category, 32), priority: text(row.priority, 16) ?? 'normal',
    title_en: text(row.title_en, 220), body: text(row.body, 400), href: safeHref(row.href), actor: text(row.actor, 160),
    occurrences: typeof row.occurrences === 'number' && row.occurrences > 0 ? Math.floor(row.occurrences) : 1,
    is_read: row.is_read === true, created_at: text(row.created_at, 64),
  }
}

export function parsePage(raw: unknown): NotificationPage {
  const page = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rows = Array.isArray(page.notifications) ? page.notifications.map(parseNotification).filter((row): row is PortalNotification => !!row) : []
  return {
    notifications: rows,
    unread_count: typeof page.unread_count === 'number' && page.unread_count >= 0 ? page.unread_count : rows.filter(row => !row.is_read).length,
    has_more: page.has_more === true, next_cursor: text(page.next_cursor, 256), enabled: page.enabled !== false,
  }
}

export const fetchNotifications = async (limit = 20, before?: string | null, signal?: AbortSignal) =>
  parsePage(await apiGet<unknown>(`${BASE}?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`, undefined, signal))

export async function fetchUnreadCount(signal?: AbortSignal): Promise<{ count: number; enabled: boolean }> {
  const raw = await apiGet<{ unread_count?: unknown; enabled?: unknown }>(`${BASE}/unread-count`, undefined, signal)
  return { count: typeof raw?.unread_count === 'number' && raw.unread_count >= 0 ? raw.unread_count : 0, enabled: raw?.enabled !== false }
}

function announce() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)) }

export async function markNotificationRead(id: string) { await apiPost(`${BASE}/${encodeURIComponent(id)}/read`, {}); announce() }
export async function markAllNotificationsRead() { await apiPost(`${BASE}/read-all`, {}); announce() }

/** Unread count that refreshes every 30 s, when the tab regains focus and after any read action. */
export function useUnreadCount(active = true) {
  const [state, setState] = useState<{ count: number; enabled: boolean; ready: boolean }>({ count: 0, enabled: true, ready: false })
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    controller.current?.abort()
    const next = new AbortController(); controller.current = next
    try {
      const result = await fetchUnreadCount(next.signal)
      if (!next.signal.aborted) setState({ ...result, ready: true })
    } catch { /* Keep the last known count; the next poll retries. */ }
  }, [])
  useEffect(() => {
    if (!active) return
    const first = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first); window.clearInterval(timer); controller.current?.abort()
      window.removeEventListener('focus', refresh); window.removeEventListener(NOTIFICATIONS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, refresh])
  return { ...state, refresh }
}

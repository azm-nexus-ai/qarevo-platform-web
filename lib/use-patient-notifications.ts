'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { apiPatch, getApiErrorDetail } from './api'
import { ACCOUNT_CHANGED, readAccountScope } from './account-storage'
import { currentPortal } from './portal-scope'
import { usePortalAction } from './portal-action'
import { usePortalResource } from './use-portal-resource'
import { PATIENT_NOTIFICATIONS_PATH, patientNotice, patientNotices, patientNotificationPath } from './patient-notifications'

const readScope = () => readAccountScope('patient')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
type PageContext = { scope: string | null; pathname: string; before: string | null }
type Pagination = { scope: string; pathname: string; cursors: (string | null)[] }
type Mutation = { page: PageContext; confirmed: string[]; pendingId: string | null; errorId: string | null; error: string }

/** Only the current page and its cursor stack live in memory; read receipts stay on the server. */
export function usePatientNotifications() {
  const scope = useSyncExternalStore(subscribe, readScope, () => null), pathname = usePathname()
  const captureAction = usePortalAction()
  const [pagination, setPagination] = useState<Pagination | null>(null)
  // Discard an old account's cursor stack, including a later switch back.
  if (pagination && (pagination.scope !== scope || pagination.pathname !== pathname)) setPagination(null)
  const cursors = pagination?.scope === scope && pagination.pathname === pathname ? pagination.cursors : null
  const before = cursors?.at(-1) ?? null
  const page = useMemo(() => ({ scope, pathname, before }), [scope, pathname, before])
  const currentPage = useRef(page), changingPage = useRef(false)
  currentPage.current = page
  const resource = usePortalResource<unknown>(patientNotificationPath(before), false, { refreshOnFocus: true, abortOnCleanup: true })
  const refresh = resource.retry
  const parsed = useMemo(() => patientNotices(resource.data), [resource.data])
  // A legacy recent-only response cannot substantiate an older page.
  const pageError = resource.data !== null && (!parsed || (before !== null && !parsed.paginated))
  const [mutation, setMutation] = useState<Mutation | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const active = mutation?.page === page ? mutation : null
  useEffect(() => {
    changingPage.current = false
    return () => { inFlight.current?.abort(); inFlight.current = null }
  }, [page])
  const isCurrentPage = useCallback(() => Boolean(scope && currentPage.current === page && scope === readScope() && currentPortal() === 'patient' && window.location.pathname === pathname), [scope, page, pathname])
  const navigate = useCallback((direction: 'older' | 'newer' | 'newest') => {
    if (!isCurrentPage() || inFlight.current || changingPage.current || resource.refreshing || resource.loading) return
    const previous = cursors ?? [null]
    if (direction === 'older' && (!parsed?.paginated || !parsed.hasMore || !parsed.nextCursor || previous.includes(parsed.nextCursor))) return
    if (direction !== 'older' && previous.length < 2) return
    changingPage.current = true
    setPagination({ scope: scope!, pathname, cursors: direction === 'older' ? [...previous, parsed!.nextCursor] : direction === 'newer' ? previous.slice(0, -1) : [null] })
  }, [isCurrentPage, resource.refreshing, resource.loading, cursors, parsed, scope, pathname])
  const markRead = useCallback(async (id: string, ownerScope: string | null) => {
    if (!ownerScope || ownerScope !== scope || !isCurrentPage() || inFlight.current || changingPage.current || resource.refreshing || pageError) return
    const notice = parsed?.items.find(item => item.id === id)
    if (!notice || notice.isRead || active?.confirmed.includes(id)) return
    const action = captureAction(), controller = new AbortController()
    inFlight.current = controller
    setMutation(previous => ({ page, confirmed: previous?.page === page ? previous.confirmed : [], pendingId: id, errorId: null, error: '' }))
    try {
      const saved = patientNotice(await apiPatch<unknown>(`${PATIENT_NOTIFICATIONS_PATH}/${id}/read`, undefined, undefined, controller.signal))
      if (!action.isCurrent() || currentPage.current !== page || controller.signal.aborted) return
      if (!saved || saved.id !== id || !saved.isRead || saved.source !== notice.source || saved.eventType !== notice.eventType || saved.sourceId !== notice.sourceId || saved.href !== notice.href) throw new Error('The read status could not be confirmed. Please retry.')
      const visibleIds = new Set(parsed?.items.map(item => item.id))
      setMutation(previous => ({ page, confirmed: [...new Set([...(previous?.page === page ? previous.confirmed.filter(value => visibleIds.has(value)) : []), id])], pendingId: null, errorId: null, error: '' }))
      refresh()
    } catch (error) {
      if (!action.isCurrent() || currentPage.current !== page || controller.signal.aborted) return
      setMutation(previous => ({ page, confirmed: previous?.page === page ? previous.confirmed : [], pendingId: null, errorId: id, error: getApiErrorDetail(error) || 'The read status could not be saved. Please retry.' }))
    } finally { if (inFlight.current === controller) inFlight.current = null }
  }, [scope, isCurrentPage, resource.refreshing, pageError, parsed, active, captureAction, page, refresh])
  return {
    scope, items: pageError ? [] : parsed?.items.map(item => ({ ...item, isRead: item.isRead || Boolean(active?.confirmed.includes(item.id)) })) ?? [],
    invalidCount: parsed?.invalidCount ?? 0, loading: resource.loading, refreshing: resource.refreshing,
    error: resource.error || pageError, errorMessage: resource.errorMessage || 'Notifications could not be confirmed. Please retry.',
    refresh: () => { if (isCurrentPage() && !inFlight.current && !changingPage.current) refresh() },
    pendingId: active?.pendingId ?? null, errorId: active?.errorId ?? null, mutationError: active?.error ?? '', markRead,
    paginated: parsed?.paginated ?? Boolean(cursors), unreadCount: pageError ? null : parsed?.unreadCount ?? null,
    pageNumber: cursors?.length ?? 1, hasOlder: !pageError && Boolean(parsed?.hasMore), hasNewer: before !== null,
    older: () => navigate('older'), newer: () => navigate('newer'), newest: () => navigate('newest'),
  }
}

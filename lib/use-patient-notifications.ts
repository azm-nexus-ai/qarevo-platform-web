'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { apiPatch, getApiErrorDetail } from './api'
import { ACCOUNT_CHANGED, readAccountScope } from './account-storage'
import { currentPortal } from './portal-scope'
import { usePortalAction } from './portal-action'
import { usePortalResource } from './use-portal-resource'
import { PATIENT_NOTIFICATIONS_PATH, patientNotice, patientNotices } from './patient-notifications'

const readScope = () => readAccountScope('patient')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
type Mutation = { scope: string; confirmed: string[]; pendingId: string | null; errorId: string | null; error: string }

/** Notification bodies remain in component memory; read receipts live on the server. */
export function usePatientNotifications() {
  const scope = useSyncExternalStore(subscribe, readScope, () => null)
  const captureAction = usePortalAction()
  const resource = usePortalResource<unknown>(PATIENT_NOTIFICATIONS_PATH, false, { refreshOnFocus: true, abortOnCleanup: true })
  const refresh = resource.retry
  const parsed = useMemo(() => patientNotices(resource.data), [resource.data])
  const [mutation, setMutation] = useState<Mutation | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const active = mutation?.scope === scope ? mutation : null
  useEffect(() => () => { inFlight.current?.abort(); inFlight.current = null }, [scope])
  const markRead = useCallback(async (id: string, ownerScope: string | null) => {
    if (!ownerScope || ownerScope !== scope || ownerScope !== readScope() || currentPortal() !== 'patient' || inFlight.current) return
    const notice = parsed?.items.find(item => item.id === id)
    if (!notice || notice.isRead) return
    const action = captureAction(), controller = new AbortController()
    inFlight.current = controller
    setMutation(previous => ({ scope: ownerScope, confirmed: previous?.scope === ownerScope ? previous.confirmed : [], pendingId: id, errorId: null, error: '' }))
    try {
      const saved = patientNotice(await apiPatch<unknown>(`${PATIENT_NOTIFICATIONS_PATH}/${id}/read`, undefined, undefined, controller.signal))
      if (!action.isCurrent() || controller.signal.aborted) return
      if (!saved || saved.id !== id || !saved.isRead || saved.source !== notice.source || saved.eventType !== notice.eventType || saved.sourceId !== notice.sourceId || saved.href !== notice.href) throw new Error('The read status could not be confirmed. Please retry.')
      const visibleIds = new Set(parsed?.items.map(item => item.id))
      setMutation(previous => ({ scope: ownerScope, confirmed: [...new Set([...(previous?.scope === ownerScope ? previous.confirmed.filter(value => visibleIds.has(value)) : []), id])], pendingId: null, errorId: null, error: '' }))
      refresh()
    } catch (error) {
      if (!action.isCurrent() || controller.signal.aborted) return
      setMutation(previous => ({ scope: ownerScope, confirmed: previous?.scope === ownerScope ? previous.confirmed : [], pendingId: null, errorId: id, error: getApiErrorDetail(error) || 'The read status could not be saved. Please retry.' }))
    } finally { if (inFlight.current === controller) inFlight.current = null }
  }, [scope, parsed, captureAction, refresh])
  return {
    scope, items: parsed?.items.map(item => ({ ...item, isRead: item.isRead || Boolean(active?.confirmed.includes(item.id)) })) ?? [],
    invalidCount: parsed?.invalidCount ?? 0, loading: resource.loading, refreshing: resource.refreshing,
    error: resource.error || (resource.data !== null && !parsed), errorMessage: resource.errorMessage || 'Notifications could not be confirmed. Please retry.',
    refresh, pendingId: active?.pendingId ?? null, errorId: active?.errorId ?? null, mutationError: active?.error ?? '', markRead,
  }
}

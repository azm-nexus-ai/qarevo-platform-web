'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { apiPatch, getApiErrorDetail } from '@/lib/api'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { summaryPublicationTime } from '@/lib/patient-consultation-summary'
import { DOCTOR_NOTIFICATIONS_PATH, doctorLabNotice, doctorLabNoticeHref, doctorNoticePage, doctorNoticePath } from '@/lib/doctor-lab-notifications'

const readScope = () => readAccountScope('doctor')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
export default function DoctorLabNotifications() {
  const scope = useSyncExternalStore(subscribe, readScope, () => null), pathname = usePathname(), captureAction = usePortalAction()
  const [pagination, setPagination] = useState<{ scope: string; cursors: string[] } | null>(null)
  const cursors = pagination?.scope === scope ? pagination.cursors : []
  const resource = usePortalResource<unknown>(doctorNoticePath(cursors.at(-1)), false, { refreshOnFocus: true, abortOnCleanup: true })
  const page = useMemo(() => doctorNoticePage(resource.data), [resource.data])
  const [receipt, setReceipt] = useState<{ scope: string; readIds: string[]; pendingId: string | null; errorId: string | null; error: string } | null>(null)
  const actionState = receipt?.scope === scope ? receipt : null
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => { inFlight.current?.abort(); inFlight.current = null }, [scope])
  const refresh = resource.retry
  const markRead = useCallback(async (id: string, owner: string | null) => {
    if (!owner || owner !== scope || owner !== readScope() || currentPortal() !== 'doctor' || window.location.pathname !== pathname || inFlight.current) return
    const notice = page?.items.find(item => item.id === id)
    if (!notice || notice.isRead) return
    const action = captureAction(), controller = new AbortController()
    inFlight.current = controller
    setReceipt(previous => ({ scope: owner, readIds: previous?.scope === owner ? previous.readIds : [], pendingId: id, errorId: null, error: '' }))
    try {
      const saved = doctorLabNotice(await apiPatch<unknown>(`${DOCTOR_NOTIFICATIONS_PATH}/${id}/read`, undefined, undefined, controller.signal))
      if (!action.isCurrent() || controller.signal.aborted) return
      if (!saved || saved.id !== id || !saved.isRead || saved.patientId !== notice.patientId || saved.requestId !== notice.requestId || saved.fileId !== notice.fileId) throw new Error('The notification read receipt could not be confirmed. Please retry.')
      const visible = new Set(page?.items.map(item => item.id))
      setReceipt(previous => ({ scope: owner, readIds: [...new Set([...(previous?.scope === owner ? previous.readIds.filter(value => visible.has(value)) : []), id])], pendingId: null, errorId: null, error: '' }))
      refresh()
    } catch (error) {
      if (action.isCurrent() && !controller.signal.aborted) setReceipt(previous => ({ scope: owner, readIds: previous?.scope === owner ? previous.readIds : [], pendingId: null, errorId: id, error: getApiErrorDetail(error) || 'The read receipt could not be saved. Please retry.' }))
    } finally { if (inFlight.current === controller) inFlight.current = null }
  }, [scope, page, captureAction, refresh, pathname])
  const error = resource.error || (resource.data !== null && !page)
  return <PortalCard role='region' aria-label='Clinician lab notifications'>
    <div className='mb-5 flex flex-wrap items-start justify-between gap-3'><div><h2 className='portal-h2'>Lab result updates</h2><p className='max-w-2xl text-sm leading-7 text-secondary'>Uploads linked to your own lab orders. Reading an update or opening a file does not record clinical review.</p></div><PortalButton disabled={resource.refreshing} onClick={refresh}>Refresh result updates</PortalButton></div>
    {resource.loading ? <p role='status' className='text-sm text-secondary'>Loading result updates…</p>
      : error ? <div role='alert'><p className='mb-3 text-sm leading-6 text-secondary'>{resource.errorMessage || 'Result updates could not be confirmed. Please retry.'}</p><PortalButton onClick={refresh}>Retry result updates</PortalButton></div>
        : !page?.items.length ? <p className='rounded-xl border border-dashed border-theme p-5 text-sm leading-7 text-secondary'>No result updates are available on this page. New uploads for your orders will appear here.</p>
          : <ol className='grid gap-4'>{page.items.map(notice => {
            const isRead = notice.isRead || Boolean(actionState?.readIds.includes(notice.id)), href = doctorLabNoticeHref(notice)
            return <li key={notice.id} data-lab-notification-id={notice.id} className='min-w-0 rounded-xl border border-theme bg-surface-subtle p-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'><h3 className='portal-h3'>Lab result uploaded</h3><span className='rounded-full border border-theme bg-surface px-3 py-1 text-xs font-semibold text-ink'>{isRead ? 'Read' : 'New'}</span></div>
              <p className='text-sm leading-7 text-secondary'>{notice.uploadedBy === 'patient' ? 'Uploaded by the patient.' : 'Uploaded by the care team.'} <time dateTime={notice.createdAt}>{summaryPublicationTime(notice.createdAt)}</time></p>
              <p className='mt-2 text-sm leading-7 text-secondary'>{notice.availability === 'current' ? 'This is the current file linked to the order. Select it to review the order before opening the file.' : notice.availability === 'superseded' ? 'This upload has been replaced. This update cannot open the replacement file. Choose the current result separately in Lab Orders.' : 'The referenced file is no longer available to this account. Review the order or contact the care team.'}</p>
              <div className='mt-3 flex flex-wrap gap-2'>{href ? <Link href={href} prefetch={false} className='portal-button portal-button-secondary q-button q-button-secondary' onClick={event => { if (scope !== readScope() || currentPortal() !== 'doctor' || window.location.pathname !== pathname) event.preventDefault() }}>View selected result order</Link> : <PortalButton disabled>{notice.availability === 'superseded' ? 'Upload superseded' : 'Result unavailable'}</PortalButton>}
                {!isRead && <PortalButton disabled={Boolean(actionState?.pendingId)} aria-label={`${actionState?.errorId === notice.id ? 'Retry marking' : 'Mark'} result update ${notice.id} as read`} onClick={() => void markRead(notice.id, scope)}>{actionState?.pendingId === notice.id ? 'Marking as read…' : actionState?.errorId === notice.id ? 'Retry mark as read' : 'Mark as read'}</PortalButton>}
              </div>{actionState?.errorId === notice.id && <p role='alert' className='mt-3 text-sm leading-7 text-secondary'>{actionState.error}</p>}
            </li>
          })}</ol>}
    <nav aria-label='Result notification pages' className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-secondary'>Page {cursors.length + 1} · Up to 25 updates per page</p><div className='flex flex-wrap gap-2'><PortalButton disabled={!cursors.length || resource.refreshing || Boolean(actionState?.pendingId)} onClick={() => { if (scope) setPagination({ scope, cursors: cursors.slice(0, -1) }) }}>Newer result updates</PortalButton><PortalButton disabled={!page?.hasMore || resource.refreshing || Boolean(actionState?.pendingId)} onClick={() => { if (scope && page?.nextCursor) setPagination({ scope, cursors: [...cursors, page.nextCursor] }) }}>Older result updates</PortalButton></div></nav>
    <Link href='/doctor/lab-orders' className='mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4'>Open Lab Orders</Link>
  </PortalCard>
}

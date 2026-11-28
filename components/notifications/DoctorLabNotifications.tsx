'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('doctorLabNotifications')
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
      if (!saved || saved.id !== id || !saved.isRead || saved.patientId !== notice.patientId || saved.requestId !== notice.requestId || saved.fileId !== notice.fileId) throw new Error(t('receiptUnconfirmed'))
      const visible = new Set(page?.items.map(item => item.id))
      setReceipt(previous => ({ scope: owner, readIds: [...new Set([...(previous?.scope === owner ? previous.readIds.filter(value => visible.has(value)) : []), id])], pendingId: null, errorId: null, error: '' }))
      refresh()
    } catch (error) {
      if (action.isCurrent() && !controller.signal.aborted) setReceipt(previous => ({ scope: owner, readIds: previous?.scope === owner ? previous.readIds : [], pendingId: null, errorId: id, error: getApiErrorDetail(error) || t('receiptFailed') }))
    } finally { if (inFlight.current === controller) inFlight.current = null }
  }, [scope, page, captureAction, refresh, pathname, t])
  const error = resource.error || (resource.data !== null && !page)
  return <PortalCard role='region' aria-label={t('label')}>
    <div className='mb-5 flex flex-wrap items-start justify-between gap-3'><div><h2 className='portal-h2'>{t('title')}</h2><p className='max-w-2xl text-sm leading-7 text-secondary'>{t('intro')}</p></div><PortalButton disabled={resource.refreshing} onClick={refresh}>{t('refresh')}</PortalButton></div>
    {resource.loading ? <p role='status' className='text-sm text-secondary'>{t('loading')}</p>
      : error ? <div role='alert'><p className='mb-3 text-sm leading-6 text-secondary'>{resource.errorMessage || t('unconfirmed')}</p><PortalButton onClick={refresh}>{t('retry')}</PortalButton></div>
        : !page?.items.length ? <p className='rounded-xl border border-dashed border-theme p-5 text-sm leading-7 text-secondary'>{t('none')}</p>
          : <ol className='grid gap-4'>{page.items.map(notice => {
            const isRead = notice.isRead || Boolean(actionState?.readIds.includes(notice.id)), href = doctorLabNoticeHref(notice)
            return <li key={notice.id} data-lab-notification-id={notice.id} className='min-w-0 rounded-xl border border-theme bg-surface-subtle p-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'><h3 className='portal-h3'>{t('uploaded')}</h3><span className='rounded-full border border-theme bg-surface px-3 py-1 text-xs font-semibold text-ink'>{isRead ? t('read') : t('new')}</span></div>
              <p className='text-sm leading-7 text-secondary'>{notice.uploadedBy === 'patient' ? t('byPatient') : t('byCareTeam')} <time dateTime={notice.createdAt}>{summaryPublicationTime(notice.createdAt)}</time></p>
              <p className='mt-2 text-sm leading-7 text-secondary'>{notice.availability === 'current' ? t('currentFile') : notice.availability === 'superseded' ? t('replaced') : t('fileGone')}</p>
              <div className='mt-3 flex flex-wrap gap-2'>{href ? <Link href={href} prefetch={false} className='portal-button portal-button-secondary q-button q-button-secondary' onClick={event => { if (scope !== readScope() || currentPortal() !== 'doctor' || window.location.pathname !== pathname) event.preventDefault() }}>{t('viewOrder')}</Link> : <PortalButton disabled>{notice.availability === 'superseded' ? t('superseded') : t('unavailable')}</PortalButton>}
                {!isRead && <PortalButton disabled={Boolean(actionState?.pendingId)} aria-label={t(actionState?.errorId === notice.id ? 'retryMarkNamed' : 'markNamed', { id: notice.id })} onClick={() => void markRead(notice.id, scope)}>{actionState?.pendingId === notice.id ? t('marking') : actionState?.errorId === notice.id ? t('retryMark') : t('mark')}</PortalButton>}
              </div>{actionState?.errorId === notice.id && <p role='alert' className='mt-3 text-sm leading-7 text-secondary'>{actionState.error}</p>}
            </li>
          })}</ol>}
    <nav aria-label={t('pages')} className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-secondary'>Page {cursors.length + 1} · Up to 25 updates per page</p><div className='flex flex-wrap gap-2'><PortalButton disabled={!cursors.length || resource.refreshing || Boolean(actionState?.pendingId)} onClick={() => { if (scope) setPagination({ scope, cursors: cursors.slice(0, -1) }) }}>{t('newer')}</PortalButton><PortalButton disabled={!page?.hasMore || resource.refreshing || Boolean(actionState?.pendingId)} onClick={() => { if (scope && page?.nextCursor) setPagination({ scope, cursors: [...cursors, page.nextCursor] }) }}>{t('older')}</PortalButton></div></nav>
    <Link href='/doctor/lab-orders' className='mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4'>{t('openOrders')}</Link>
  </PortalCard>
}

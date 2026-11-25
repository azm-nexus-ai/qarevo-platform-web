'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { apiPost, getApiErrorDetail, getApiErrorRequestId } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { WORKFLOW_DELIVERY_PATH, WORKFLOW_DELIVERY_PAGE_SIZE, workflowDelivery, workflowDeliveryPath, workflowRetry } from '@/lib/workflow-delivery'
import SupportReference from '@/components/ui/SupportReference'

const readScope = () => readAccountScope('admin')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
type Owner = { scope: string | null; pathname: string }
type Action = { owner: Owner; busyId: string | null; error: string; reference: string | null; notice: string }

export default function WorkflowDeliveryCard() {
  const pathname = usePathname(), scope = useSyncExternalStore(subscribe, readScope, () => null)
  // Route and actor changes unmount the old resource and its pending mutation.
  return <WorkflowDeliveryView key={JSON.stringify([pathname, scope])} scope={scope} pathname={pathname} />
}

function WorkflowDeliveryView({ scope, pathname }: Owner) {
  const t = useTranslations('workflowDelivery'), dateLocale = useLocale().startsWith('de') ? 'de-DE' : undefined
  const captureAction = usePortalAction(), owner = useMemo(() => ({ scope, pathname }), [scope, pathname])
  const [page, setPage] = useState({ offset: 0, feedback: '', entered: false })
  const [permission, setPermission] = useState<boolean | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const resource = usePortalResource<unknown>(scope ? workflowDeliveryPath(page.offset) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const parsed = useMemo(() => workflowDelivery(resource.data), [resource.data])
  const invalid = resource.data !== null && (!parsed || (page.offset > 0 && !parsed.paginated))
  const data = invalid ? null : parsed
  if (data && permission !== data.canRetry) {
    setPermission(data.canRetry)
    setAction(null)
  }
  if (data?.paginated && data.offset !== page.offset) {
    setPage({ offset: data.offset, entered: true, feedback: t('queueChanged') })
  }
  const context = useMemo(() => ({ owner, offset: page.offset, permission }), [owner, page.offset, permission])
  const latestContext = useRef(context), changingPage = useRef(false), inFlight = useRef<AbortController | null>(null)
  latestContext.current = context
  useEffect(() => {
    changingPage.current = false
    return () => { inFlight.current?.abort(); inFlight.current = null }
  }, [context])
  const currentAction = action?.owner === owner ? action : null
  const busyId = currentAction?.busyId ?? null, loading = resource.refreshing, busy = loading || Boolean(busyId)
  const loadError = resource.error ? resource.errorMessage : invalid ? t('invalid') : ''
  const canUseContext = () => Boolean(scope && latestContext.current === context && scope === readScope() && currentPortal() === 'admin' && window.location.pathname === pathname)
  const refresh = () => {
    if (!canUseContext() || inFlight.current || changingPage.current) return
    resource.retry()
  }
  const navigate = (direction: 'previous' | 'next' | 'first') => {
    if (!canUseContext() || busy || inFlight.current || changingPage.current) return
    const offset = data?.paginated ? data.offset : page.offset
    if (direction === 'next' && (!data?.paginated || !data.hasNext)) return
    if (direction !== 'next' && offset === 0) return
    changingPage.current = true
    setAction(null)
    setPage({ offset: direction === 'first' ? 0 : direction === 'previous' ? Math.max(0, offset - WORKFLOW_DELIVERY_PAGE_SIZE) : offset + WORKFLOW_DELIVERY_PAGE_SIZE,
      entered: true, feedback: '' })
  }
  async function retry(id: string) {
    if (!canUseContext() || busy || changingPage.current || inFlight.current || !data?.canRetry || data.status === 'disabled' || !data.jobs.some(job => job.consultationId === id)) return
    const captured = captureAction(), controller = new AbortController()
    inFlight.current = controller
    setAction({ owner, busyId: id, error: '', reference: null, notice: '' })
    const current = () => captured.isCurrent() && latestContext.current === context && !controller.signal.aborted
    try {
      const result = workflowRetry(await apiPost<unknown>(WORKFLOW_DELIVERY_PATH + '/' + encodeURIComponent(id) + '/retry', {}, undefined, controller.signal))
      if (!current()) return
      if (!result) throw new Error(t('retryInvalid'))
      const confirmed = result.status === 'delivered' || result.status === 'already_delivered'
      setAction({ owner, busyId: null, error: confirmed ? '' : t('stillPending'),
        reference: null, notice: confirmed ? t('confirmed') : '' })
    } catch (error) {
      if (!current()) return
      setAction({ owner, busyId: null, error: getApiErrorDetail(error) || t('retryFailed'),
        reference: getApiErrorRequestId(error), notice: '' })
    } finally {
      if (current()) {
        setPage({ offset: 0, entered: Boolean(data.paginated), feedback: t('afterRetry') })
        if (page.offset === 0) resource.retry()
      }
      if (inFlight.current === controller) inFlight.current = null
    }
  }

  const pageNumber = Math.floor(page.offset / WORKFLOW_DELIVERY_PAGE_SIZE) + 1
  const pageStatus = useRef<HTMLParagraphElement>(null), previousPage = useRef(pageNumber)
  useEffect(() => {
    if (previousPage.current !== pageNumber) pageStatus.current?.focus()
    previousPage.current = pageNumber
  }, [pageNumber])
  return <section aria-labelledby='workflow-delivery-title' aria-busy={busy} className='min-w-0 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:p-7'>
    <div className='flex flex-wrap items-start justify-between gap-4'>
      <div><p className='text-xs font-semibold uppercase tracking-widest text-muted'>{t('eyebrow')}</p>
        <h2 id='workflow-delivery-title' className='mt-2 text-xl font-semibold tracking-tight text-ink'>{t('title')}</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>{t('intro')}</p></div>
      <button type='button' className='q-button q-button-secondary' disabled={busy} onClick={refresh}>{t('refresh')}</button>
    </div>
    {(data?.paginated || page.entered) && <nav aria-label={t('pagesLabel')} className='mt-5 flex flex-wrap items-center gap-3'>
      <p ref={pageStatus} tabIndex={-1} role='status' aria-label={t('pageLabel')} aria-live='polite' className='text-sm leading-6 text-secondary'>{t('page', { page: pageNumber })}{loading ? ` · ${t('loading')}` : ''}</p>
      <button type='button' className='q-button q-button-secondary' disabled={busy || page.offset === 0} onClick={() => navigate('previous')}>{t('previous')}</button>
      <button type='button' className='q-button q-button-secondary' disabled={busy || !data?.hasNext} onClick={() => navigate('next')}>{t('next')}</button>
      {page.offset > 0 && <button type='button' className='q-button q-button-secondary' disabled={busy} onClick={() => navigate('first')}>{t('first')}</button>}
    </nav>}
    {loading && <p aria-live='polite' className='mt-5 text-sm text-secondary'>{t('loading')}</p>}
    {loadError && <div role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'><p>{loadError} {t('useRefresh')}</p><SupportReference requestId={resource.errorRequestId} /></div>}
    {currentAction?.error && <div role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'><p>{currentAction.error}</p><SupportReference requestId={currentAction.reference} /></div>}
    {currentAction?.notice && <p role='status' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{currentAction.notice}</p>}
    {page.feedback && <p role='status' className='mt-4 text-sm leading-6 text-secondary'>{page.feedback}</p>}
    {data && !loading && !loadError && <>
      <div className='mt-6 flex flex-wrap items-center gap-3 text-sm'>
        <span className='rounded-full border border-theme bg-surface-subtle px-3 py-2 font-semibold text-ink'>
          {data.status === 'disabled' ? t('notEnabled') : data.status === 'healthy' ? t('upToDate') : t('updatesPending')}
        </span>
        {data.status !== 'disabled' && <span className='text-secondary'>{t('counts', { pending: data.pendingCount, failed: data.failedCount })}</span>}
      </div>
      {data.status === 'disabled' ? <p className='mt-4 text-sm leading-6 text-secondary'>{t('disabledText')}</p> : <>
        <p className='mt-4 text-sm leading-6 text-secondary'>{data.automaticDelivery
          ? t('automatic')
          : t('paused')}</p>
        {!data.paginated && <p className='mt-3 text-sm leading-6 text-secondary'>{t('bounded', { count: data.jobs.length })}</p>}
        {data.paginated && data.jobs.length > 0 && <p className='mt-3 text-sm leading-6 text-secondary'>{t('showing', { from: data.offset + 1, to: data.offset + data.jobs.length, total: data.totalCount ?? '—' })}</p>}
        {!data.jobs.length && <p className='mt-5 text-sm leading-6 text-secondary'>{data.pendingCount ? t('emptyPage') : t('none')}</p>}
        {data.jobs.length > 0 && <ul className='mt-5 divide-y divide-theme'>
          {data.jobs.map(job => <li key={job.consultationId} data-workflow-consultation={job.consultationId} className='flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'><h3 className='text-sm font-semibold text-ink'>{t('reference')}</h3>
              <code className='mt-1 block break-all text-xs text-secondary'>{job.consultationId}</code>
              <p className='mt-2 text-sm text-secondary'>{t('attempts', { count: job.attempts })}</p>
              {job.lastErrorCode && <p className='mt-1 text-sm text-secondary'>{t.rich('lastResult', { code: job.lastErrorCode, mono: chunks => <code>{chunks}</code> })}</p>}
              <p className='mt-1 text-sm text-secondary'>{t.rich('eligible', { time: new Date(job.nextAttemptAt).toLocaleString(dateLocale), stamp: chunks => <time dateTime={job.nextAttemptAt}>{chunks}</time> })}</p>
            </div>
            {data.canRetry ? <button type='button' className='q-button q-button-secondary shrink-0' disabled={busy} onClick={() => void retry(job.consultationId)}
              aria-label={t('retryLabel', { id: job.consultationId })}>{busyId === job.consultationId ? t('retrying') : t('retry')}</button>
              : <p className='text-sm text-secondary'>{t('operationsOnly')}</p>}
          </li>)}
        </ul>}
      </>}
    </>}
  </section>
}

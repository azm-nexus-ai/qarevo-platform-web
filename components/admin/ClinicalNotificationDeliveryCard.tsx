'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiPost, getApiErrorDetail } from '@/lib/api'
import { readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'

type Job = {
  event_id: string; record_id: string | null; revision: number | null
  attempts: number; max_attempts: number; next_attempt_at: string | null
  last_error_code: 'DELIVERY_NOT_ACKNOWLEDGED' | 'DELIVERY_CONTEXT_INVALID' | null
}
type Delivery = {
  status: 'healthy' | 'warning' | 'disabled'; automatic_delivery: boolean; can_retry: boolean
  pending_count: number; failed_count: number; exhausted_count: number; jobs: Job[]
  offset: number; limit: number; total_count: number; has_next: boolean; has_previous: boolean
}
const path = '/api/v1/admin/clinical-notification-delivery'
const pageSize = 25

export default function ClinicalNotificationDeliveryCard() {
  const t = useTranslations('noticeDelivery'), dateLocale = useLocale().startsWith('de') ? 'de-DE' : undefined
  const captureAction = usePortalAction()
  const renderedScope = readAccountScope('admin')
  const [offset, setOffset] = useState(0)
  const resource = usePortalResource<Delivery>(`${path}?limit=${pageSize}&offset=${offset}`, false, { abortOnCleanup: true })
  const valid = resource.data && Array.isArray(resource.data.jobs) && ['healthy', 'warning', 'disabled'].includes(resource.data.status)
  const data = valid ? resource.data : null
  const loading = resource.refreshing
  const loadError = resource.error ? resource.errorMessage : resource.data && !valid ? t('invalid') : ''
  const [action, setAction] = useState<{ scope: string | null; busy: string | null; error: string; notice: string } | null>(null)
  const currentAction = action?.scope === readAccountScope('admin') ? action : null
  const busy = currentAction?.busy ?? null, actionError = currentAction?.error ?? '', notice = currentAction?.notice ?? ''

  async function retry(id: string) {
    if (busy || !renderedScope || renderedScope !== readAccountScope('admin')) return
    const captured = captureAction(), scope = captured.scope
    setAction({ scope, busy: id, error: '', notice: '' })
    try {
      const result = await apiPost<{ status: string }>(`${path}/${encodeURIComponent(id)}/retry`, {})
      if (!captured.isCurrent()) return
      setAction({ scope, busy: null, error: result.status === 'delivered' || result.status === 'already_delivered' ? '' : t('stillPending'),
        notice: result.status === 'delivered' || result.status === 'already_delivered' ? t('confirmed') : '' })
    } catch (error) {
      if (!captured.isCurrent()) return
      setAction({ scope, busy: null, error: getApiErrorDetail(error) || t('retryFailed'), notice: '' })
    } finally {
      if (captured.isCurrent()) resource.retry()
    }
  }

  return <section aria-labelledby='clinical-notification-delivery-title' aria-busy={loading || Boolean(busy)}
    className='min-w-0 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:p-7'>
    <div className='flex flex-wrap items-start justify-between gap-4'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-widest text-muted'>{t('eyebrow')}</p>
        <h2 id='clinical-notification-delivery-title' className='mt-2 text-xl font-semibold tracking-tight text-ink'>{t('title')}</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>{t('intro')}</p>
      </div>
      <button type='button' className='q-button q-button-secondary' disabled={loading || Boolean(busy)} onClick={resource.retry}>{t('refresh')}</button>
    </div>
    {loading && <p role='status' className='mt-5 text-sm text-muted'>{t('loading')}</p>}
    {loadError && <p role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{loadError} {t('useRefresh')}</p>}
    {actionError && <p role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{actionError}</p>}
    {notice && <p role='status' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{notice}</p>}
    {data && !loading && !loadError && <>
      <div className='mt-6 flex flex-wrap items-center gap-3 text-sm'>
        <span className='rounded-full border border-theme bg-surface-subtle px-3 py-2 font-semibold text-ink'>
          {data.status === 'disabled' ? t('notEnabled') : data.status === 'healthy' ? t('allAcknowledged') : t('pending')}
        </span>
        {data.status !== 'disabled' && <p className='text-secondary'>{t('counts', { pending: data.pending_count, failed: data.failed_count, exhausted: data.exhausted_count })}</p>}
      </div>
      {data.status === 'disabled' ? <p className='mt-4 text-sm leading-6 text-secondary'>{t('disabledText')}</p> : <>
        <p className='mt-4 text-sm leading-6 text-muted'>{data.automatic_delivery
          ? t('automatic')
          : t('paused')}</p>
        {data.jobs.length === 0 && data.pending_count > 0 && <p className='mt-5 text-sm text-secondary'>{t('emptyPage')}</p>}
        <ul className='mt-5 divide-y divide-theme'>
          {data.jobs.map(job => <li key={job.event_id} className='flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold text-ink'>{t('notice')}{job.revision ? ` · ${t('revision', { revision: job.revision })}` : ''}</h3>
              <p className='mt-1 text-xs text-secondary'>{t('reference')} <code className='break-all'>{job.event_id}</code></p>
              <p className='mt-2 text-sm text-muted'>{t('attempts', { used: job.attempts, max: job.max_attempts })}</p>
              {job.last_error_code && <p className='mt-1 text-sm text-secondary'>{job.last_error_code === 'DELIVERY_CONTEXT_INVALID'
                ? t('contextInvalid')
                : t('notAcknowledged')}</p>}
              {job.attempts >= job.max_attempts
                ? <p className='mt-1 text-sm text-secondary'>{t('exhausted')}</p>
                : job.next_attempt_at && <p className='mt-1 text-sm text-secondary'>{t('nextAttempt', { time: new Date(job.next_attempt_at).toLocaleString(dateLocale) })}</p>}
            </div>
            {data.can_retry
              ? <button type='button' className='q-button q-button-secondary shrink-0' disabled={loading || Boolean(busy)} onClick={() => void retry(job.event_id)}
                aria-label={t('retryLabel', { id: job.event_id })}>{busy === job.event_id ? t('retrying') : t('retry')}</button>
              : <p className='text-sm text-muted'>{t('operationsOnly')}</p>}
          </li>)}
        </ul>
        {(data.has_previous || data.has_next) && <nav aria-label={t('pagesLabel')} className='mt-5 flex flex-wrap items-center justify-between gap-3'>
          <button type='button' className='q-button q-button-secondary' disabled={!data.has_previous || Boolean(busy)} onClick={() => setOffset(Math.max(0, offset - pageSize))}>{t('previous')}</button>
          <span className='text-sm text-muted'>{t('page', { page: Math.floor(data.offset / pageSize) + 1 })}</span>
          <button type='button' className='q-button q-button-secondary' disabled={!data.has_next || offset + pageSize > 10000 || Boolean(busy)} onClick={() => setOffset(offset + pageSize)}>{t('next')}</button>
        </nav>}
      </>}
    </>}
  </section>
}

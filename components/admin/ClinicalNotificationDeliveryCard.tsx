'use client'

import { useState } from 'react'
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
  const captureAction = usePortalAction()
  const renderedScope = readAccountScope('admin')
  const [offset, setOffset] = useState(0)
  const resource = usePortalResource<Delivery>(`${path}?limit=${pageSize}&offset=${offset}`, false, { abortOnCleanup: true })
  const valid = resource.data && Array.isArray(resource.data.jobs) && ['healthy', 'warning', 'disabled'].includes(resource.data.status)
  const data = valid ? resource.data : null
  const loading = resource.refreshing
  const loadError = resource.error ? resource.errorMessage : resource.data && !valid ? 'Publication notice delivery returned an invalid response.' : ''
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
      setAction({ scope, busy: null, error: result.status === 'delivered' || result.status === 'already_delivered' ? '' : 'Delivery is still pending. Review the next eligible attempt and access state before retrying.',
        notice: result.status === 'delivered' || result.status === 'already_delivered' ? 'The patient’s in-app notice is confirmed. Retrying does not create a second notice.' : '' })
    } catch (error) {
      if (!captured.isCurrent()) return
      setAction({ scope, busy: null, error: getApiErrorDetail(error) || 'Delivery could not be confirmed. The notice remains saved for recovery.', notice: '' })
    } finally {
      if (captured.isCurrent()) resource.retry()
    }
  }

  return <section aria-labelledby='clinical-notification-delivery-title' aria-busy={loading || Boolean(busy)}
    className='min-w-0 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:p-7'>
    <div className='flex flex-wrap items-start justify-between gap-4'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-widest text-muted'>Patient communication</p>
        <h2 id='clinical-notification-delivery-title' className='mt-2 text-xl font-semibold tracking-tight text-ink'>Published-summary notices</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>Delivery acknowledgements for patient in-app notices. This view contains record references only; it sends no email or SMS.</p>
      </div>
      <button type='button' className='q-button q-button-secondary' disabled={loading || Boolean(busy)} onClick={resource.retry}>Refresh notice delivery</button>
    </div>
    {loading && <p role='status' className='mt-5 text-sm text-muted'>Loading notice delivery…</p>}
    {loadError && <p role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{loadError} Use Refresh notice delivery to try again.</p>}
    {actionError && <p role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{actionError}</p>}
    {notice && <p role='status' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{notice}</p>}
    {data && !loading && !loadError && <>
      <div className='mt-6 flex flex-wrap items-center gap-3 text-sm'>
        <span className='rounded-full border border-theme bg-surface-subtle px-3 py-2 font-semibold text-ink'>
          {data.status === 'disabled' ? 'Delivery not enabled' : data.status === 'healthy' ? 'All notices acknowledged' : 'Notice delivery pending'}
        </span>
        {data.status !== 'disabled' && <p className='text-secondary'>{data.pending_count} pending · {data.failed_count} failed · {data.exhausted_count} requiring manual recovery</p>}
      </div>
      {data.status === 'disabled' ? <p className='mt-4 text-sm leading-6 text-secondary'>Clinical notification delivery is disabled in this environment. Contact the technical owner before relying on automatic notices.</p> : <>
        <p className='mt-4 text-sm leading-6 text-muted'>{data.automatic_delivery
          ? 'New publications and service startup trigger a bounded delivery pass. During an outage, saved failures wait for a later pass or an operations retry.'
          : 'Automatic recovery is paused. An operations administrator can retry individual saved notices.'}</p>
        {data.jobs.length === 0 && data.pending_count > 0 && <p className='mt-5 text-sm text-secondary'>No pending entries remain on this page. Return to the previous page or refresh the queue.</p>}
        <ul className='mt-5 divide-y divide-theme'>
          {data.jobs.map(job => <li key={job.event_id} className='flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold text-ink'>Publication notice{job.revision ? ` · revision ${job.revision}` : ''}</h3>
              <p className='mt-1 text-xs text-secondary'>Delivery reference <code className='break-all'>{job.event_id}</code></p>
              <p className='mt-2 text-sm text-muted'>{job.attempts} of {job.max_attempts} attempts used</p>
              {job.last_error_code && <p className='mt-1 text-sm text-secondary'>{job.last_error_code === 'DELIVERY_CONTEXT_INVALID'
                ? 'Record access or recipient state needs review. Retrying cannot override access restrictions.'
                : 'Delivery was not acknowledged. The same saved notice will be used for recovery.'}</p>}
              {job.attempts >= job.max_attempts
                ? <p className='mt-1 text-sm text-secondary'>Automatic attempts exhausted. Retry restarts delivery for this notice only.</p>
                : job.next_attempt_at && <p className='mt-1 text-sm text-secondary'>Next eligible attempt: {new Date(job.next_attempt_at).toLocaleString()}</p>}
            </div>
            {data.can_retry
              ? <button type='button' className='q-button q-button-secondary shrink-0' disabled={loading || Boolean(busy)} onClick={() => void retry(job.event_id)}
                aria-label={`Retry publication notice ${job.event_id}`}>{busy === job.event_id ? 'Retrying notice…' : 'Retry saved notice'}</button>
              : <p className='text-sm text-muted'>Operations access required to retry.</p>}
          </li>)}
        </ul>
        {(data.has_previous || data.has_next) && <nav aria-label='Notice delivery pages' className='mt-5 flex flex-wrap items-center justify-between gap-3'>
          <button type='button' className='q-button q-button-secondary' disabled={!data.has_previous || Boolean(busy)} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous notices</button>
          <span className='text-sm text-muted'>Page {Math.floor(data.offset / pageSize) + 1}</span>
          <button type='button' className='q-button q-button-secondary' disabled={!data.has_next || offset + pageSize > 10000 || Boolean(busy)} onClick={() => setOffset(offset + pageSize)}>Next notices</button>
        </nav>}
      </>}
    </>}
  </section>
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, clearPortalSession, isAuthError } from '@/lib/api'

type Delivery = {
  status: 'healthy' | 'warning' | 'disabled'
  pending_count: number
  failed_count: number
  automatic_delivery: boolean
  can_retry: boolean
  jobs: { consultation_id: string; attempts: number; next_attempt_at: string; last_error_code: string | null }[]
}
const path = '/api/v1/admin/workflow-delivery'
const button = 'rounded-xl border border-theme bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

export default function WorkflowDeliveryCard() {
  const router = useRouter()
  const [data, setData] = useState<Delivery | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    setLoading(true); setLoadError('')
    apiGet<Delivery>(path).then(result => { if (current) setData(result) })
      .catch(error => {
        if (!current) return
        if (isAuthError(error)) { clearPortalSession(); router.replace('/auth/admin/login'); return }
        setLoadError(error instanceof Error ? error.message : 'Workflow delivery could not be loaded.')
      }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [attempt, router])

  async function retry(id: string) {
    setBusy(id); setActionError(''); setNotice('')
    try {
      const result = await apiPost<{ delivered: number; failed: number; status: string }>(`${path}/${encodeURIComponent(id)}/retry`, {})
      if (result.delivered || result.status === 'already_delivered') setNotice('The clinical workflow update is confirmed.')
      else setActionError('The update is still pending. Review the latest result below before retrying.')
    } catch (error) {
      if (isAuthError(error)) { clearPortalSession(); router.replace('/auth/admin/login'); return }
      setActionError(error instanceof Error ? error.message : 'Delivery could not be confirmed. The update remains saved for retry.')
    } finally { setBusy(null); setAttempt(value => value + 1) }
  }

  return <section aria-labelledby='workflow-delivery-title' aria-busy={loading || Boolean(busy)} className='min-w-0 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:p-7'>
    <div className='flex flex-wrap items-start justify-between gap-4'>
      <div><p className='text-xs font-semibold uppercase tracking-widest text-muted'>Care operations</p>
        <h2 id='workflow-delivery-title' className='mt-2 text-xl font-semibold tracking-tight text-ink'>Clinical workflow delivery</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>Keep booking, consultation and clinical-record stages aligned. Pending updates remain saved until their delivery is confirmed.</p></div>
      <button type='button' className={button} disabled={loading || Boolean(busy)} onClick={() => setAttempt(value => value + 1)}>Refresh delivery status</button>
    </div>
    {loading && <p role='status' className='mt-5 text-sm text-muted'>Loading delivery status…</p>}
    {loadError && <p role='alert' className='mt-5 rounded-xl border border-red-400 bg-surface-subtle p-4 text-sm text-ink'>{loadError} Use Refresh delivery status to try again.</p>}
    {actionError && <p role='alert' className='mt-5 rounded-xl border border-amber-500 bg-surface-subtle p-4 text-sm text-ink'>{actionError}</p>}
    {notice && <p role='status' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{notice}</p>}
    {data && !loadError && <>
      <div className='mt-6 flex flex-wrap items-center gap-3 text-sm'>
        <span className='rounded-full border border-theme bg-surface-subtle px-3 py-2 font-semibold text-ink'>
          {data.status === 'disabled' ? 'Not enabled' : data.status === 'healthy' ? 'Up to date' : 'Updates pending'}
        </span>
        {data.status !== 'disabled' && <span className='text-secondary'>{data.pending_count} pending · {data.failed_count} needing attention</span>}
      </div>
      {data.status === 'disabled' ? <p className='mt-4 text-sm leading-6 text-secondary'>Workflow delivery is not enabled for this environment. Contact the technical owner before relying on synchronized clinical stages.</p> : <>
        <p className='mt-4 text-sm leading-6 text-muted'>{data.automatic_delivery
          ? 'Automatic delivery runs after changes and service startup. During an extended outage, an operations administrator can retry a saved update here.'
          : 'Automatic delivery is paused. Pending updates require an operations administrator to retry them.'}</p>
        {data.jobs.length > 0 && <ul className='mt-5 divide-y divide-theme'>
          {data.jobs.map(job => <li key={job.consultation_id} className='flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'><p className='text-sm font-semibold text-ink'>Consultation reference</p>
              <code className='mt-1 block break-all text-xs text-secondary'>{job.consultation_id}</code>
              <p className='mt-2 text-sm text-muted'>{job.attempts} unsuccessful attempt{job.attempts === 1 ? '' : 's'}</p>
              {job.last_error_code && <p className='mt-1 text-sm text-secondary'>Last result: <code>{job.last_error_code}</code>. Eligible for retry from {new Date(job.next_attempt_at).toLocaleString()}.</p>}
            </div>
            {data.can_retry ? <button type='button' className={`${button} shrink-0`} disabled={loading || Boolean(busy)} onClick={() => void retry(job.consultation_id)}
              aria-label={`Retry update for consultation ${job.consultation_id}`}>{busy === job.consultation_id ? 'Retrying update…' : 'Retry update'}</button>
              : <p className='text-sm text-muted'>Operations access required to retry.</p>}
          </li>)}
        </ul>}
        {data.pending_count > data.jobs.length && <p className='mt-3 text-sm text-muted'>Showing the first {data.jobs.length} pending updates. Refresh after recovery to review the next entries.</p>}
      </>}
    </>}
  </section>
}

'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { apiPost, apiPut, getApiErrorDetail, getApiErrorRequestId } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { absenceRequest, TIME_OFF_PAGE_SIZE, TIME_OFF_STATUSES, timeOffPage, timeOffPath, timeOffRecord, timeOffReference, type TimeOff } from '@/lib/doctor-time-off'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import SupportReference from '@/components/ui/SupportReference'

const readScope = () => readAccountScope('admin')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
type Decision = 'approve' | 'reject' | 'cancel'
const statusLabel = { PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' }

export default function DoctorTimeOffPanel({ providerId }: { providerId: string }) {
  const pathname = usePathname(), scope = useSyncExternalStore(subscribe, readScope, () => null)
  if (!timeOffReference(providerId)) return null
  return <TimeOffView key={JSON.stringify([pathname, scope, providerId])} providerId={providerId} scope={scope} pathname={pathname} />
}

function TimeOffView({ providerId, scope, pathname }: { providerId: string; scope: string | null; pathname: string }) {
  const id = useId(), captureAction = usePortalAction()
  const [open, setOpen] = useState(false), [page, setPage] = useState({ offset: 0, status: '' })
  const [draft, setDraft] = useState({ start: '', end: '', reason: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState(''), [failure, setFailure] = useState(''), [reference, setReference] = useState<string | null>(null)
  const [reconcile, setReconcile] = useState(false), [savingContext, setSavingContext] = useState<object | null>(null)
  const [choice, setChoice] = useState<{ context: object; record: TimeOff; decision: Decision } | null>(null)
  const [decisionReason, setDecisionReason] = useState(''), [confirmed, setConfirmed] = useState(false)
  const resource = usePortalResource<unknown>(open && scope ? timeOffPath(providerId, page.offset, page.status) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => timeOffPage(resource.data, providerId), [resource.data, providerId])
  const invalid = resource.data !== null && !data
  if (data && data.records.length === 0 && page.offset > 0 && page.offset >= data.total) setPage({ ...page, offset: data.total ? Math.floor((data.total - 1) / TIME_OFF_PAGE_SIZE) * TIME_OFF_PAGE_SIZE : 0 })
  const context = useMemo(() => ({ scope, pathname, providerId, page, permission: data?.canManage ?? null, data }), [scope, pathname, providerId, page, data])
  if (savingContext && savingContext !== context) {
    setSavingContext(null); setReconcile(true); setChoice(null); setReference(null)
    setFailure('The absence list changed while the request was in progress. Review its current state before continuing.')
  }
  const latest = useRef(context), inFlight = useRef<AbortController | null>(null), changingPage = useRef(false)
  useLayoutEffect(() => {
    latest.current = context; changingPage.current = false
    return () => { inFlight.current?.abort(); inFlight.current = null }
  }, [context])
  const activeChoice = choice?.context === context ? choice : null
  const saving = savingContext === context, busy = resource.refreshing || saving
  const current = () => Boolean(scope && scope === readScope() && currentPortal() === 'admin' && window.location.pathname === pathname && latest.current === context)
  const mayWrite = () => current() && !busy && !inFlight.current && !changingPage.current && !reconcile && data?.canManage === true && !invalid
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your browser timezone'
  const preview = absenceRequest(draft.start, draft.end, draft.reason)
  const refresh = () => { if (current() && !inFlight.current && !changingPage.current) resource.retry() }
  const navigate = (offset: number, status = page.status) => {
    if (!current() || busy || inFlight.current || changingPage.current) return
    changingPage.current = true; setChoice(null); setErrors({}); setNotice(''); setPage({ offset, status })
  }
  const choose = (record: TimeOff, decision: Decision) => {
    if (!mayWrite() || !data?.records.some(row => row.id === record.id && row.status === record.status)) return
    setChoice({ context, record, decision }); setDecisionReason(''); setConfirmed(false); setErrors({}); setFailure(''); setReference(null)
  }

  async function mutate(kind: 'create' | Decision, record?: TimeOff) {
    if (!mayWrite()) return
    const captured = captureAction(), controller = new AbortController()
    inFlight.current = controller; setSavingContext(context); setFailure(''); setReference(null); setNotice('')
    const stillCurrent = () => captured.isCurrent() && latest.current === context && !controller.signal.aborted
    try {
      const raw = kind === 'create'
        ? await apiPost<unknown>(`/api/v1/admin/doctors/${encodeURIComponent(providerId)}/time-off`, preview.payload, undefined, controller.signal)
        : await apiPut<unknown>(`/api/v1/admin/time-off/${encodeURIComponent(record!.id)}/${kind}`, kind === 'approve' ? {} : { reason: decisionReason.trim() || null }, undefined, controller.signal)
      if (!stillCurrent()) return
      const receipt = timeOffRecord(raw, providerId), expected = { create: 'PENDING', approve: 'APPROVED', reject: 'REJECTED', cancel: 'CANCELLED' }[kind]
      if (!receipt || receipt.status !== expected || (record && receipt.id !== record.id) ||
        (kind === 'create' && (!preview.payload || Date.parse(receipt.start) !== Date.parse(preview.payload.start_datetime) || Date.parse(receipt.end) !== Date.parse(preview.payload.end_datetime)))) throw new Error('The saved absence could not be confirmed. Review the refreshed list before continuing.')
      if (kind === 'create') setDraft({ start: '', end: '', reason: '' })
      setNotice(kind === 'create' ? 'The absence request is saved and pending approval.' : kind === 'cancel' ? 'The absence is cancelled. Normal working hours may be bookable again; existing appointments were not cancelled.' : `The absence is ${expected.toLowerCase()}. Existing appointments were not cancelled.`)
      setReconcile(false)
    } catch (error) {
      if (!stillCurrent()) return
      setFailure(getApiErrorDetail(error) || 'The operation could not be confirmed. Review the refreshed list before continuing.')
      setReference(getApiErrorRequestId(error)); setReconcile(true)
    } finally {
      if (stillCurrent()) { setSavingContext(null); setChoice(null); setErrors({}); resource.retry() }
      if (inFlight.current === controller) inFlight.current = null
    }
  }

  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!mayWrite()) return
    setErrors(preview.errors)
    if (!preview.payload) { focusValidation(event.currentTarget); return }
    void mutate('create')
  }
  const decide = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!mayWrite() || !activeChoice) return
    const row = data?.records.find(item => item.id === activeChoice.record.id)
    if (!row || row.status !== activeChoice.record.status || (activeChoice.decision !== 'cancel' && row.status !== 'PENDING') || (activeChoice.decision === 'cancel' && !['PENDING', 'APPROVED'].includes(row.status))) return
    const next: Record<string, string> = {}
    if (decisionReason.trim().length > 500 || (activeChoice.decision === 'cancel' && decisionReason.trim().length < 4)) next.decision = 'Enter a cancellation reason using 4–500 characters.'
    if (!confirmed) next.confirm = 'Confirm that you have reviewed this absence and its effect on availability.'
    setErrors(next)
    if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void mutate(activeChoice.decision, row)
  }

  return <section aria-labelledby={`${id}-title`} className='mt-6 min-w-0 border-t border-theme pt-5'>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div><h3 id={`${id}-title`} className='text-lg font-semibold text-ink'>Clinician absences</h3><p className='mt-2 text-sm leading-6 text-secondary'>Approved absences remove bookable times. Existing appointments require separate resolution.</p></div>
      <button type='button' className='q-button q-button-secondary' aria-expanded={open} aria-controls={`${id}-content`} disabled={saving} onClick={() => { if (!inFlight.current) setOpen(value => !value) }}>{open ? 'Hide clinician absences' : 'Show clinician absences'}</button>
    </div>
    {open && <div id={`${id}-content`} aria-busy={busy} className='mt-4 min-w-0 space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='min-w-0 text-sm font-medium text-ink'>Absence status<select value={page.status} disabled={busy} onChange={event => navigate(0, event.target.value)} className='mt-1 block min-h-11 w-full rounded-lg border border-theme bg-surface px-3 text-ink'><option value=''>All absence statuses</option>{TIME_OFF_STATUSES.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
        <button type='button' className='q-button q-button-secondary' disabled={saving || resource.refreshing} onClick={refresh}>Refresh absences</button>
      </div>
      {resource.refreshing && <p aria-live='polite' className='text-sm text-secondary'>Loading absences…</p>}
      {(resource.error || invalid) && <div role='alert' className='rounded-lg border border-theme bg-surface-subtle p-3 text-sm text-ink'><p>{invalid ? 'The absence response could not be validated. Refresh absences to try again.' : resource.errorMessage}</p><SupportReference requestId={resource.errorRequestId} /></div>}
      {failure && <div role='alert' className='rounded-lg border border-theme bg-surface-subtle p-3 text-sm text-ink'><p>{failure}</p><SupportReference requestId={reference} /></div>}
      {notice && <p aria-live='polite' className='text-sm leading-6 text-ink'>{notice}</p>}
      {reconcile && <div className='rounded-lg border border-theme bg-surface-subtle p-3 text-sm text-ink'><p>Review the refreshed absence list before choosing another action. No automatic retry was made.</p><button type='button' className='q-button q-button-secondary mt-3' disabled={busy || !data || resource.error || invalid} onClick={() => { if (current() && !inFlight.current) { setReconcile(false); setFailure(''); setReference(null) } }}>Continue after reviewing absences</button></div>}
      {data && !invalid && <>
        {!resource.refreshing && !data.records.length && <p className='text-sm text-secondary'>No absences match this filter.</p>}
        <div className='space-y-3'>{data.records.map(record => <article key={record.id} aria-label={`Absence ${record.id}`} className='min-w-0 rounded-xl border border-theme bg-surface-subtle p-4'>
          <p className='text-sm font-semibold text-ink'>{statusLabel[record.status]}</p>
          <p className='mt-2 break-words text-sm leading-6 text-secondary'><time dateTime={record.start}>{new Date(record.start).toLocaleString(undefined, { timeZoneName: 'short' })}</time> — <time dateTime={record.end}>{new Date(record.end).toLocaleString(undefined, { timeZoneName: 'short' })}</time></p>
          {record.reason && <p className='mt-2 break-words text-sm text-secondary'>{record.reason}</p>}
          {data.canManage && <div className='mt-3 flex flex-wrap gap-2'>
            {record.status === 'PENDING' && <><button type='button' className='q-button q-button-secondary' disabled={busy || reconcile} onClick={() => choose(record, 'approve')}>Approve absence</button><button type='button' className='q-button q-button-secondary' disabled={busy || reconcile} onClick={() => choose(record, 'reject')}>Reject absence</button></>}
            {['PENDING', 'APPROVED'].includes(record.status) && <button type='button' className='q-button q-button-secondary' disabled={busy || reconcile} onClick={() => choose(record, 'cancel')}>Cancel absence</button>}
          </div>}
        </article>)}</div>
        <nav aria-label='Absence pages' className='flex flex-wrap items-center gap-3'><p aria-live='polite' className='text-sm text-secondary'>Page {Math.floor(page.offset / TIME_OFF_PAGE_SIZE) + 1} · {data.total} {data.total === 1 ? 'absence' : 'absences'}</p><button type='button' className='q-button q-button-secondary' disabled={busy || page.offset === 0} onClick={() => navigate(Math.max(0, page.offset - TIME_OFF_PAGE_SIZE))}>Previous absences</button><button type='button' className='q-button q-button-secondary' disabled={busy || page.offset + data.limit >= data.total} onClick={() => navigate(page.offset + TIME_OFF_PAGE_SIZE)}>Next absences</button></nav>
        {!data.canManage && <p className='text-sm leading-6 text-secondary'>Operations administrator access is required to request or decide an absence. You can view the records here.</p>}
      </>}
      {data?.canManage && !invalid && !reconcile && <>
        {activeChoice && <form noValidate onSubmit={decide} className='rounded-xl border border-theme bg-surface-subtle p-4'>
          <h4 className='font-semibold text-ink'>{activeChoice.decision === 'cancel' ? 'Cancel this absence' : activeChoice.decision === 'approve' ? 'Approve this absence' : 'Reject this absence'}</h4>
          <p className='mt-2 text-sm leading-6 text-secondary'>{activeChoice.decision === 'cancel' ? 'Cancelling restores normal working-hour availability. It does not cancel appointments.' : activeChoice.decision === 'approve' ? 'Approval blocks new overlapping bookings. Conflicting existing appointments must be resolved separately.' : 'A rejected request does not block booking.'}</p>
          <ValidationSummary errors={errors} />
          {activeChoice.decision !== 'approve' && <label className='mt-3 block text-sm text-ink'>Reason ({activeChoice.decision === 'cancel' ? 'Required' : 'Optional'})<textarea value={decisionReason} maxLength={500} disabled={saving} onChange={event => setDecisionReason(event.target.value)} aria-invalid={Boolean(errors.decision)} aria-describedby={errors.decision ? `${id}-decision-error` : undefined} className='mt-1 block w-full rounded-lg border border-theme bg-surface p-3 text-ink' /><FieldFeedback name={`${id}-decision`} error={errors.decision} /></label>}
          <label className='mt-3 flex items-start gap-3 text-sm leading-6 text-ink'><input type='checkbox' checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? `${id}-confirm-error` : undefined} className='mt-1 h-4 w-4 shrink-0' />I have reviewed this absence and its effect on availability (Required)</label><FieldFeedback name={`${id}-confirm`} error={errors.confirm} />
          <div className='mt-4 flex flex-wrap gap-2'><button type='submit' className='q-button q-button-primary' disabled={saving || resource.refreshing}>{saving ? 'Saving absence…' : 'Confirm absence decision'}</button><button type='button' className='q-button q-button-secondary' disabled={saving} onClick={() => { setChoice(null); setErrors({}) }}>Keep current absence</button></div>
        </form>}
        {!activeChoice && <form noValidate onSubmit={create} className='rounded-xl border border-theme p-4'>
          <h4 className='font-semibold text-ink'>Request an absence</h4><p className='mt-2 text-sm leading-6 text-secondary'>Times use {timezone}. Approval is a separate step. Do not include patient information in the reason.</p>
          <ValidationSummary errors={errors} />
          <div className='mt-4 grid min-w-0 gap-4 sm:grid-cols-2'>{(['start', 'end'] as const).map(field => <label key={field} className='min-w-0 text-sm text-ink'>{field === 'start' ? 'Absence starts' : 'Absence ends'} (Required)<input type='datetime-local' step={60} value={draft[field]} disabled={saving} onChange={event => { setDraft({ ...draft, [field]: event.target.value }); setErrors({}) }} aria-invalid={Boolean(errors[field])} aria-describedby={`${id}-${field}-hint${errors[field] ? ` ${id}-${field}-error` : ''}`} className='mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-theme bg-surface px-3 text-ink' /><FieldFeedback name={`${id}-${field}`} hint={`Local date and time in ${timezone}.`} error={errors[field]} /></label>)}</div>
          <label className='mt-4 block text-sm text-ink'>Absence reason (Optional)<textarea value={draft.reason} maxLength={500} disabled={saving} onChange={event => { setDraft({ ...draft, reason: event.target.value }); setErrors({}) }} aria-invalid={Boolean(errors.reason)} aria-describedby={`${id}-reason-hint${errors.reason ? ` ${id}-reason-error` : ''}`} className='mt-1 block w-full rounded-lg border border-theme bg-surface p-3 text-ink' /><FieldFeedback name={`${id}-reason`} hint='Up to 500 characters; no patient information.' error={errors.reason} /></label>
          {preview.payload && <p className='mt-3 break-words text-xs leading-5 text-secondary'>UTC interval: {preview.payload.start_datetime} — {preview.payload.end_datetime}</p>}
          <button type='submit' className='q-button q-button-primary mt-4' disabled={saving || resource.refreshing}>{saving ? 'Saving absence…' : 'Save absence request'}</button>
        </form>}
      </>}
    </div>}
  </section>
}

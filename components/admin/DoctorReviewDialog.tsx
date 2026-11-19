'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { clinicianIdentifier, clinicianRow } from '@/lib/admin-clinicians'
import { getApiErrorDetail, getApiErrorRequestId, verifyDoctor, updateDoctorStatus, type AdminDoctorVerification } from '@/lib/api'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
import SupportReference from '@/components/ui/SupportReference'
import DoctorTimeOffPanel from '@/components/admin/DoctorTimeOffPanel'

type Decision = 'approve' | 'reject' | 'suspend' | 'activate'
type Props = { providerId: string; onClose: () => void; onSaved: () => void }
const readScope = () => readAccountScope('admin')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
const emptyForm = () => ({ decision: 'approve' as Decision, reference: '', confirmed: false, errors: {} as Record<string, string> })

export default function DoctorReviewDialog(props: Props) {
  const pathname = usePathname(), scope = useSyncExternalStore(subscribe, readScope, () => null)
  return <ScopedReview key={JSON.stringify([scope, pathname, props.providerId])} {...props} scope={scope} pathname={pathname} />
}

function ScopedReview({ providerId, onClose, onSaved, scope, pathname }: Props & { scope: string | null; pathname: string }) {
  const dialog = useRef<HTMLDialogElement>(null), captureAction = usePortalAction(), inFlight = useRef<AbortController | null>(null)
  const resource = usePortalResource<unknown>(scope && clinicianIdentifier(providerId) ? `/api/v1/admin/doctors/${encodeURIComponent(providerId)}/verification` : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const details = useMemo(() => { const parsed = clinicianRow(resource.data); return parsed?.provider_id === providerId ? parsed as AdminDoctorVerification : null }, [resource.data, providerId])
  const authorityKey = JSON.stringify([scope, pathname, providerId, details?.can_review === true, details?.status, details?.verification_status, details?.email_verified, details?.license_number])
  const authority = useRef(authorityKey)
  const [observed, setObserved] = useState(authorityKey), [form, setForm] = useState(emptyForm)
  const [action, setAction] = useState<{ authority: string; busy: boolean; error: string; reference: string | null } | null>(null)
  if (observed !== authorityKey) { setObserved(authorityKey); setForm(emptyForm()) }
  const saving = action?.authority === authorityKey && action.busy
  const stalePending = action?.busy && action.authority !== authorityKey
  const busy = saving || resource.refreshing
  const loadError = resource.error ? resource.errorMessage : resource.data !== null && !details ? 'The clinician details returned an invalid response. Refresh before making a decision.' : ''
  const currentPage = () => Boolean(scope && scope === readScope() && currentPortal() === 'admin' && window.location.pathname === pathname)
  useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close() }, [])
  useLayoutEffect(() => { authority.current = authorityKey; return () => { inFlight.current?.abort(); inFlight.current = null } }, [authorityKey])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentPage() || busy || inFlight.current || !details || details.can_review !== true) return
    const errors: Record<string, string> = {}, reference = form.reference.trim(), decision = form.decision
    if (reference.length < 4 || reference.length > 500) errors.reference = 'Enter a review reference or reason using 4–500 characters.'
    if (decision === 'approve' && !form.confirmed) errors.confirmed = 'Confirm that you have reviewed the clinician’s identity and professional credentials.'
    if (decision === 'approve' && !details.email_verified) errors.email = 'The clinician must verify their email before approval.'
    setForm(previous => ({ ...previous, errors }))
    if (Object.keys(errors).length) { focusValidation(event.currentTarget); return }
    const captured = captureAction(), controller = new AbortController()
    if (!captured.isCurrent() || captured.portal !== 'admin' || captured.scope !== scope) return
    inFlight.current = controller; setAction({ authority: authorityKey, busy: true, error: '', reference: null })
    const current = () => captured.isCurrent() && currentPage() && authority.current === authorityKey && !controller.signal.aborted
    try {
      if (decision === 'approve' || decision === 'reject') await verifyDoctor(providerId, { approve: decision === 'approve', review_confirmed: form.confirmed, review_reference: reference, rejection_reason: reference }, controller.signal)
      else await updateDoctorStatus(providerId, { status: decision === 'suspend' ? 'SUSPENDED' : 'ACTIVE', reason: reference }, controller.signal)
      if (current()) onSaved()
    } catch (error) {
      if (!current()) return
      setAction({ authority: authorityKey, busy: false, error: getApiErrorDetail(error) || 'The decision could not be confirmed. Review the refreshed clinician details before trying again.', reference: getApiErrorRequestId(error) })
      setForm(previous => ({ ...previous, confirmed: false })); resource.retry()
    } finally {
      if (current()) setAction(previous => previous ? { ...previous, busy: false } : previous)
      if (inFlight.current === controller) inFlight.current = null
    }
  }
  return <dialog ref={dialog} aria-labelledby='doctor-review-title' onCancel={event => { event.preventDefault(); if (!saving && currentPage()) onClose() }}
    className='max-h-[85dvh] w-[min(680px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-theme bg-surface p-5 text-ink shadow-xl sm:p-7'>
    <style>{`dialog::backdrop{background:var(--overlay,rgba(4,20,35,.65))}.doctor-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:16px}.doctor-review-grid dt{color:var(--text-muted);font-size:13px}.doctor-review-grid dd{margin:4px 0 0;overflow-wrap:anywhere}`}</style>
    <header className='flex flex-wrap items-center justify-between gap-4'><h2 id='doctor-review-title' className='text-xl font-semibold text-ink'>Clinician review</h2><PortalButton type='button' disabled={saving} onClick={() => { if (currentPage()) onClose() }} aria-label='Close clinician review'>Close</PortalButton></header>
    {loadError ? <div role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6'><p>{loadError}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>Try again</PortalButton></div>
      : !details ? <p role='status' className='mt-5 text-sm text-secondary'>Loading clinician details…</p> : <>
        <dl className='doctor-review-grid mt-6'>
          <div><dt>Name</dt><dd>{details.full_name}</dd></div><div><dt>Email</dt><dd>{details.email}</dd></div>
          <div><dt>Email verification</dt><dd>{details.email_verified ? 'Verified' : 'Pending'}</dd></div><div><dt>Professional licence</dt><dd>{details.license_number || 'Not provided'}</dd></div>
          <div><dt>Specialty</dt><dd>{details.specialty || 'Not provided'}</dd></div><div><dt>Clinical approval</dt><dd>{details.verification_status.replaceAll('_', ' ')}</dd></div>
          <div><dt>Account status</dt><dd>{details.status.replaceAll('_', ' ')}</dd></div><div><dt>Clinical access</dt><dd>{details.clinical_access?.status === 'enabled' ? 'Enabled' : details.clinical_access?.status === 'blocked' ? 'Blocked' : 'Not assessed'}</dd></div>
        </dl>
        {details.clinical_access && <p className='mt-4 text-sm leading-7 text-secondary'>{details.clinical_access.message}</p>}
        <p className='my-5 text-sm leading-7 text-secondary'>Email verification does not verify a medical licence. Review the clinician’s identity and credentials through your approved process before granting clinical access. Record the evidence reference below; do not paste patient information.</p>
        <DoctorTimeOffPanel providerId={providerId} />
        {action?.error && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6'><p>{action.error}</p><p className='mt-2'>No decision is retried automatically. Review the current details before submitting again.</p><SupportReference requestId={action.reference} /></div>}
        {stalePending && <p role='alert' className='my-4 text-sm leading-6 text-secondary'>Clinician details changed while a decision was in flight. Review the current status; the earlier outcome could not be confirmed here.</p>}
        {resource.refreshing && <p role='status' className='my-4 text-sm text-secondary'>Refreshing clinician details…</p>}
        {details.can_review !== true ? <p role='status' className='mt-5 text-sm leading-7 text-secondary'>Super administrator or operations administrator access is required to record a decision. You can review the clinician details here.</p> : <form noValidate onSubmit={submit} aria-busy={busy} className='mt-5'>
          <ValidationSummary errors={form.errors} />
          <label htmlFor='review-decision' className='mb-2 block text-sm font-semibold'>Decision (Required)</label>
          <select id='review-decision' value={form.decision} disabled={busy} onChange={event => setForm(previous => ({ ...previous, decision: event.target.value as Decision, errors: {} }))} className='mb-5 min-h-11 w-full rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink'>
            <option value='approve'>Approve clinical access</option><option value='reject'>Reject application</option><option value='suspend'>Suspend account</option><option value='activate'>Restore account status</option></select>
          {form.decision === 'activate' && <p className='mb-4 text-sm leading-6 text-secondary'>Restoring account status does not grant or replace clinical approval.</p>}
          <label htmlFor='review-reference' className='mb-2 block text-sm font-semibold'>Review reference or reason (Required)</label>
          <textarea id='review-reference' value={form.reference} disabled={busy} maxLength={500} rows={3} aria-invalid={!!form.errors.reference} aria-describedby='review-reference-hint review-reference-error' onChange={event => setForm(previous => ({ ...previous, reference: event.target.value, errors: { ...previous.errors, reference: '' } }))} className='min-h-28 w-full rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink' />
          <FieldFeedback name='review-reference' hint='4–500 characters. Use a credential-review reference or an operational reason.' error={form.errors.reference} />
          {form.decision === 'approve' && <div className='my-5'><label className='flex items-start gap-3 text-sm leading-7'><input type='checkbox' checked={form.confirmed} disabled={busy} aria-invalid={!!form.errors.confirmed} aria-describedby={form.errors.confirmed ? 'review-confirmed-error' : undefined} onChange={event => setForm(previous => ({ ...previous, confirmed: event.target.checked, errors: { ...previous.errors, confirmed: '' } }))} className='mt-1 h-5 w-5 shrink-0' />I have reviewed the clinician’s identity and professional credentials (Required)</label><FieldFeedback name='review-confirmed' error={form.errors.confirmed} /></div>}
          <PortalButton type='submit' tone='primary' disabled={busy}>{saving ? 'Saving decision…' : 'Save decision'}</PortalButton>
        </form>}
      </>}
  </dialog>
}

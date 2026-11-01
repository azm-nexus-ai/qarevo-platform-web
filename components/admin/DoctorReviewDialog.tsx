'use client'

import { useEffect, useRef, useState } from 'react'
import { getDoctorVerificationDetails, getApiErrorDetail, verifyDoctor, updateDoctorStatus, type AdminDoctorVerification } from '@/lib/api'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'

type Decision = 'approve' | 'reject' | 'suspend' | 'activate'

export default function DoctorReviewDialog({ providerId, onClose, onSaved }: {
  providerId: string; onClose: () => void; onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [details, setDetails] = useState<AdminDoctorVerification | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [decision, setDecision] = useState<Decision>('approve')
  const [reference, setReference] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close() }, [])
  useEffect(() => {
    let current = true
    setLoadError('')
    getDoctorVerificationDetails(providerId).then(value => {
      if (current) setDetails(value)
    }).catch(error => { if (current) setLoadError(getApiErrorDetail(error) || 'Could not load clinician details.') })
    return () => { current = false }
  }, [providerId, retry])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (reference.trim().length < 4 || reference.trim().length > 500) next.reference = 'Enter a review reference or reason using 4–500 characters.'
    if (decision === 'approve' && !confirmed) next.confirmed = 'Confirm that you have reviewed the clinician’s identity and professional credentials.'
    if (decision === 'approve' && !details?.email_verified) next.email = 'The clinician must verify their email before approval.'
    setErrors(next)
    if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    setSaving(true); setSaveError('')
    try {
      if (decision === 'approve' || decision === 'reject') {
        await verifyDoctor(providerId, { approve: decision === 'approve', review_confirmed: confirmed,
          review_reference: reference.trim(), rejection_reason: reference.trim() })
      } else {
        await updateDoctorStatus(providerId, { status: decision === 'suspend' ? 'SUSPENDED' : 'ACTIVE', reason: reference.trim() })
      }
      onSaved()
    } catch (error) { setSaveError(getApiErrorDetail(error) || 'The decision could not be saved. Please try again.') }
    finally { setSaving(false) }
  }

  return <dialog ref={dialog} aria-labelledby="doctor-review-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
    style={{ width: 'min(620px, calc(100vw - 32px))', maxHeight: '85dvh', overflowY: 'auto', padding: 28, borderRadius: 20,
      border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}>
    <style>{`dialog::backdrop { background: rgba(4,20,35,.65); } .doctor-review-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:16px; } .doctor-review-grid dt { color:var(--text-muted); font-size:13px; } .doctor-review-grid dd { margin:4px 0 0; overflow-wrap:anywhere; }`}</style>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
      <h2 id="doctor-review-title" style={{ margin: 0 }}>Clinician review</h2>
      <button type="button" disabled={saving} onClick={onClose} aria-label="Close clinician review">Close</button>
    </header>
    {loadError ? <div role="alert"><p>{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : !details ? <p role="status">Loading clinician details…</p>
      : <>
        <dl className="doctor-review-grid">
          <div><dt>Name</dt><dd>{details.full_name}</dd></div>
          <div><dt>Email</dt><dd>{details.email}</dd></div>
          <div><dt>Email verification</dt><dd>{details.email_verified ? 'Verified' : 'Pending'}</dd></div>
          <div><dt>Professional licence</dt><dd>{details.license_number || 'Not provided'}</dd></div>
          <div><dt>Specialty</dt><dd>{details.specialty || 'Not provided'}</dd></div>
          <div><dt>Clinical approval</dt><dd>{details.verification_status.replaceAll('_', ' ')}</dd></div>
          <div><dt>Account status</dt><dd>{details.status.replaceAll('_', ' ')}</dd></div>
        </dl>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>Email verification does not verify a medical licence. Review the clinician’s identity and credentials through your approved process before granting clinical access. Record the evidence reference below; do not paste patient information.</p>
        <form noValidate onSubmit={submit}>
          <ValidationSummary errors={errors} />
          {saveError && <p role="alert" className="field-error">{saveError}</p>}
          <label htmlFor="review-decision">Decision (Required)</label>
          <select id="review-decision" value={decision} disabled={saving} onChange={event => { setDecision(event.target.value as Decision); setErrors({}) }} style={{ display: 'block', width: '100%', margin: '8px 0 18px', padding: 12 }}>
            <option value="approve">Approve clinical access</option><option value="reject">Reject application</option>
            <option value="suspend">Suspend account</option><option value="activate">Restore account status</option>
          </select>
          {decision === 'activate' && <p>Restoring account status does not grant or replace clinical approval.</p>}
          <label htmlFor="review-reference">Review reference or reason (Required)</label>
          <textarea id="review-reference" value={reference} disabled={saving} maxLength={500} rows={3} aria-invalid={!!errors.reference} aria-describedby="review-reference-hint review-reference-error"
            onChange={event => { setReference(event.target.value); setErrors(previous => ({ ...previous, reference: '' })) }} style={{ display: 'block', width: '100%', marginTop: 8, padding: 12 }} />
          <FieldFeedback name="review-reference" hint="4–500 characters. Use a credential-review reference or an operational reason." error={errors.reference} />
          {decision === 'approve' && <div style={{ margin: '18px 0' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'start' }}><input type="checkbox" checked={confirmed} disabled={saving} aria-invalid={!!errors.confirmed} aria-describedby={errors.confirmed ? 'review-confirmed-error' : undefined}
              onChange={event => { setConfirmed(event.target.checked); setErrors(previous => ({ ...previous, confirmed: '' })) }} />I have reviewed the clinician’s identity and professional credentials (Required)</label>
            <FieldFeedback name="review-confirmed" error={errors.confirmed} />
          </div>}
          <button type="submit" disabled={saving} style={{ marginTop: 16, padding: '12px 18px', borderRadius: 10, border: 0, background: 'var(--primary)', color: '#fff', fontWeight: 650 }}>{saving ? 'Saving decision…' : 'Save decision'}</button>
        </form>
      </>}
  </dialog>
}

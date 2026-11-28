'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

const codeKey = (code: string) => code.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

function ScopedReview({ providerId, onClose, onSaved, scope, pathname }: Props & { scope: string | null; pathname: string }) {
  const t = useTranslations('doctorReview')
  const code = (group: string, value: string) => t.has(`${group}.${codeKey(value)}`) ? t(`${group}.${codeKey(value)}`) : value.replaceAll('_', ' ')
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
  const loadError = resource.error ? resource.errorMessage : resource.data !== null && !details ? t('invalid') : ''
  const currentPage = () => Boolean(scope && scope === readScope() && currentPortal() === 'admin' && window.location.pathname === pathname)
  useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close() }, [])
  useLayoutEffect(() => { authority.current = authorityKey; return () => { inFlight.current?.abort(); inFlight.current = null } }, [authorityKey])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentPage() || busy || inFlight.current || !details || details.can_review !== true) return
    const errors: Record<string, string> = {}, reference = form.reference.trim(), decision = form.decision
    if (reference.length < 4 || reference.length > 500) errors.reference = t('errReference')
    if (decision === 'approve' && !form.confirmed) errors.confirmed = t('errConfirmed')
    if (decision === 'approve' && !details.email_verified) errors.email = t('errEmail')
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
      setAction({ authority: authorityKey, busy: false, error: getApiErrorDetail(error) || t('decisionFailed'), reference: getApiErrorRequestId(error) })
      setForm(previous => ({ ...previous, confirmed: false })); resource.retry()
    } finally {
      if (current()) setAction(previous => previous ? { ...previous, busy: false } : previous)
      if (inFlight.current === controller) inFlight.current = null
    }
  }
  return <dialog ref={dialog} aria-labelledby='doctor-review-title' onCancel={event => { event.preventDefault(); if (!saving && currentPage()) onClose() }}
    className='max-h-[85dvh] w-[min(680px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-theme bg-surface p-5 text-ink shadow-xl sm:p-7'>
    <style>{`dialog::backdrop{background:var(--overlay,rgba(4,20,35,.65))}.doctor-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:16px}.doctor-review-grid dt{color:var(--text-muted);font-size:13px}.doctor-review-grid dd{margin:4px 0 0;overflow-wrap:anywhere}`}</style>
    <header className='flex flex-wrap items-center justify-between gap-4'><h2 id='doctor-review-title' className='text-xl font-semibold text-ink'>{t('title')}</h2><PortalButton type='button' disabled={saving} onClick={() => { if (currentPage()) onClose() }} aria-label={t('closeLabel')}>{t('close')}</PortalButton></header>
    {loadError ? <div role='alert' className='mt-5 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6'><p>{loadError}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>{t('tryAgain')}</PortalButton></div>
      : !details ? <p role='status' className='mt-5 text-sm text-secondary'>{t('loading')}</p> : <>
        <dl className='doctor-review-grid mt-6'>
          <div><dt>{t('name')}</dt><dd>{details.full_name}</dd></div><div><dt>{t('email')}</dt><dd>{details.email}</dd></div>
          <div><dt>{t('emailVerification')}</dt><dd>{details.email_verified ? t('verified') : t('pending')}</dd></div><div><dt>{t('licence')}</dt><dd>{details.license_number || t('notProvided')}</dd></div>
          <div><dt>{t('specialty')}</dt><dd>{details.specialty || t('notProvided')}</dd></div><div><dt>{t('approval')}</dt><dd>{code('verificationStatus', details.verification_status)}</dd></div>
          <div><dt>{t('accountStatus')}</dt><dd>{code('accountStatusLabel', details.status)}</dd></div><div><dt>{t('access')}</dt><dd>{details.clinical_access?.status === 'enabled' ? t('accessEnabled') : details.clinical_access?.status === 'blocked' ? t('accessBlocked') : t('accessNotAssessed')}</dd></div>
        </dl>
        {details.clinical_access && <p className='mt-4 text-sm leading-7 text-secondary'>{details.clinical_access.message}</p>}
        <p className='my-5 text-sm leading-7 text-secondary'>{t('guidance')}</p>
        <DoctorTimeOffPanel providerId={providerId} />
        {action?.error && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6'><p>{action.error}</p><p className='mt-2'>{t('noAutoRetry')}</p><SupportReference requestId={action.reference} /></div>}
        {stalePending && <p role='alert' className='my-4 text-sm leading-6 text-secondary'>{t('stale')}</p>}
        {resource.refreshing && <p role='status' className='my-4 text-sm text-secondary'>{t('refreshing')}</p>}
        {details.can_review !== true ? <p role='status' className='mt-5 text-sm leading-7 text-secondary'>{t('readOnly')}</p> : <form noValidate onSubmit={submit} aria-busy={busy} className='mt-5'>
          <ValidationSummary errors={form.errors} />
          <label htmlFor='review-decision' className='mb-2 block text-sm font-semibold'>{t('decision')}</label>
          <select id='review-decision' value={form.decision} disabled={busy} onChange={event => setForm(previous => ({ ...previous, decision: event.target.value as Decision, errors: {} }))} className='mb-5 min-h-11 w-full rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink'>
            <option value='approve'>{t('optApprove')}</option><option value='reject'>{t('optReject')}</option><option value='suspend'>{t('optSuspend')}</option><option value='activate'>{t('optActivate')}</option></select>
          {form.decision === 'activate' && <p className='mb-4 text-sm leading-6 text-secondary'>{t('activateNote')}</p>}
          <label htmlFor='review-reference' className='mb-2 block text-sm font-semibold'>{t('referenceLabel')}</label>
          <textarea id='review-reference' value={form.reference} disabled={busy} maxLength={500} rows={3} aria-invalid={!!form.errors.reference} aria-describedby='review-reference-hint review-reference-error' onChange={event => setForm(previous => ({ ...previous, reference: event.target.value, errors: { ...previous.errors, reference: '' } }))} className='min-h-28 w-full rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink' />
          <FieldFeedback name='review-reference' hint={t('referenceHint')} error={form.errors.reference} />
          {form.decision === 'approve' && <div className='my-5'><label className='flex items-start gap-3 text-sm leading-7'><input type='checkbox' checked={form.confirmed} disabled={busy} aria-invalid={!!form.errors.confirmed} aria-describedby={form.errors.confirmed ? 'review-confirmed-error' : undefined} onChange={event => setForm(previous => ({ ...previous, confirmed: event.target.checked, errors: { ...previous.errors, confirmed: '' } }))} className='mt-1 h-5 w-5 shrink-0' />{t('confirmLabel')}</label><FieldFeedback name='review-confirmed' error={form.errors.confirmed} /></div>}
          <PortalButton type='submit' tone='primary' disabled={busy}>{saving ? t('saving') : t('save')}</PortalButton>
        </form>}
      </>}
  </dialog>
}

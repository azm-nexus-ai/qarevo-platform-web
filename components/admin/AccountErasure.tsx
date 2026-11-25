'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl, uuid } from '@/lib/practice'
import { formatBerlin, reasonProblem } from '@/lib/admin-accounts'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback } from '@/components/practice/PracticeShared'

const BASE = '/api/v1/admin/account-erasure'
type Due = { user_id: string; role: 'patient' | 'doctor'; requested_at: string | null; erase_contact_data_after: string; fields_to_erase: string[] }
type Plan = { erasure_enabled: boolean; due: Due[]; due_count: number; waiting_count: number; retained: string[]; pending_input: string }

function plan(value: unknown): Plan | null {
  if (!object(value) || value.dry_run !== true || typeof value.erasure_enabled !== 'boolean' || !Array.isArray(value.due) || !Array.isArray(value.retained) ||
    typeof value.due_count !== 'number' || typeof value.waiting_count !== 'number' || value.due.length !== value.due_count) return null
  const due = value.due.every(item => object(item) && uuid(item.user_id) && ['patient', 'doctor'].includes(String(item.role)) &&
    typeof item.erase_contact_data_after === 'string' && Array.isArray(item.fields_to_erase) && item.fields_to_erase.every(field => typeof field === 'string'))
  return due && value.retained.every(item => typeof item === 'string') ? value as unknown as Plan : null
}

/** Stored field names map to adminErasure.field message keys. */
const FIELD_KEYS: Record<string, string> = {
  'user.email': 'email', 'user.phone': 'phone', 'user.country_code': 'phoneCountry', 'user.password_hash': 'password', 'user.email_verified': 'emailConfirmation',
  'user.phone_verified': 'phoneConfirmation', 'patient.preferred_name': 'preferredName', 'patient.nationality': 'nationality', 'patient.marital_status': 'maritalStatus',
  'patient.profile_image': 'profilePhoto',
}
function useErasureText() {
  const t = useTranslations('adminErasure'), locale = useLocale().startsWith('de') ? 'de-DE' : 'en-GB'
  const fieldLabel = (field: string) => FIELD_KEYS[field] ? t(`field.${FIELD_KEYS[field]}`) : field.startsWith('patient.') ? t('field.communication') : field.replace(/^\w+\./, '').replace(/_/g, ' ')
  const summary = (fields: string[]) => [...new Set(fields.map(fieldLabel))].join(', ') || t('nothingLeft')
  return { t, summary, date: (value: string) => formatBerlin(value, false, locale) }
}

/**
 * Erasure after the deletion cooling-off period. The plan is a dry run and changes nothing.
 * Only super and compliance administrators see it; for other roles the API refuses and the card stays hidden.
 */
export default function AccountErasure({ onErased }: { onErased?: () => void }) {
  const { t, summary, date } = useErasureText()
  const resource = usePortalResource<unknown>(`${BASE}/plan`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => plan(resource.data), [resource.data]), [notice, setNotice] = useState('')
  // 403: this role may not erase. 404: the API does not offer erasure yet. Either way there is nothing to show.
  if (resource.errorStatus === 403 || resource.errorStatus === 404) return null
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'>
        <h2 className='text-xl font-semibold text-ink'>{t('title')}</h2>
        <p className='mt-1 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p>
      </div>
      {data && <PortalBadge tone={data.erasure_enabled ? 'warning' : 'neutral'}>{data.erasure_enabled ? t('enabled') : t('dryRun')}</PortalBadge>}
    </div>
    {notice && <p role='status' className='mt-3 rounded-xl border border-theme bg-surface-subtle p-3 text-sm text-ink'>{notice}</p>}
    {resource.loading && <p role='status' className='mt-3 text-sm text-secondary'>{t('checking')}</p>}
    {(resource.error || (resource.data !== null && !data)) && <div role='alert' className='mt-3 text-sm text-ink'><p>{resource.errorMessage || t('planFailed')}</p>
      <PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>{t('retry')}</PortalButton></div>}
    {data && <>
      <p className='mt-3 text-sm text-ink'>{t('dueLine', { due: data.due_count, waiting: data.waiting_count })}</p>
      {data.due.length > 0 && <ul className='mt-3 grid gap-2'>{data.due.map(item => <li key={item.user_id} className='min-w-0 rounded-xl border border-theme bg-surface-subtle p-3 text-sm'>
        <p className='break-all font-semibold text-ink'>{t(item.role === 'doctor' ? 'doctorAccount' : 'patientAccount', { id: item.user_id })}</p>
        <p className='mt-1 text-secondary'>{t('dueSince', { date: date(item.erase_contact_data_after) })}{item.requested_at ? ` · ${t('requested', { date: date(item.requested_at) })}` : ''}</p>
        <p className='mt-1 text-secondary'>{t('wouldErase', { fields: summary(item.fields_to_erase) })}</p>
      </li>)}</ul>}
      <details className='mt-3 text-sm text-secondary'><summary className='cursor-pointer font-semibold text-ink'>{t('kept')}</summary>
        <ul className='mt-2 list-disc pl-5'>{data.retained.map(item => <li key={item}>{item}</li>)}</ul>
        <p className='mt-2'>{t('legalReview', { input: data.pending_input })}</p></details>
      {data.due_count > 0 && (data.erasure_enabled ? <RunErasure plan={data} done={message => { setNotice(message); resource.retry(); onErased?.() }} />
        : <p className='mt-3 text-sm text-secondary'>{t('switchedOff')}</p>)}
    </>}
  </PortalCard>
}

function RunErasure({ plan, done }: { plan: Plan; done: (message: string) => void }) {
  const { t } = useErasureText()
  const [reason, setReason] = useState(''), [count, setCount] = useState(''), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction('account-erasure:' + plan.due.map(item => item.user_id).join(','))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    const problem = reasonProblem(reason, { short: t('reasonShort'), long: t('reasonLong') })
    if (problem) next['erasure-reason'] = problem
    if (count.trim() !== String(plan.due_count)) next['erasure-count'] = t('countMismatch', { count: plan.due_count })
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(`${BASE}/run`, { reason: reason.trim(), expected_accounts: plan.due_count }, undefined, signal), result => {
      if (!object(result) || typeof result.erased_count !== 'number') throw new Error(t('unconfirmed'))
      const message = t('erased', { count: result.erased_count })
      done(message); return message
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='mt-4 grid gap-3 rounded-xl border border-theme p-4'>
    <h3 className='font-semibold text-ink'>{t('erase')}</h3>
    <p className='text-sm text-secondary'>{t('cannotUndo')}</p>
    <ValidationSummary errors={errors} />
    <div className='min-w-0'><label htmlFor='erasure-reason' className='mb-2 block text-sm font-semibold text-ink'>{t('reasonLabel')}</label>
      <textarea id='erasure-reason' value={reason} maxLength={500} rows={3} onChange={event => setReason(event.target.value)} className={practiceControl}
        aria-invalid={!!errors['erasure-reason']} aria-describedby='erasure-reason-error' />
      <FieldFeedback name='erasure-reason' error={errors['erasure-reason']} /></div>
    <div className='min-w-0'><label htmlFor='erasure-count' className='mb-2 block text-sm font-semibold text-ink'>{t('countLabel')}</label>
      <input id='erasure-count' inputMode='numeric' value={count} onChange={event => setCount(event.target.value)} className={practiceControl}
        aria-invalid={!!errors['erasure-count']} aria-describedby='erasure-count-hint erasure-count-error' />
      <FieldFeedback name='erasure-count' error={errors['erasure-count']} hint={t('countHint')} /></div>
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone='danger' disabled={action.busy}>{action.busy ? t('erasing') : t('erase')}</PortalButton></div>
  </form>
}

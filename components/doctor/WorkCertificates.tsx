'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl } from '@/lib/practice'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback } from '@/components/practice/PracticeShared'

type Certificate = { id: string; kind: 'INITIAL' | 'FOLLOW_UP'; start_date: string; end_date: string; issued_at: string | null; valid_for_submission: boolean }
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const formatDate = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('de-DE')
const today = () => new Date().toLocaleDateString('sv-SE') // yyyy-mm-dd in the local zone
const MAX_DAYS = 7, MAX_BACKDATE = 3

function certificates(value: unknown): Certificate[] | null {
  if (!object(value) || !Array.isArray(value.certificates)) return null
  const rows = value.certificates.filter((row): row is Certificate => object(row) && typeof row.id === 'string' && ['INITIAL', 'FOLLOW_UP'].includes(String(row.kind)) && isoDate(row.start_date) && isoDate(row.end_date) && typeof row.valid_for_submission === 'boolean')
  return rows.length === value.certificates.length ? rows : null
}

/** Issue an incapacity certificate after the video consultation (development PDF until the eAU is connected). */
export default function WorkCertificates({ consultationId, started }: { consultationId: string; started: boolean }) {
  const t = useTranslations('workCertificates')
  const base = `/api/v1/doctor/consultations/${consultationId}/work-certificates`
  const resource = usePortalResource<unknown>(base, false, { abortOnCleanup: true })
  const rows = useMemo(() => certificates(resource.data), [resource.data])
  const [creationId, setCreationId] = useState(() => crypto.randomUUID())
  const [fields, setFields] = useState({ kind: 'INITIAL', start_date: today(), end_date: today() })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction('work-certificate:' + consultationId)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    const start = new Date(fields.start_date + 'T12:00:00'), end = new Date(fields.end_date + 'T12:00:00'), now = new Date(today() + 'T12:00:00')
    if (!isoDate(fields.start_date)) next['certificate-start'] = t('firstDay')
    if (!isoDate(fields.end_date)) next['certificate-end'] = t('lastDay')
    else if (end < start) next['certificate-end'] = t('order')
    else if ((end.getTime() - start.getTime()) / 86_400_000 + 1 > MAX_DAYS) next['certificate-end'] = t('maxDays', { days: MAX_DAYS })
    if (isoDate(fields.start_date) && (now.getTime() - start.getTime()) / 86_400_000 > MAX_BACKDATE) next['certificate-start'] = t('backdate', { days: MAX_BACKDATE })
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(base, { creation_id: creationId, ...fields }, undefined, signal), result => {
      if (!object(result) || !object(result.certificate)) throw new Error(t('unconfirmed'))
      setCreationId(crypto.randomUUID()); resource.retry(); return t('issued')
    })
  }
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'><h2 className='text-xl font-semibold text-ink'>{t('title')}</h2>
        <p className='mt-1 text-sm leading-7 text-secondary'>{t('intro')}</p></div>
      <PortalBadge tone='warning'>{t('devNote')}</PortalBadge>
    </div>
    {!started ? <p className='mt-4 text-sm text-secondary'>{t('availableAfter')}</p> : <form noValidate onSubmit={submit} aria-busy={action.busy} className='mt-4 grid gap-4'>
      <ValidationSummary errors={errors} />
      <fieldset className='grid gap-2'><legend className='mb-1 text-sm font-semibold text-ink'>{t('type')}</legend>
        {(['INITIAL', 'FOLLOW_UP'] as const).map(kind => <label key={kind} className='flex items-center gap-3 text-sm text-ink'>
          <input type='radio' name='certificate-kind' value={kind} checked={fields.kind === kind} onChange={() => setFields(value => ({ ...value, kind }))} className='h-5 w-5' />
          {kind === 'INITIAL' ? t('initialLong') : t('followUpLong')}</label>)}
      </fieldset>
      <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
        {([['start_date', 'certificate-start', t('from')], ['end_date', 'certificate-end', t('until')]] as const).map(([key, id, label]) => <div key={key} className='min-w-0'>
          <label htmlFor={id} className='mb-2 block text-sm font-semibold text-ink'>{label} (Required)</label>
          <input id={id} type='date' value={fields[key]} onChange={event => setFields(value => ({ ...value, [key]: event.target.value }))} className={practiceControl} aria-invalid={!!errors[id]} aria-describedby={`${id}-hint ${id}-error`} />
          <FieldFeedback name={id} error={errors[id]} hint={key === 'end_date' ? t('maxTotal', { days: MAX_DAYS }) : t('backdated', { days: MAX_BACKDATE })} />
        </div>)}
      </div>
      <ActionFeedback action={action} />
      <div><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('issuing') : t('issue')}</PortalButton></div>
    </form>}
    <div className='mt-6'>
      <h3 className='mb-3 font-semibold text-ink'>{t('issuedList')}</h3>
      {!rows ? <p className='text-sm text-secondary'>{resource.error ? t('loadFailed') : t('loading')}</p>
        : rows.length === 0 ? <PortalEmptyState title={t('none')} description={t('noneText')} />
        : <ul className='grid gap-2'>{rows.map(row => <li key={row.id} className='rounded-xl border border-theme bg-surface p-3 text-sm text-ink'>
            {row.kind === 'INITIAL' ? t('initial') : t('followUp')}: {formatDate(row.start_date)} – {formatDate(row.end_date)}
          </li>)}</ul>}
    </div>
  </PortalCard>
}

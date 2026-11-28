'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl } from '@/lib/practice'
import { treatingEntity } from '@/lib/treating-entity'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeGate, PracticeReadState, PracticeScope } from '@/components/practice/PracticeShared'
import VerificationWorkspace from './VerificationWorkspace'
import { EntityStatements, InvoicesHeading, InvoicesIntro } from '@/components/settlement/Settlement'

const BASE = '/api/v1/doctor/independent-practice'

/** A doctor's own single-clinician treating entity: create it, then verify it. */
export default function IndependentPractice() {
  const t = useTranslations('independentPractice')
  return <PracticeScope><header className='mb-6'>
    <h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('title')}</h1>
    <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p>
  </header><PracticeGate><Content /></PracticeGate></PracticeScope>
}

function Content() {
  const resource = usePortalResource<unknown>(BASE, false, { abortOnCleanup: true })
  const parsed = useMemo(() => {
    if (!object(resource.data) || !('practice' in resource.data)) return undefined
    return resource.data.practice === null ? null : treatingEntity(resource.data.practice) ?? undefined
  }, [resource.data])
  if (parsed === undefined) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data} /></PortalCard>
  if (parsed === null) return <CreateForm created={resource.retry} />
  return <>
    <VerificationWorkspace base={`${BASE}/${parsed.id}`} entityKind='independent' />
    <section aria-labelledby='independent-invoices' className='mt-10'>
      <h2 id='independent-invoices' className='mb-2 text-2xl font-bold text-ink'><InvoicesHeading /></h2>
      <p className='mb-4 max-w-3xl text-sm leading-7 text-secondary'><InvoicesIntro /></p>
      <EntityStatements base={`${BASE}/${parsed.id}/statements`} />
    </section>
  </>
}

function CreateForm({ created }: { created: () => void }) {
  const t = useTranslations('independentPractice')
  const [creationId] = useState(() => crypto.randomUUID()), action = usePracticeAction('independent-create:' + creationId)
  const [fields, setFields] = useState({ name: '', address_line1: '', postcode: '', city: '' }), [confirmed, setConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const labels = { name: t('fieldName'), address_line1: t('fieldStreet'), postcode: t('fieldPostcode'), city: t('fieldCity') }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (fields.name.trim() && fields.name.trim().length < 2) next.name = t('nameError')
    if (fields.postcode && !/^\d{5}$/.test(fields.postcode.trim())) next.postcode = t('postcodeError')
    if (!confirmed) next.confirmed = t('confirmError')
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    const body = { creation_id: creationId, country: 'DE', ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() || null])) }
    void action.run(signal => apiPost(BASE, body, undefined, signal), result => {
      if (!object(result) || !treatingEntity(result.practice)) throw new Error(t('unconfirmed')); created(); return t('created')
    })
  }
  return <PortalCard><form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'>
    <h2 className='text-xl font-semibold text-ink'>{t('setupTitle')}</h2>
    <p className='text-sm leading-7 text-secondary'>{t('setupIntro')}</p>
    <ValidationSummary errors={errors} />
    <div className='grid min-w-0 gap-4 sm:grid-cols-2'>{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <div key={key} className='min-w-0'>
      <label htmlFor={'independent-' + key} className='mb-2 block text-sm font-semibold text-ink'>{t('optionalLabel', { label: labels[key] })}</label>
      <input id={'independent-' + key} value={fields[key]} maxLength={key === 'name' ? 160 : key === 'postcode' ? 5 : 255} inputMode={key === 'postcode' ? 'numeric' : undefined}
        onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} className={practiceControl} aria-invalid={!!errors[key]} aria-describedby={`independent-${key}-hint independent-${key}-error`} />
      <FieldFeedback name={'independent-' + key} error={errors[key]} hint={key === 'name' ? t('nameHint') : undefined} />
    </div>)}</div>
    <label htmlFor='independent-confirmed' className='flex items-start gap-3 text-sm leading-7 text-ink'>
      <input id='independent-confirmed' type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} aria-invalid={!!errors.confirmed} aria-describedby='independent-confirmed-error' />
      <span>{t('confirm')}</span>
    </label>
    <FieldFeedback name='independent-confirmed' error={errors.confirmed} />
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('creating') : t('create')}</PortalButton></div>
  </form></PortalCard>
}

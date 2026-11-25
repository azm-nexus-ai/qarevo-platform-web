'use client'
import { openSignedDocument } from '@/lib/open-signed-document'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useLocale } from 'next-intl'
import { useVerificationText } from './useVerificationText'

/** German dates for German; English keeps the browser's own format. */
const useDateLocale = () => (useLocale().startsWith('de') ? 'de-DE' : undefined)
import { apiGet, apiPost, apiUpload, getApiErrorDetail } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl } from '@/lib/practice'
import {
  evidence as parseEvidence, fieldErrors, fileProblem, formatBytes, legalDocument, neededDocuments,
  submission as parseSubmission, submissionProblems, verificationOverview, type Clinician, type Evidence, type FieldRule, type LegalDocument, type LegalStatus,
  type VerificationOverview,
} from '@/lib/treating-entity'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeReadState } from '@/components/practice/PracticeShared'

type Props = { base: string; entityKind: 'practice' | 'independent' }

/** Evidence, legal acceptance and submission for one treating entity (practice or independent practitioner). */
export default function VerificationWorkspace({ base, entityKind }: Props) {
  const resource = usePortalResource<unknown>(`${base}/verification`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => verificationOverview(resource.data), [resource.data])
  if (!data) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !data} /></PortalCard>
  return <Workspace key={data.latest_submission?.id ?? 'none'} base={base} data={data} entityKind={entityKind} refresh={resource.retry} />
}

function Workspace({ base, data, entityKind, refresh }: { base: string; data: VerificationOverview; entityKind: 'practice' | 'independent'; refresh: () => void }) {
  const latest = data.latest_submission
  const underReview = latest?.status === 'SUBMITTED' || latest?.status === 'FIRST_APPROVED'
  const suspended = data.practice.status === 'SUSPENDED'
  const locked = underReview || suspended
  const [fields, setFields] = useState<Record<string, string>>({})
  const [clinicianFields, setClinicianFields] = useState<Record<string, Record<string, string>>>({})
  return <div className='grid gap-6'>
    <StatusCard data={data} entityKind={entityKind} />
    {!locked && <>
      <LegalStep base={base} legal={data.legal} entityKind={entityKind} refresh={refresh} />
      <DetailsStep rules={data.requirements.entity_fields} clinicianRules={data.requirements.clinician_fields} clinicians={data.practice.entity.entity_type === 'PRACTICE' ? data.clinicians : []}
        fields={fields} setFields={setFields} clinicianFields={clinicianFields} setClinicianFields={setClinicianFields} />
      <EvidenceStep base={base} data={data} fields={fields} refresh={refresh} />
      <SubmitStep base={base} data={data} fields={fields} clinicianFields={clinicianFields} refresh={refresh} />
    </>}
  </div>
}

function StatusCard({ data, entityKind }: { data: VerificationOverview; entityKind: 'practice' | 'independent' }) {
  const { t, status } = useVerificationText(), dateLocale = useDateLocale()
  const latest = data.latest_submission, entity = data.practice.entity
  const tone = data.practice.bookable ? 'success' : latest?.status === 'REJECTED' ? 'warning' : 'neutral'
  const label = data.practice.status === 'SUSPENDED' ? t('suspended') : data.practice.bookable ? t('verifiedBookable') : latest ? status(latest.status) : t('notSubmitted')
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'>
        <h2 className='text-xl font-semibold text-ink'>{t(`title.${entityKind}`)}</h2>
        <p className='mt-2 text-sm leading-7 text-secondary'>
          {t('statusIntro')}
        </p>
      </div>
      <PortalBadge tone={tone}>{label}</PortalBadge>
    </div>
    <dl className='mt-4 grid gap-3 text-sm sm:grid-cols-3'>
      <div><dt className='text-secondary'>{t('patientsLabel')}</dt><dd className='font-semibold text-ink'>{entity.verification_status !== 'VERIFIED' ? t('patientsNone') : entity.public_insurance_eligible ? t('patientsAll') : t('patientsPrivate')}</dd></div>
      <div><dt className='text-secondary'>{t('requirementSet')}</dt><dd className='font-semibold text-ink'>{data.requirements.key}</dd></div>
      <div><dt className='text-secondary'>{t('timeZone')}</dt><dd className='font-semibold text-ink'>{entity.time_zone}</dd></div>
    </dl>
    {latest?.status === 'REJECTED' && latest.rejection_reason && <div role='alert' className='mt-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>
      <p className='font-semibold'>{t('changesRequested')}</p><p>{latest.rejection_reason}</p><p className='text-secondary'>{t('correctAndResubmit')}</p>
    </div>}
    {(latest?.status === 'SUBMITTED' || latest?.status === 'FIRST_APPROVED') && <p role='status' className='mt-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>
      {t('submittedAt', { time: new Date(latest.submitted_at).toLocaleString(dateLocale) })} {latest.status === 'FIRST_APPROVED' ? t('firstApproved') : t('waitingFirst')} {t('locked')}
    </p>}
    {data.practice.status === 'SUSPENDED' && <p role='alert' className='mt-4 text-sm text-ink'>{t(`suspendedNote.${entityKind}`)}</p>}
    <p className='mt-4 text-xs leading-6 text-secondary'>{t('requirementsNote', { reference: data.requirements.pending_input })}</p>
  </PortalCard>
}

function StepHeading({ number, title, done, description }: { number: number; title: string; done: boolean; description: string }) {
  const { t } = useVerificationText()
  return <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
    <div className='min-w-0'><h3 className='text-lg font-semibold text-ink'>{t('step', { number, title })}</h3><p className='mt-1 text-sm leading-7 text-secondary'>{description}</p></div>
    <PortalBadge tone={done ? 'success' : 'neutral'}>{done ? t('complete') : t('toDo')}</PortalBadge>
  </div>
}

function LegalStep({ base, legal, entityKind, refresh }: { base: string; legal: LegalStatus[]; entityKind: 'practice' | 'independent'; refresh: () => void }) {
  const { t } = useVerificationText()
  return <PortalCard>
    <StepHeading number={1} title={t('agreements')} done={legal.every(row => row.accepted)} description={t(`agreementsIntro.${entityKind}`)} />
    <ul className='grid gap-3'>{legal.map(row => <LegalRow key={row.kind + row.version} base={base} row={row} refresh={refresh} />)}</ul>
  </PortalCard>
}

function LegalRow({ base, row, refresh }: { base: string; row: LegalStatus; refresh: () => void }) {
  const [document, setDocument] = useState<LegalDocument | null>(null), [loadError, setLoadError] = useState(''), [agreed, setAgreed] = useState(false), [error, setError] = useState('')
  const action = usePracticeAction(base + ':legal:' + row.kind + ':' + row.version), id = useId()
  const { t, legal, inline } = useVerificationText(), dateLocale = useDateLocale(), label = legal(row.kind)
  const open = async () => {
    setLoadError('')
    try {
      const value = legalDocument(await apiGet<unknown>(`/api/v1/legal/documents/${row.kind}?locale=de`))
      if (!value || value.version !== row.version) throw new Error(t('agreementFailed'))
      setDocument(value)
    } catch (failure) { setLoadError(getApiErrorDetail(failure) || (failure instanceof Error ? failure.message : t('agreementFailedShort'))) }
  }
  const accept = () => {
    if (!document) return
    if (!agreed) { setError(t('confirmRead')); return }
    setError('')
    void action.run(signal => apiPost(`${base}/legal/acceptances`, { kind: document.kind, version: document.version, locale: document.locale, sha256: document.sha256 }, undefined, signal),
      result => { if (!object(result) || !Array.isArray(result.legal)) throw new Error(t('acceptUnconfirmed')); refresh(); return t('acceptedNamed', { label }) })
  }
  return <li className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='min-w-0'><p className='font-semibold text-ink'>{label}</p><p className='text-sm text-secondary'>{t('version', { version: row.version })}{row.review_status === 'DRAFT_NOT_LEGALLY_REVIEWED' ? ` · ${t('draftNotReviewed')}` : ''}</p></div>
      {row.accepted ? <PortalBadge tone='success'>{t('acceptedOn', { date: row.accepted_at ? new Date(row.accepted_at).toLocaleDateString(dateLocale) : '' })}</PortalBadge>
        : !document && <PortalButton type='button' onClick={() => void open()}>{t('read', { label: inline(label) })}</PortalButton>}
    </div>
    {loadError && <p role='alert' className='mt-3 text-sm text-ink'>{loadError}</p>}
    {!row.accepted && document && <div className='mt-4 grid gap-3'>
      <div role='region' aria-label={label} tabIndex={0} className='max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>{document.body}</div>
      <label htmlFor={id} className='flex items-start gap-3 text-sm text-ink'>
        <input id={id} type='checkbox' checked={agreed} onChange={event => setAgreed(event.target.checked)} className='mt-1 h-5 w-5 shrink-0' aria-invalid={!!error} aria-describedby={id + '-error'} />
        <span>{t('acceptStatement', { label: inline(label) })}</span>
      </label>
      <FieldFeedback name={id} error={error} />
      <ActionFeedback action={action} />
      <div><PortalButton type='button' tone='primary' disabled={action.busy} onClick={accept}>{action.busy ? t('savingAcceptance') : t('accept', { label: inline(label) })}</PortalButton></div>
    </div>}
  </li>
}

type DetailsProps = {
  rules: FieldRule[]; clinicianRules: FieldRule[]; clinicians: Clinician[]
  fields: Record<string, string>; setFields: (update: (value: Record<string, string>) => Record<string, string>) => void
  clinicianFields: Record<string, Record<string, string>>; setClinicianFields: (update: (value: Record<string, Record<string, string>>) => Record<string, Record<string, string>>) => void
}

function FieldInput({ rule, id, value, onChange, error }: { rule: FieldRule; id: string; value: string; onChange: (value: string) => void; error?: string }) {
  const described = `${id}-hint ${id}-error`, { t, text } = useVerificationText()
  return <div className='min-w-0'>
    <label htmlFor={id} className='mb-2 block text-sm font-semibold text-ink'>{t(rule.required ? 'requiredLabel' : 'optionalLabel', { label: text.label(rule) })}</label>
    {rule.choices.length
      ? <select id={id} value={value} onChange={event => onChange(event.target.value)} className={practiceControl} aria-invalid={!!error} aria-describedby={described}>
          <option value=''>{t('choose')}</option>{rule.choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      : <input id={id} name={rule.key} value={value} maxLength={rule.max_length} inputMode={rule.pattern === '[0-9]{9}' ? 'numeric' : undefined}
          onChange={event => onChange(event.target.value)} className={practiceControl} aria-invalid={!!error} aria-describedby={described} autoComplete='off' />}
    <FieldFeedback name={id} error={error} hint={rule.pattern === '[0-9]{9}' ? t('nineDigits') : rule.group ? t('groupHint') : undefined} />
  </div>
}

function DetailsStep({ rules, clinicianRules, clinicians, fields, setFields, clinicianFields, setClinicianFields }: DetailsProps) {
  const { t, text } = useVerificationText()
  const complete = Object.keys(fieldErrors(rules, fields, '', text)).length === 0 && clinicians.every(c => Object.keys(fieldErrors(clinicianRules, clinicianFields[c.user_id] ?? {}, '', text)).length === 0)
  return <PortalCard>
    <StepHeading number={2} title={t('details')} done={complete} description={t('detailsIntro')} />
    <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
      {rules.map(rule => <FieldInput key={rule.key} rule={rule} id={'entity-' + rule.key} value={fields[rule.key] ?? ''} onChange={value => setFields(previous => ({ ...previous, [rule.key]: value }))} />)}
    </div>
    {clinicians.length > 0 && clinicianRules.length > 0 && <div className='mt-6 grid gap-4'>
      <h4 className='font-semibold text-ink'>{t('clinicians')}</h4>
      {clinicians.map(clinician => <fieldset key={clinician.user_id} className='min-w-0 rounded-xl border border-theme p-4'>
        <legend className='px-1 text-sm font-semibold text-ink'>{clinician.full_name}</legend>
        <div className='grid min-w-0 gap-4 sm:grid-cols-2'>{clinicianRules.map(rule => <FieldInput key={rule.key} rule={rule} id={`clinician-${clinician.user_id}-${rule.key}`}
          value={clinicianFields[clinician.user_id]?.[rule.key] ?? ''} onChange={value => setClinicianFields(previous => ({ ...previous, [clinician.user_id]: { ...previous[clinician.user_id], [rule.key]: value } }))} />)}</div>
      </fieldset>)}
    </div>}
  </PortalCard>
}

function EvidenceStep({ base, data, fields, refresh }: { base: string; data: VerificationOverview; fields: Record<string, string>; refresh: () => void }) {
  const { t, document } = useVerificationText()
  const clinicians = data.practice.entity.entity_type === 'PRACTICE' ? data.clinicians : []
  const rows = neededDocuments(data.requirements, fields, clinicians, data.evidence)
  return <PortalCard>
    <StepHeading number={3} title={t('documents')} done={rows.every(row => row.uploaded.length > 0)} description={t('documentsIntro')} />
    <ul className='grid gap-3'>{rows.map(row => <EvidenceRow key={row.rule.key + (row.clinician?.user_id ?? '')} base={base} label={document(row.rule.key, row.rule.label)} requirementKey={row.rule.key}
      clinician={row.clinician} uploaded={row.uploaded} required={row.rule.required || row.rule.required_with !== null} refresh={refresh} />)}</ul>
  </PortalCard>
}

function EvidenceRow({ base, label, requirementKey, clinician, uploaded, required, refresh }: { base: string; label: string; requirementKey: string; clinician: Clinician | null; uploaded: Evidence[]; required: boolean; refresh: () => void }) {
  const id = useId(), [file, setFile] = useState<File | null>(null), [error, setError] = useState(''), { t, text } = useVerificationText()
  const action = usePracticeAction(base + ':evidence:' + requirementKey + ':' + (clinician?.user_id ?? '') + ':' + uploaded.map(item => item.id).join(','))
  const upload = () => {
    if (!file) { setError(t('chooseFileFirst')); return }
    const problem = fileProblem(file, text); if (problem) { setError(problem); return }
    setError('')
    const body = new FormData(); body.append('requirement_key', requirementKey); if (clinician) body.append('subject_user_id', clinician.user_id); body.append('file', file)
    void action.run(signal => apiUpload(`${base}/verification/evidence`, body, undefined, signal), result => {
      if (!object(result) || !parseEvidence(result.evidence)) throw new Error(t('uploadUnconfirmed'))
      setFile(null); refresh(); return t('uploadedNamed', { name: file.name })
    })
  }
  return <li className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'><p className='font-semibold text-ink'>{label}{clinician ? ` — ${clinician.full_name}` : ''}</p><p className='text-sm text-secondary'>{required ? t('required') : t('optional')}</p></div>
      <PortalBadge tone={uploaded.length ? 'success' : 'neutral'}>{uploaded.length ? t('uploaded') : t('missing')}</PortalBadge>
    </div>
    {uploaded.length > 0 && <ul className='mt-3 grid gap-2'>{uploaded.map(item => <UploadedFile key={item.id} base={base} item={item} refresh={refresh} />)}</ul>}
    <div className='mt-3 flex min-w-0 flex-wrap items-end gap-3'>
      <div className='min-w-0 flex-1'>
        <label htmlFor={id} className='mb-2 block text-sm font-semibold text-ink'>{uploaded.length ? t('addFile') : t('chooseFile')}</label>
        <input id={id} type='file' accept='application/pdf,image/jpeg,image/png' onChange={event => { setFile(event.target.files?.[0] ?? null); setError('') }}
          className='block w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-theme file:bg-surface-subtle file:px-3 file:text-sm file:font-semibold' aria-invalid={!!error} aria-describedby={id + '-error'} />
      </div>
      <PortalButton type='button' disabled={action.busy} onClick={upload}>{action.busy ? t('uploading') : t('upload')}</PortalButton>
    </div>
    <FieldFeedback name={id} error={error} />
    <ActionFeedback action={action} />
  </li>
}

function UploadedFile({ base, item, refresh }: { base: string; item: Evidence; refresh: () => void }) {
  const action = usePracticeAction(base + ':evidence-file:' + item.id), { t } = useVerificationText(), dateLocale = useDateLocale()
  const view = async () => {
    await openSignedDocument(`${base}/verification/evidence/${item.id}/download`)
  }
  return <li className='flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm'>
    <span className='min-w-0 break-all text-ink'>{item.original_filename} · {formatBytes(item.size_bytes)} · {new Date(item.created_at).toLocaleDateString(dateLocale)}</span>
    <span className='flex gap-2'>
      <PortalButton type='button' onClick={() => void view()}>{t('view')}</PortalButton>
      <PortalButton type='button' disabled={action.busy} onClick={() => void action.run(signal => apiPost(`${base}/verification/evidence/${item.id}/remove`, {}, undefined, signal), result => {
        if (!object(result) || !parseEvidence(result.evidence)) throw new Error(t('removeUnconfirmed')); refresh(); return t('removedNamed', { name: item.original_filename })
      })}>{action.busy ? t('removing') : t('remove')}</PortalButton>
    </span>
    <ActionFeedback action={action} />
  </li>
}

function SubmitStep({ base, data, fields, clinicianFields, refresh }: { base: string; data: VerificationOverview; fields: Record<string, string>; clinicianFields: Record<string, Record<string, string>>; refresh: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({}), [problems, setProblems] = useState<string[]>([])
  const action = usePracticeAction(base + ':submit:' + (data.latest_submission?.id ?? 'none')), { t, text, legal, document, inline } = useVerificationText()
  const clinicians = data.practice.entity.entity_type === 'PRACTICE' ? data.clinicians : []
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = { ...fieldErrors(data.requirements.entity_fields, fields, 'entity-', text) }
    for (const clinician of clinicians) Object.assign(next, fieldErrors(data.requirements.clinician_fields, clinicianFields[clinician.user_id] ?? {}, `clinician-${clinician.user_id}-`, text))
    for (const row of neededDocuments(data.requirements, fields, clinicians, data.evidence)) if (!row.uploaded.length && (row.rule.required || row.rule.required_with !== null)) next['evidence-' + row.rule.key + (row.clinician?.user_id ?? '')] = row.clinician ? t('uploadFor', { document: inline(document(row.rule.key, row.rule.label)), name: row.clinician.full_name }) : t('uploadThe', { document: inline(document(row.rule.key, row.rule.label)) })
    for (const row of data.legal) if (!row.accepted) next['legal-' + row.kind] = t('acceptThe', { label: inline(legal(row.kind)) })
    if (data.practice.entity.entity_type === 'PRACTICE' && !clinicians.length) next.clinicians = t('inviteClinician')
    setErrors(next); setProblems([])
    if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    const trimmed = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() || null]))
    const body = { entity_fields: trimmed(fields), clinician_fields: Object.fromEntries(clinicians.map(c => [c.user_id, trimmed(clinicianFields[c.user_id] ?? {})])) }
    void action.run(async signal => {
      try { return await apiPost(`${base}/verification/submissions`, body, undefined, signal) } catch (failure) { setProblems(submissionProblems(failure)); throw failure }
    }, result => { if (!object(result) || !parseSubmission(result.submission)) throw new Error(t('submitUnconfirmed')); refresh(); return t('submitted') })
  }
  return <PortalCard>
    <StepHeading number={4} title={t('submitTitle')} done={false} description={t('submitIntro')} />
    <form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'>
      <ValidationSummary errors={errors} />
      {problems.length > 0 && <ul role='alert' className='grid gap-1 rounded-xl border border-theme bg-surface-subtle p-4 text-sm text-ink'>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
      <ActionFeedback action={action} />
      <div><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('submitting') : t('submitTitle')}</PortalButton></div>
    </form>
  </PortalCard>
}

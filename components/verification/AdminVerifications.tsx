'use client'
import { openSignedDocument } from '@/lib/open-signed-document'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { useVerificationText } from './useVerificationText'
import { apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl, practiceVersion } from '@/lib/practice'
import {
  evidence as parseEvidence, formatBytes, queueRow, requirementSet, submissionDetail, treatingEntity,
  type Evidence, type QueueRow, type RequirementSet, type SubmissionDetail, type SubmissionStatus, type TreatingEntity,
} from '@/lib/treating-entity'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeReadState, PracticeScope } from '@/components/practice/PracticeShared'

const FILTERS = [['OPEN', 'filterOpen'], ['APPROVED', 'filterApproved'], ['REJECTED', 'filterRejected']] as const
const TYPES = [['', 'allTypes'], ['PRACTICE', 'practices'], ['INDEPENDENT', 'independents']] as const
const tone = (status: SubmissionStatus) => status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'warning' : 'info'

/** One verification queue for practices and independent practitioners. */
export function AdminVerificationQueue() {
  const { t, status: statusLabel, dateLocale } = useVerificationText()
  const entityLabel = (type: string) => type === 'INDEPENDENT' ? t('admin.independent') : t('admin.practice')
  const [status, setStatus] = useState<(typeof FILTERS)[number][0]>('OPEN'), [type, setType] = useState(''), [offset, setOffset] = useState(0)
  const path = `/api/v1/admin/verifications?status=${status}&limit=25&offset=${offset}${type ? `&entity_type=${type}` : ''}`
  const resource = usePortalResource<unknown>(path, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => {
    const value = resource.data
    if (!object(value) || !Array.isArray(value.submissions) || typeof value.total !== 'number' || typeof value.has_next !== 'boolean') return null
    const rows = value.submissions.map(queueRow)
    return rows.every(Boolean) ? { rows: rows as QueueRow[], total: value.total, hasNext: value.has_next } : null
  }, [resource.data])
  return <PracticeScope>
    <header className='mb-6'>
      <h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('admin.title')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('admin.intro')}</p>
    </header>
    <PortalCard>
      <div className='flex flex-wrap items-end gap-4'>
        <fieldset className='min-w-0'><legend className='mb-2 text-sm font-semibold text-ink'>{t('admin.status')}</legend><div className='flex flex-wrap gap-2'>
          {FILTERS.map(([value, label]) => <PortalButton key={value} type='button' tone={status === value ? 'primary' : 'secondary'} aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0) }}>{t(`admin.${label}`)}</PortalButton>)}
        </div></fieldset>
        <div className='min-w-0'><label htmlFor='verification-type' className='mb-2 block text-sm font-semibold text-ink'>{t('admin.type')}</label>
          <select id='verification-type' value={type} onChange={event => { setType(event.target.value); setOffset(0) }} className={practiceControl}>{TYPES.map(([value, label]) => <option key={value} value={value}>{t(`admin.${label}`)}</option>)}</select></div>
      </div>
      <div className='mt-6'>
        {!data ? <PracticeReadState resource={resource} invalid={!!resource.data && !data} />
          : data.rows.length === 0 ? <PortalEmptyState title={t('admin.nothing')} description={status === 'OPEN' ? t('admin.noneOpen') : t('admin.noneMatch')} />
          : <ul className='grid gap-3'>{data.rows.map(row => <li key={row.id} className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <Link href={`/admin/verifications/${row.id}`} className='break-words text-lg font-semibold text-brand underline underline-offset-4'>{row.practice_name}</Link>
                  <p className='mt-1 text-sm text-secondary'>{entityLabel(row.entity_type)} · {t('admin.submittedAt', { time: new Date(row.submitted_at).toLocaleString(dateLocale) })} · {row.public_insurance_eligible ? t('admin.fundingAll') : t('admin.fundingPrivate')}</p>
                </div>
                <PortalBadge tone={tone(row.status)}>{statusLabel(row.status)}</PortalBadge>
              </div>
            </li>)}</ul>}
        {data && (offset > 0 || data.hasNext) && <nav aria-label={t('admin.pages')} className='mt-4 flex flex-wrap gap-3'>
          <PortalButton type='button' disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>{t('admin.previous')}</PortalButton>
          <PortalButton type='button' disabled={!data.hasNext} onClick={() => setOffset(offset + 25)}>{t('admin.next')}</PortalButton>
        </nav>}
      </div>
    </PortalCard>
  </PracticeScope>
}

type Detail = { submission: SubmissionDetail; practice: TreatingEntity; evidence: Evidence[]; approval: Record<string, boolean>; requirements: RequirementSet }

function parseDetail(value: unknown): Detail | null {
  if (!object(value)) return null
  const submission = submissionDetail(value.submission), practice = treatingEntity(value.practice), requirements = requirementSet(value.requirements)
  const files = Array.isArray(value.evidence) ? value.evidence.map(parseEvidence) : null
  const approval = object(value.clinician_approval) ? value.clinician_approval as Record<string, boolean> : null
  if (!submission || !practice || !requirements || !files || !files.every(Boolean) || !approval || submission.practice_id !== practice.id) return null
  return { submission, practice, evidence: files as Evidence[], approval, requirements }
}

export function AdminVerificationDetail({ id }: { id: string }) {
  const { t } = useVerificationText()
  const resource = usePortalResource<unknown>(`/api/v1/admin/verifications/${id}`, false, { abortOnCleanup: true })
  const data = useMemo(() => parseDetail(resource.data), [resource.data])
  return <PracticeScope>
    <p className='mb-4'><Link href='/admin/verifications' className='text-sm font-semibold text-brand underline underline-offset-4'>{t('admin.back')}</Link></p>
    {!data ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !data} /></PortalCard>
      : <DetailView key={data.submission.version} data={data} refresh={resource.retry} />}
  </PracticeScope>
}

function DetailView({ data, refresh }: { data: Detail; refresh: () => void }) {
  const { t, status: statusLabel, legal, text, document, dateLocale } = useVerificationText()
  const entityLabel = (type: string) => type === 'INDEPENDENT' ? t('admin.independent') : t('admin.practice')
  const { submission, practice, requirements } = data
  const label = (key: string) => { const rule = [...requirements.entity_fields, ...requirements.clinician_fields].find(item => item.key === key); return rule ? text.label(rule) : key }
  const documentLabel = (key: string) => document(key, requirements.documents.find(rule => rule.key === key)?.label ?? key)
  const open = submission.status === 'SUBMITTED' || submission.status === 'FIRST_APPROVED'
  return <div className='grid gap-6'>
    <PortalCard>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h1 className='break-words text-3xl font-extrabold tracking-tight text-ink'>{practice.name}</h1>
          <p className='mt-2 text-sm text-secondary'>{entityLabel(submission.entity_type)} · {submission.requirement_set} · {t('admin.submittedAt', { time: new Date(submission.submitted_at).toLocaleString(dateLocale) })}</p>
        </div>
        <PortalBadge tone={tone(submission.status)}>{statusLabel(submission.status)}</PortalBadge>
      </div>
      <ol className='mt-4 grid gap-2 text-sm text-ink'>
        <li>{t('admin.firstApproval', { value: submission.first_approved_at ? `${new Date(submission.first_approved_at).toLocaleString(dateLocale)} — ${submission.first_approval_reason ?? ''}` : t('admin.pending') })}</li>
        <li>{t('admin.finalApproval', { value: submission.second_approved_at ? `${new Date(submission.second_approved_at).toLocaleString(dateLocale)} — ${submission.second_approval_reason ?? ''}` : t('admin.pending') })}</li>
        {submission.rejected_at && <li>{t('admin.changesRequestedAt', { time: new Date(submission.rejected_at).toLocaleString(dateLocale), reason: submission.rejection_reason ?? '' })}</li>}
      </ol>
      <p className='mt-3 text-sm text-secondary'>Eligibility once verified: {submission.public_insurance_eligible ? t('admin.patientsAll') : t('admin.patientsPrivate')}.</p>
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>{t('admin.declared')}</h2>
      <dl className='mt-4 grid gap-3 sm:grid-cols-2'>{Object.entries(submission.declaration.entity_fields).map(([key, value]) => <div key={key} className='min-w-0'>
        <dt className='text-sm text-secondary'>{label(key)}</dt><dd className='break-words font-semibold text-ink'>{value}</dd></div>)}</dl>
      {submission.declaration.clinicians.length > 0 && <>
        <h3 className='mt-6 font-semibold text-ink'>{t('admin.clinicians')}</h3>
        <ul className='mt-3 grid gap-2'>{submission.declaration.clinicians.map(clinician => <li key={clinician.user_id} className='rounded-xl border border-theme p-3 text-sm'>
          <p className='font-semibold text-ink'>{clinician.full_name}</p>
          <p className='text-secondary'>{Object.entries(clinician.fields).map(([key, value]) => `${label(key)}: ${value}`).join(' · ') || t('admin.noClinicianDetails')}</p>
          <p className='text-secondary'>Clinician account: {data.approval[clinician.user_id] ? 'approved' : 'not yet approved — approve it under Doctors before verifying'}</p>
        </li>)}</ul>
      </>}
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>{t('admin.evidence')}</h2>
      <p className='mt-2 text-sm text-secondary'>{t('admin.evidenceIntro')}</p>
      {data.evidence.length === 0 ? <PortalEmptyState title={t('admin.noDocuments')} description={t('admin.noDocumentsText')} /> : <ul className='mt-4 grid gap-2'>{data.evidence.map(item => {
        const owner = submission.declaration.clinicians.find(c => c.user_id === item.subject_user_id)
        return <EvidenceLine key={item.id} submissionId={submission.id} item={item} label={documentLabel(item.requirement_key) + (owner && submission.entity_type === 'PRACTICE' ? ` — ${owner.full_name}` : '')} />
      })}</ul>}
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>{t('admin.agreements')}</h2>
      <ul className='mt-3 grid gap-2 text-sm text-ink'>{submission.declaration.legal.map(row => <li key={row.kind}>
        {t('admin.legalLine', { label: legal(row.kind), version: row.version })}{row.accepted_at ? t('admin.acceptedSuffix', { time: new Date(row.accepted_at).toLocaleString(dateLocale), locale: row.accepted_locale ?? '—' }) : ''}
        <span className='block break-all text-xs text-secondary'>SHA-256 {row.sha256}</span></li>)}</ul>
    </PortalCard>

    {open && <Decisions submission={submission} refresh={refresh} />}
  </div>
}

function EvidenceLine({ submissionId, item, label }: { submissionId: string; item: Evidence; label: string }) {
  const { t } = useVerificationText()
  const [error, setError] = useState('')
  const view = async () => {
    setError('')
    if (!await openSignedDocument(`/api/v1/admin/verifications/${submissionId}/evidence/${item.id}/download`)) setError(t('admin.openFailed'))
  }
  return <li className='flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm'>
    <span className='min-w-0 break-words text-ink'><strong>{label}</strong> · {item.original_filename} · {formatBytes(item.size_bytes)}</span>
    <PortalButton type='button' onClick={() => void view()}>{t('admin.open')}</PortalButton>
    {error && <p role='alert' className='w-full text-ink'>{error}</p>}
  </li>
}

function Decisions({ submission, refresh }: { submission: SubmissionDetail; refresh: () => void }) {
  const { t } = useVerificationText()
  return <PortalCard>
    <h2 className='text-xl font-semibold text-ink'>{submission.status === 'SUBMITTED' ? t('admin.firstReview') : t('admin.finalReview')}</h2>
    <p className='mt-2 text-sm leading-7 text-secondary'>{submission.status === 'SUBMITTED'
      ? t('admin.firstNote')
      : t('admin.finalNote')}</p>
    <div className='mt-4 grid gap-4 lg:grid-cols-2'>
      <DecisionForm submission={submission} action='approve' label={submission.status === 'SUBMITTED' ? t('admin.approveFirst') : t('admin.approveFinal')} refresh={refresh} />
      <DecisionForm submission={submission} action='reject' label={t('admin.requestChanges')} refresh={refresh} />
    </div>
  </PortalCard>
}

function DecisionForm({ submission, action: kind, label, refresh }: { submission: SubmissionDetail; action: 'approve' | 'reject'; label: string; refresh: () => void }) {
  const { t } = useVerificationText()
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction(`verification:${submission.id}:${submission.version}:${kind}`), id = `decision-${kind}`
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (reason.trim().length < 4 || reason.trim().length > 500) next[id + '-reason'] = t('admin.reasonError')
    if (!confirmed) next[id + '-confirm'] = kind === 'approve' ? t('admin.approveConfirmError') : t('admin.rejectConfirmError')
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(`/api/v1/admin/verifications/${submission.id}/${kind}`, { reason: reason.trim() }, practiceVersion(submission.version), signal), result => {
      if (!object(result) || !submissionDetail(result.submission)) throw new Error(t('admin.decisionUnconfirmed'))
      refresh(); return kind === 'approve' ? t('admin.approved') : t('admin.rejected')
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
    <h3 className='font-semibold text-ink'>{label}</h3>
    <ValidationSummary errors={errors} />
    <div><label htmlFor={id + '-reason'} className='mb-2 block text-sm font-semibold text-ink'>{kind === 'approve' ? t('admin.whatChecked') : t('admin.whatChange')} (Required)</label>
      <textarea id={id + '-reason'} rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={practiceControl} aria-invalid={!!errors[id + '-reason']} aria-describedby={`${id}-reason-hint ${id}-reason-error`} />
      <FieldFeedback name={id + '-reason'} error={errors[id + '-reason']} hint={kind === 'reject' ? t('admin.applicantSees') : t('admin.auditNote')} /></div>
    <label htmlFor={id + '-confirm'} className='flex items-start gap-3 text-sm text-ink'>
      <input id={id + '-confirm'} type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} aria-invalid={!!errors[id + '-confirm']} aria-describedby={id + '-confirm-error'} />
      <span>{kind === 'approve' ? t('admin.approveConfirm') : t('admin.rejectConfirm')}</span>
    </label>
    <FieldFeedback name={id + '-confirm'} error={errors[id + '-confirm']} />
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone={kind === 'approve' ? 'primary' : 'danger'} disabled={action.busy}>{action.busy ? t('admin.saving') : label}</PortalButton></div>
  </form>
}

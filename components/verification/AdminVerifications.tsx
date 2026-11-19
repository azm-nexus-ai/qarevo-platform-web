'use client'
import { openSignedDocument } from '@/lib/open-signed-document'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, practiceControl, practiceVersion } from '@/lib/practice'
import {
  LEGAL_KIND_LABELS, STATUS_LABELS, evidence as parseEvidence, formatBytes, queueRow, requirementSet, submissionDetail, treatingEntity,
  type Evidence, type QueueRow, type RequirementSet, type SubmissionDetail, type SubmissionStatus, type TreatingEntity,
} from '@/lib/treating-entity'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeReadState, PracticeScope } from '@/components/practice/PracticeShared'

const FILTERS = [['OPEN', 'Waiting for review'], ['APPROVED', 'Verified'], ['REJECTED', 'Changes requested']] as const
const TYPES = [['', 'All types'], ['PRACTICE', 'Practices'], ['INDEPENDENT', 'Independent practitioners']] as const
const tone = (status: SubmissionStatus) => status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'warning' : 'info'
const entityLabel = (type: string) => type === 'INDEPENDENT' ? 'Independent practitioner' : 'Practice'

/** One verification queue for practices and independent practitioners. */
export function AdminVerificationQueue() {
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
      <h1 className='text-3xl font-extrabold tracking-tight text-ink'>Verifications</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>Practices and independent practitioners in one queue, oldest first. Each submission needs two approvals from two different administrators; neither may be the submitter.</p>
    </header>
    <PortalCard>
      <div className='flex flex-wrap items-end gap-4'>
        <fieldset className='min-w-0'><legend className='mb-2 text-sm font-semibold text-ink'>Status</legend><div className='flex flex-wrap gap-2'>
          {FILTERS.map(([value, label]) => <PortalButton key={value} type='button' tone={status === value ? 'primary' : 'secondary'} aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0) }}>{label}</PortalButton>)}
        </div></fieldset>
        <div className='min-w-0'><label htmlFor='verification-type' className='mb-2 block text-sm font-semibold text-ink'>Type</label>
          <select id='verification-type' value={type} onChange={event => { setType(event.target.value); setOffset(0) }} className={practiceControl}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>
      <div className='mt-6'>
        {!data ? <PracticeReadState resource={resource} invalid={!!resource.data && !data} />
          : data.rows.length === 0 ? <PortalEmptyState title='Nothing here' description={status === 'OPEN' ? 'No submissions are waiting for review.' : 'No submissions match this filter.'} />
          : <ul className='grid gap-3'>{data.rows.map(row => <li key={row.id} className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <Link href={`/admin/verifications/${row.id}`} className='break-words text-lg font-semibold text-brand underline underline-offset-4'>{row.practice_name}</Link>
                  <p className='mt-1 text-sm text-secondary'>{entityLabel(row.entity_type)} · submitted {new Date(row.submitted_at).toLocaleString()} · {row.public_insurance_eligible ? 'GKV, PKV and self-pay' : 'PKV and self-pay only'}</p>
                </div>
                <PortalBadge tone={tone(row.status)}>{STATUS_LABELS[row.status]}</PortalBadge>
              </div>
            </li>)}</ul>}
        {data && (offset > 0 || data.hasNext) && <nav aria-label='Verification pages' className='mt-4 flex flex-wrap gap-3'>
          <PortalButton type='button' disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous page</PortalButton>
          <PortalButton type='button' disabled={!data.hasNext} onClick={() => setOffset(offset + 25)}>Next page</PortalButton>
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
  const resource = usePortalResource<unknown>(`/api/v1/admin/verifications/${id}`, false, { abortOnCleanup: true })
  const data = useMemo(() => parseDetail(resource.data), [resource.data])
  return <PracticeScope>
    <p className='mb-4'><Link href='/admin/verifications' className='text-sm font-semibold text-brand underline underline-offset-4'>Back to the verification queue</Link></p>
    {!data ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !data} /></PortalCard>
      : <DetailView key={data.submission.version} data={data} refresh={resource.retry} />}
  </PracticeScope>
}

function DetailView({ data, refresh }: { data: Detail; refresh: () => void }) {
  const { submission, practice, requirements } = data
  const label = (key: string) => [...requirements.entity_fields, ...requirements.clinician_fields].find(rule => rule.key === key)?.label ?? key
  const documentLabel = (key: string) => requirements.documents.find(rule => rule.key === key)?.label ?? key
  const open = submission.status === 'SUBMITTED' || submission.status === 'FIRST_APPROVED'
  return <div className='grid gap-6'>
    <PortalCard>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h1 className='break-words text-3xl font-extrabold tracking-tight text-ink'>{practice.name}</h1>
          <p className='mt-2 text-sm text-secondary'>{entityLabel(submission.entity_type)} · {submission.requirement_set} · submitted {new Date(submission.submitted_at).toLocaleString()}</p>
        </div>
        <PortalBadge tone={tone(submission.status)}>{STATUS_LABELS[submission.status]}</PortalBadge>
      </div>
      <ol className='mt-4 grid gap-2 text-sm text-ink'>
        <li>First approval: {submission.first_approved_at ? `${new Date(submission.first_approved_at).toLocaleString()} — ${submission.first_approval_reason ?? ''}` : 'pending'}</li>
        <li>Final approval: {submission.second_approved_at ? `${new Date(submission.second_approved_at).toLocaleString()} — ${submission.second_approval_reason ?? ''}` : 'pending'}</li>
        {submission.rejected_at && <li>Changes requested {new Date(submission.rejected_at).toLocaleString()}: {submission.rejection_reason}</li>}
      </ol>
      <p className='mt-3 text-sm text-secondary'>Eligibility once verified: {submission.public_insurance_eligible ? 'GKV, PKV and self-pay patients' : 'PKV and self-pay patients only (no KV credentials declared)'}.</p>
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>Declared details</h2>
      <dl className='mt-4 grid gap-3 sm:grid-cols-2'>{Object.entries(submission.declaration.entity_fields).map(([key, value]) => <div key={key} className='min-w-0'>
        <dt className='text-sm text-secondary'>{label(key)}</dt><dd className='break-words font-semibold text-ink'>{value}</dd></div>)}</dl>
      {submission.declaration.clinicians.length > 0 && <>
        <h3 className='mt-6 font-semibold text-ink'>Clinicians who become bookable</h3>
        <ul className='mt-3 grid gap-2'>{submission.declaration.clinicians.map(clinician => <li key={clinician.user_id} className='rounded-xl border border-theme p-3 text-sm'>
          <p className='font-semibold text-ink'>{clinician.full_name}</p>
          <p className='text-secondary'>{Object.entries(clinician.fields).map(([key, value]) => `${label(key)}: ${value}`).join(' · ') || 'No clinician details required'}</p>
          <p className='text-secondary'>Clinician account: {data.approval[clinician.user_id] ? 'approved' : 'not yet approved — approve it under Doctors before verifying'}</p>
        </li>)}</ul>
      </>}
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>Evidence</h2>
      <p className='mt-2 text-sm text-secondary'>Opening a document is recorded in the audit log. Compare each document with the declared details.</p>
      {data.evidence.length === 0 ? <PortalEmptyState title='No documents' description='This submission contains no documents.' /> : <ul className='mt-4 grid gap-2'>{data.evidence.map(item => {
        const owner = submission.declaration.clinicians.find(c => c.user_id === item.subject_user_id)
        return <EvidenceLine key={item.id} submissionId={submission.id} item={item} label={documentLabel(item.requirement_key) + (owner && submission.entity_type === 'PRACTICE' ? ` — ${owner.full_name}` : '')} />
      })}</ul>}
    </PortalCard>

    <PortalCard>
      <h2 className='text-xl font-semibold text-ink'>Accepted agreements</h2>
      <ul className='mt-3 grid gap-2 text-sm text-ink'>{submission.declaration.legal.map(row => <li key={row.kind}>
        {LEGAL_KIND_LABELS[row.kind] ?? row.kind}, version {row.version}{row.accepted_at ? `, accepted ${new Date(row.accepted_at).toLocaleString()} (${row.accepted_locale})` : ''}
        <span className='block break-all text-xs text-secondary'>SHA-256 {row.sha256}</span></li>)}</ul>
    </PortalCard>

    {open && <Decisions submission={submission} refresh={refresh} />}
  </div>
}

function EvidenceLine({ submissionId, item, label }: { submissionId: string; item: Evidence; label: string }) {
  const [error, setError] = useState('')
  const view = async () => {
    setError('')
    if (!await openSignedDocument(`/api/v1/admin/verifications/${submissionId}/evidence/${item.id}/download`)) setError('The document could not be opened. Your role may not allow it, or storage is unavailable.')
  }
  return <li className='flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm'>
    <span className='min-w-0 break-words text-ink'><strong>{label}</strong> · {item.original_filename} · {formatBytes(item.size_bytes)}</span>
    <PortalButton type='button' onClick={() => void view()}>Open document</PortalButton>
    {error && <p role='alert' className='w-full text-ink'>{error}</p>}
  </li>
}

function Decisions({ submission, refresh }: { submission: SubmissionDetail; refresh: () => void }) {
  return <PortalCard>
    <h2 className='text-xl font-semibold text-ink'>{submission.status === 'SUBMITTED' ? 'First review' : 'Final review'}</h2>
    <p className='mt-2 text-sm leading-7 text-secondary'>{submission.status === 'SUBMITTED'
      ? 'Your approval is the first of two. A different administrator gives the final approval.'
      : 'One administrator has approved. If you gave the first approval, a different administrator must give this one.'}</p>
    <div className='mt-4 grid gap-4 lg:grid-cols-2'>
      <DecisionForm submission={submission} action='approve' label={submission.status === 'SUBMITTED' ? 'Approve (first of two)' : 'Approve and verify'} refresh={refresh} />
      <DecisionForm submission={submission} action='reject' label='Request changes' refresh={refresh} />
    </div>
  </PortalCard>
}

function DecisionForm({ submission, action: kind, label, refresh }: { submission: SubmissionDetail; action: 'approve' | 'reject'; label: string; refresh: () => void }) {
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction(`verification:${submission.id}:${submission.version}:${kind}`), id = `decision-${kind}`
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (reason.trim().length < 4 || reason.trim().length > 500) next[id + '-reason'] = 'Enter a reason using 4–500 characters.'
    if (!confirmed) next[id + '-confirm'] = kind === 'approve' ? 'Confirm that you checked every document against the declared details.' : 'Confirm that the applicant should correct and resubmit.'
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(`/api/v1/admin/verifications/${submission.id}/${kind}`, { reason: reason.trim() }, practiceVersion(submission.version), signal), result => {
      if (!object(result) || !submissionDetail(result.submission)) throw new Error('The decision could not be confirmed. Refresh before trying again.')
      refresh(); return kind === 'approve' ? 'Approval recorded.' : 'Changes requested. The applicant can correct and resubmit.'
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
    <h3 className='font-semibold text-ink'>{label}</h3>
    <ValidationSummary errors={errors} />
    <div><label htmlFor={id + '-reason'} className='mb-2 block text-sm font-semibold text-ink'>{kind === 'approve' ? 'What you checked' : 'What must change'} (Required)</label>
      <textarea id={id + '-reason'} rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={practiceControl} aria-invalid={!!errors[id + '-reason']} aria-describedby={`${id}-reason-hint ${id}-reason-error`} />
      <FieldFeedback name={id + '-reason'} error={errors[id + '-reason']} hint={kind === 'reject' ? 'The applicant sees this text. Do not include clinical information.' : 'Recorded in the audit log. Do not include clinical information.'} /></div>
    <label htmlFor={id + '-confirm'} className='flex items-start gap-3 text-sm text-ink'>
      <input id={id + '-confirm'} type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} aria-invalid={!!errors[id + '-confirm']} aria-describedby={id + '-confirm-error'} />
      <span>{kind === 'approve' ? 'I checked every document against the declared details.' : 'The applicant should correct the submission and submit again.'}</span>
    </label>
    <FieldFeedback name={id + '-confirm'} error={errors[id + '-confirm']} />
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone={kind === 'approve' ? 'primary' : 'danger'} disabled={action.busy}>{action.busy ? 'Saving decision…' : label}</PortalButton></div>
  </form>
}

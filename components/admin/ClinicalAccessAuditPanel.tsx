'use client'

import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, getApiErrorDetail, getApiErrorRequestId, isAuthError } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import SupportReference from '@/components/ui/SupportReference'
import { PortalBadge, PortalButton } from '@/components/patient/PatientPortalPrimitives'

type HistoryKind = 'access' | 'publication'
type ClinicalEvent = {
  id: string; created_at: string | null; actor_user_id: string | null; patient_user_id: string | null
  file_id?: string | null; lab_request_id?: string | null; provider_id: string | null
  uploaded_by?: 'patient' | 'care_team' | 'unknown'; expires_in?: number | null
  record_id?: string | null; consultation_id?: string | null; revision?: number | null
  version?: number | null; published_at?: string | null
}
type ClinicalHistory = { can_view: boolean; events: ClinicalEvent[]; total_count: number; limit: number; offset: number; has_next: boolean; has_previous: boolean }
const pageSize = 25
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const definitions = {
  access: {
    title: 'Clinical access history', endpoint: 'clinical-access', filter: 'file_id', label: 'File',
    prefix: 'clinical-access', fieldId: 'clinical-file-filter', action: 'clinical access', item: 'access events',
    description: 'Records issuance of short-lived lab-result links. It does not establish that a file was downloaded or clinically reviewed.',
    empty: 'No access links recorded', emptyDescription: 'Events appear when an authorized clinician requests access to a lab result.',
  },
  publication: {
    title: 'Clinical publication history', endpoint: 'clinical-publications', filter: 'consultation_id', label: 'Consultation',
    prefix: 'clinical-publication', fieldId: 'clinical-consultation-filter', action: 'clinical publications', item: 'publication events',
    description: 'Confirmed publication receipts identify the clinician and immutable revision. Clinical text and amendment reasons are not disclosed here.',
    empty: 'No publication receipts recorded', emptyDescription: 'Receipts appear when a clinician confirms a published consultation summary or amendment.',
  },
} as const
const subscribeAccount = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
const adminScope = () => readAccountScope('admin')
const displayId = (value: unknown) => typeof value === 'string' && uuidPattern.test(value) ? value : 'Unavailable'
const displayTime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Time unavailable'

export default function ClinicalAccessAuditPanel() {
  const scope = useSyncExternalStore(subscribeAccount, adminScope, () => null)
  // Remount every account/session, clearing both history and sensitive ID filters.
  return scope ? <ClinicalHistoryContent key={scope} /> : null
}

function ClinicalHistoryContent() {
  const router = useRouter()
  const captureAction = usePortalAction()
  const [kind, setKind] = useState<HistoryKind>('access')
  const [filterInput, setFilterInput] = useState('')
  const [filterId, setFilterId] = useState('')
  const [validation, setValidation] = useState('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data: ClinicalHistory | null; error: string; requestId: string | null } | null>(null)
  const config = definitions[kind]
  const key = JSON.stringify([kind, filterId, offset, revision])
  const loading = result?.key !== key
  const data = loading ? null : result?.data
  const error = loading ? '' : result?.error

  useEffect(() => {
    let current = true
    const action = captureAction()
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    if (filterId) params.set(config.filter, filterId)
    apiGet<ClinicalHistory>('/api/v1/admin/audit-logs/' + config.endpoint + '?' + params)
      .then(history => {
        if (!current || !action.isCurrent()) return
        if (typeof history?.can_view !== 'boolean' || !Array.isArray(history.events)) throw new Error('Unexpected clinical history response.')
        setResult({ key, data: history, error: '', requestId: null })
      })
      .catch(failure => {
        if (!current || !action.isCurrent()) return
        if (isAuthError(failure)) { router.replace('/auth/admin/login'); return }
        setResult({ key, data: null, error: getApiErrorDetail(failure) || 'Unable to load clinical history. Please retry.', requestId: getApiErrorRequestId(failure) })
      })
    return () => { current = false }
  }, [captureAction, config.endpoint, config.filter, filterId, key, offset, router])

  const applyFilter = (event: FormEvent) => {
    event.preventDefault()
    const value = filterInput.trim()
    if (value && !uuidPattern.test(value)) { setValidation('Enter a ' + config.label.toLowerCase() + ' ID in UUID format: 8-4-4-4-12 hexadecimal characters.'); return }
    setValidation(''); setFilterId(value); setOffset(0); setRevision(number => number + 1)
  }
  const changeKind = (next: HistoryKind) => {
    setKind(next); setFilterInput(''); setFilterId(''); setValidation(''); setOffset(0)
  }

  return <section aria-labelledby={config.prefix + '-title'} aria-busy={loading} className='rounded-2xl border border-theme bg-surface p-5 sm:p-6'>
    <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
      <div><h2 id={config.prefix + '-title'} className='portal-h2'>{config.title}</h2><p className='text-sm leading-6 text-muted'>{config.description}</p></div>
      <PortalButton type='button' disabled={loading} onClick={() => setRevision(number => number + 1)}>Refresh {config.action}</PortalButton>
    </div>
    <div className='mb-5 max-w-md'><label htmlFor='clinical-history-kind' className='mb-2 block text-sm font-semibold text-ink'>Clinical history type</label>
      <select id='clinical-history-kind' value={kind} disabled={data?.can_view === false} onChange={event => changeKind(event.target.value as HistoryKind)} className='min-h-11 w-full rounded-xl border border-theme bg-canvas px-3 py-2 text-ink'>
        <option value='access'>Lab-result access</option><option value='publication'>Consultation-summary publications</option>
      </select>
    </div>
    {loading ? <p role='status' className='py-6 text-muted'>Loading {config.title.toLowerCase()}…</p>
      : error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-ink'>{error}</p><SupportReference requestId={result?.requestId} /><PortalButton type='button' onClick={() => setRevision(number => number + 1)}>Retry {config.action}</PortalButton></div>
        : data?.can_view === false ? <p className='text-sm text-muted'>{config.title} is available to platform owners and compliance administrators.</p>
          : data && <>
            <form onSubmit={applyFilter} className='mb-5 flex flex-wrap items-end gap-3'>
              <div className='min-w-0 flex-1'><label htmlFor={config.fieldId} className='mb-2 block text-sm font-semibold text-ink'>{config.label} ID (optional)</label><input id={config.fieldId} value={filterInput} onChange={event => setFilterInput(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={config.fieldId + (validation ? '-error' : '-hint')} className='min-h-11 w-full rounded-xl border border-theme bg-canvas px-3 py-2 text-ink' />
                <p id={config.fieldId + '-hint'} className='mt-2 text-xs text-muted'>UUID format. Leave empty to view all {kind === 'access' ? 'issued access links' : 'publication receipts'}.</p>{validation && <p id={config.fieldId + '-error'} role='alert' className='mt-2 text-sm text-ink'>{validation}</p>}
              </div><PortalButton type='submit'>Apply {config.label.toLowerCase()} filter</PortalButton>
            </form>
            {!data.events.length ? <div className='rounded-xl border border-theme bg-canvas p-5'><h3 className='portal-h3'>{config.empty}</h3><p className='text-sm text-muted'>{filterId ? 'No events match this ' + config.label.toLowerCase() + ' ID.' : config.emptyDescription}</p></div>
              : <div className='grid gap-3'>{data.events.map(entry => <article key={entry.id} aria-label={kind === 'access' ? 'Lab result access event' : 'Clinical publication event'} className='min-w-0 rounded-xl border border-theme bg-canvas p-4'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'><time dateTime={entry.created_at ?? undefined} className='text-sm text-muted'>{displayTime(entry.created_at)}</time><PortalBadge tone='info'>{kind === 'access' ? 'Access issued' : entry.revision && entry.revision > 1 ? 'Amendment published' : 'Summary published'}</PortalBadge></div>
                <dl className='grid min-w-0 gap-4 sm:grid-cols-2'>
                  {(kind === 'access' ? [['File', entry.file_id], ['Lab request', entry.lab_request_id], ['Clinician account', entry.actor_user_id], ['Patient account', entry.patient_user_id]]
                    : [['Record', entry.record_id], ['Consultation', entry.consultation_id], ['Clinician account', entry.actor_user_id], ['Patient account', entry.patient_user_id]]).map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-xs font-semibold text-muted'>{label}</dt><dd className='mt-1 break-all text-sm text-ink'>{displayId(value)}</dd></div>)}
                  {kind === 'access' ? <>
                    <div><dt className='text-xs font-semibold text-muted'>Upload source</dt><dd className='mt-1 text-sm text-ink'>{entry.uploaded_by === 'patient' ? 'Patient upload' : entry.uploaded_by === 'care_team' ? 'Care-team upload' : 'Source unavailable'}</dd></div>
                    <div><dt className='text-xs font-semibold text-muted'>Link lifetime</dt><dd className='mt-1 text-sm text-ink'>{entry.expires_in ? entry.expires_in + ' seconds' : 'Unavailable'}</dd></div>
                  </> : <>
                    <div><dt className='text-xs font-semibold text-muted'>Published revision</dt><dd className='mt-1 text-sm text-ink'>{entry.revision ?? 'Unavailable'}</dd></div>
                    <div><dt className='text-xs font-semibold text-muted'>Published at</dt><dd className='mt-1 text-sm text-ink'>{displayTime(entry.published_at)}</dd></div>
                  </>}
                </dl>
              </article>)}</div>}
            <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-muted'>Showing {data.events.length} of {data.total_count} events</p><div className='flex flex-wrap gap-2'><PortalButton type='button' disabled={!data.has_previous} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Previous {config.item}</PortalButton><PortalButton type='button' disabled={!data.has_next} onClick={() => setOffset(value => value + pageSize)}>Next {config.item}</PortalButton></div></div>
          </>}
  </section>
}

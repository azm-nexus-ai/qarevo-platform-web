'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, getApiErrorDetail, isAuthError } from '@/lib/api'
import { usePortalAction } from '@/lib/portal-action'
import { PortalBadge, PortalButton } from '@/components/patient/PatientPortalPrimitives'

type AccessEvent = {
  id: string; created_at: string | null; actor_user_id: string | null; patient_user_id: string | null
  file_id: string | null; lab_request_id: string | null; provider_id: string | null
  uploaded_by: 'patient' | 'care_team' | 'unknown'; expires_in: number | null
}
type AccessHistory = { can_view: boolean; events: AccessEvent[]; total_count: number; limit: number; offset: number; has_next: boolean; has_previous: boolean }
const pageSize = 25
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ClinicalAccessAuditPanel() {
  const router = useRouter()
  const captureAction = usePortalAction()
  const [fileInput, setFileInput] = useState('')
  const [fileId, setFileId] = useState('')
  const [validation, setValidation] = useState('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data: AccessHistory | null; error: string } | null>(null)
  const key = `${fileId}:${offset}:${revision}`
  const loading = result?.key !== key
  const data = loading ? null : result?.data
  const error = loading ? '' : result?.error

  useEffect(() => {
    let current = true
    const action = captureAction()
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    if (fileId) params.set('file_id', fileId)
    apiGet<AccessHistory>(`/api/v1/admin/audit-logs/clinical-access?${params}`)
      .then(history => {
        if (!current || !action.isCurrent()) return
        if (typeof history?.can_view !== 'boolean' || !Array.isArray(history.events)) throw new Error('Unexpected clinical access history response.')
        setResult({ key, data: history, error: '' })
      })
      .catch(failure => {
        if (!current || !action.isCurrent()) return
        if (isAuthError(failure)) { router.replace('/auth/admin/login'); return }
        setResult({ key, data: null, error: getApiErrorDetail(failure) || 'Unable to load clinical access history. Please retry.' })
      })
    return () => { current = false }
  }, [captureAction, fileId, key, offset, router])

  const applyFilter = (event: FormEvent) => {
    event.preventDefault()
    const value = fileInput.trim()
    if (value && !uuidPattern.test(value)) { setValidation('Enter a file ID in UUID format: 8-4-4-4-12 hexadecimal characters.'); return }
    setValidation(''); setFileId(value); setOffset(0); setRevision(number => number + 1)
  }

  return <section aria-labelledby='clinical-access-title' aria-busy={loading} className='rounded-2xl border border-theme bg-surface p-5 sm:p-6'>
    <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
      <div><h2 id='clinical-access-title' className='portal-h2'>Clinical access history</h2><p className='text-sm leading-6 text-muted'>Records issuance of short-lived lab-result links. It does not establish that a file was downloaded or clinically reviewed.</p></div>
      <PortalButton type='button' disabled={loading} onClick={() => setRevision(number => number + 1)}>Refresh clinical access</PortalButton>
    </div>
    {loading ? <p role='status' className='py-6 text-muted'>Loading clinical access history…</p>
      : error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-ink'>{error}</p><PortalButton type='button' onClick={() => setRevision(number => number + 1)}>Retry clinical access</PortalButton></div>
        : data?.can_view === false ? <p className='text-sm text-muted'>Clinical access history is available to platform owners and compliance administrators.</p>
          : data && <>
            <form onSubmit={applyFilter} className='mb-5 flex flex-wrap items-end gap-3'>
              <div className='min-w-0 flex-1'><label htmlFor='clinical-file-filter' className='mb-2 block text-sm font-semibold text-ink'>File ID (optional)</label><input id='clinical-file-filter' value={fileInput} onChange={event => setFileInput(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'clinical-file-filter-error' : 'clinical-file-filter-hint'} className='min-h-11 w-full rounded-xl border border-theme bg-canvas px-3 py-2 text-ink' />
                <p id='clinical-file-filter-hint' className='mt-2 text-xs text-muted'>UUID format. Leave empty to view all issued access links.</p>{validation && <p id='clinical-file-filter-error' role='alert' className='mt-2 text-sm text-ink'>{validation}</p>}
              </div><PortalButton type='submit'>Apply file filter</PortalButton>
            </form>
            {!data.events.length ? <div className='rounded-xl border border-theme bg-canvas p-5'><h3 className='portal-h3'>No access links recorded</h3><p className='text-sm text-muted'>{fileId ? 'No issued links match this file ID.' : 'Events appear when an authorized clinician requests access to a lab result.'}</p></div>
              : <div className='grid gap-3'>{data.events.map(entry => <article key={entry.id} aria-label='Lab result access event' className='min-w-0 rounded-xl border border-theme bg-canvas p-4'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'><time dateTime={entry.created_at ?? undefined} className='text-sm text-muted'>{entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Time unavailable'}</time><PortalBadge tone='info'>Access issued</PortalBadge></div>
                <dl className='grid min-w-0 gap-4 sm:grid-cols-2'>
                  {([['File', entry.file_id], ['Lab request', entry.lab_request_id], ['Clinician account', entry.actor_user_id], ['Patient account', entry.patient_user_id]] as const).map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-xs font-semibold text-muted'>{label}</dt><dd className='mt-1 break-all text-sm text-ink'>{value || 'Unavailable'}</dd></div>)}
                  <div><dt className='text-xs font-semibold text-muted'>Upload source</dt><dd className='mt-1 text-sm text-ink'>{entry.uploaded_by === 'patient' ? 'Patient upload' : entry.uploaded_by === 'care_team' ? 'Care-team upload' : 'Source unavailable'}</dd></div>
                  <div><dt className='text-xs font-semibold text-muted'>Link lifetime</dt><dd className='mt-1 text-sm text-ink'>{entry.expires_in ? `${entry.expires_in} seconds` : 'Unavailable'}</dd></div>
                </dl>
              </article>)}</div>}
            <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-muted'>Showing {data.events.length} of {data.total_count} events</p><div className='flex flex-wrap gap-2'><PortalButton type='button' disabled={!data.has_previous} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Previous access events</PortalButton><PortalButton type='button' disabled={!data.has_next} onClick={() => setOffset(value => value + pageSize)}>Next access events</PortalButton></div></div>
          </>}
  </section>
}

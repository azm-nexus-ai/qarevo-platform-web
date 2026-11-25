'use client'

import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { apiGet, getApiErrorDetail, getApiErrorRequestId, isAuthError } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import SupportReference from '@/components/ui/SupportReference'
import { PortalBadge, PortalButton } from '@/components/patient/PatientPortalPrimitives'

type HistoryKind = 'access' | 'publication' | 'document'
type ClinicalEvent = {
  id: string; created_at: string | null; actor_user_id: string | null; patient_user_id: string | null
  file_id?: string | null; lab_request_id?: string | null; provider_id?: string | null
  uploaded_by?: 'patient' | 'care_team' | 'unknown'; expires_in?: number | null
  action?: 'uploaded' | 'access_issued' | 'removed'; disposition?: 'inline' | 'attachment' | null
  record_id?: string | null; consultation_id?: string | null; revision?: number | null
  version?: number | null; published_at?: string | null
}
type ClinicalHistory = { can_view: boolean; events: ClinicalEvent[]; total_count: number; limit: number; offset: number; has_next: boolean; has_previous: boolean }
const pageSize = 25
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Endpoints and element ids per history type; visible text comes from the clinicalHistory messages. */
const definitions = {
  access: { endpoint: 'clinical-access', filter: 'file_id', prefix: 'clinical-access', fieldId: 'clinical-file-filter' },
  publication: { endpoint: 'clinical-publications', filter: 'consultation_id', prefix: 'clinical-publication', fieldId: 'clinical-consultation-filter' },
  document: { endpoint: 'patient-documents', filter: 'file_id', prefix: 'patient-document', fieldId: 'patient-document-filter' },
} as const
const subscribeAccount = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
const adminScope = () => readAccountScope('admin')

export default function ClinicalAccessAuditPanel() {
  const scope = useSyncExternalStore(subscribeAccount, adminScope, () => null)
  // Remount every account/session, clearing both history and sensitive ID filters.
  return scope ? <ClinicalHistoryContent key={scope} /> : null
}

function ClinicalHistoryContent() {
  const t = useTranslations('clinicalHistory'), dateLocale = useLocale().startsWith('de') ? 'de-DE' : undefined
  const displayId = (value: unknown) => typeof value === 'string' && uuidPattern.test(value) ? value : t('unavailable')
  const displayTime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(dateLocale) : t('timeUnavailable')
  const documentActionLabel = (value: unknown) => value === 'uploaded' ? t('docUploaded') : value === 'access_issued' ? t('docAccess') : value === 'removed' ? t('docRemoved') : t('docUnknown')
  const displayLifetime = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 3600 ? t('seconds', { count: value }) : t('unavailable')
  const router = useRouter()
  const captureAction = usePortalAction()
  const [kind, setKind] = useState<HistoryKind>('access')
  const [filterInput, setFilterInput] = useState('')
  const [filterId, setFilterId] = useState('')
  const [validation, setValidation] = useState('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data: ClinicalHistory | null; error: string; requestId: string | null } | null>(null)
  const config = { ...definitions[kind], title: t(`${kind}.title`), label: t(`${kind}.label`), action: t(`${kind}.action`), item: t(`${kind}.item`), description: t(`${kind}.description`), empty: t(`${kind}.empty`), emptyDescription: t(`${kind}.emptyDescription`) }
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
        if (typeof history?.can_view !== 'boolean' || !Array.isArray(history.events)) throw new Error(t('unexpected'))
        setResult({ key, data: history, error: '', requestId: null })
      })
      .catch(failure => {
        if (!current || !action.isCurrent()) return
        if (isAuthError(failure)) { router.replace('/auth/admin/login'); return }
        setResult({ key, data: null, error: getApiErrorDetail(failure) || t('loadFailed'), requestId: getApiErrorRequestId(failure) })
      })
    return () => { current = false }
  }, [captureAction, config.endpoint, config.filter, filterId, key, offset, router, t])

  const applyFilter = (event: FormEvent) => {
    event.preventDefault()
    const value = filterInput.trim()
    if (value && !uuidPattern.test(value)) { setValidation(t(`${kind}.uuidError`)); return }
    setValidation(''); setFilterId(value); setOffset(0); setRevision(number => number + 1)
  }
  const changeKind = (next: HistoryKind) => {
    if (!Object.hasOwn(definitions, next)) return
    setKind(next); setFilterInput(''); setFilterId(''); setValidation(''); setOffset(0)
  }

  return <section aria-labelledby={config.prefix + '-title'} aria-busy={loading} className='rounded-2xl border border-theme bg-surface p-5 sm:p-6'>
    <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
      <div><h2 id={config.prefix + '-title'} className='portal-h2'>{config.title}</h2><p className='text-sm leading-6 text-muted'>{config.description}</p></div>
      <PortalButton type='button' disabled={loading} onClick={() => setRevision(number => number + 1)}>{t('refresh', { action: config.action })}</PortalButton>
    </div>
    <div className='mb-5 max-w-md'><label htmlFor='clinical-history-kind' className='mb-2 block text-sm font-semibold text-ink'>{t('typeLabel')}</label>
      <select id='clinical-history-kind' value={kind} disabled={data?.can_view === false} onChange={event => changeKind(event.target.value as HistoryKind)} className='min-h-11 w-full rounded-xl border border-theme bg-canvas px-3 py-2 text-ink'>
        <option value='access'>{t('typeAccess')}</option><option value='publication'>{t('typePublication')}</option><option value='document'>{t('typeDocument')}</option>
      </select>
    </div>
    {loading ? <p role='status' className='py-6 text-muted'>{t(`${kind}.loading`)}</p>
      : error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-ink'>{error}</p><SupportReference requestId={result?.requestId} /><PortalButton type='button' onClick={() => setRevision(number => number + 1)}>{t('retry', { action: config.action })}</PortalButton></div>
        : data?.can_view === false ? <p className='text-sm text-muted'>{t('ownersOnly', { title: config.title })}</p>
          : data && <>
            <form onSubmit={applyFilter} className='mb-5 flex flex-wrap items-end gap-3'>
              <div className='min-w-0 flex-1'><label htmlFor={config.fieldId} className='mb-2 block text-sm font-semibold text-ink'>{t(`${kind}.idLabel`)}</label><input id={config.fieldId} value={filterInput} onChange={event => setFilterInput(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={config.fieldId + (validation ? '-error' : '-hint')} className='min-h-11 w-full rounded-xl border border-theme bg-canvas px-3 py-2 text-ink' />
                <p id={config.fieldId + '-hint'} className='mt-2 text-xs text-muted'>{t(`${kind}.idHint`)}</p>{validation && <p id={config.fieldId + '-error'} role='alert' className='mt-2 text-sm text-ink'>{validation}</p>}
              </div><PortalButton type='submit'>{t(`${kind}.apply`)}</PortalButton>
            </form>
            {!data.events.length ? <div className='rounded-xl border border-theme bg-canvas p-5'><h3 className='portal-h3'>{config.empty}</h3><p className='text-sm text-muted'>{filterId ? t(`${kind}.noMatch`) : config.emptyDescription}</p></div>
              : <div className='grid gap-3'>{data.events.map(entry => <article key={entry.id} aria-label={t(`${kind}.eventLabel`)} className='min-w-0 rounded-xl border border-theme bg-canvas p-4'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'><time dateTime={entry.created_at ?? undefined} className='text-sm text-muted'>{displayTime(entry.created_at)}</time><PortalBadge tone={kind === 'document' && entry.action === 'removed' ? 'neutral' : 'info'}>{kind === 'access' ? t('accessIssued') : kind === 'document' ? documentActionLabel(entry.action) : entry.revision && entry.revision > 1 ? t('amendmentPublished') : t('summaryPublished')}</PortalBadge></div>
                <dl className='grid min-w-0 gap-4 sm:grid-cols-2'>
                  {(kind === 'access' ? [[t('fieldFile'), entry.file_id], [t('fieldLabRequest'), entry.lab_request_id], [t('fieldClinician'), entry.actor_user_id], [t('fieldPatient'), entry.patient_user_id]]
                    : kind === 'document' ? [[t('fieldFile'), entry.file_id], [t('fieldActor'), entry.actor_user_id], [t('fieldPatient'), entry.patient_user_id]]
                    : [[t('fieldRecord'), entry.record_id], [t('fieldConsultation'), entry.consultation_id], [t('fieldClinician'), entry.actor_user_id], [t('fieldPatient'), entry.patient_user_id]]).map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-xs font-semibold text-muted'>{label}</dt><dd className='mt-1 break-all text-sm text-ink'>{displayId(value)}</dd></div>)}
                  {kind === 'access' || kind === 'document' && entry.action === 'access_issued' ? <>
                    <div><dt className='text-xs font-semibold text-muted'>{t('uploadSource')}</dt><dd className='mt-1 text-sm text-ink'>{entry.uploaded_by === 'patient' ? t('patientUpload') : entry.uploaded_by === 'care_team' ? t('careTeamUpload') : t('sourceUnavailable')}</dd></div>
                    <div><dt className='text-xs font-semibold text-muted'>{t('linkLifetime')}</dt><dd className='mt-1 text-sm text-ink'>{displayLifetime(entry.expires_in)}</dd></div>
                    {kind === 'document' && <div><dt className='text-xs font-semibold text-muted'>{t('linkPurpose')}</dt><dd className='mt-1 text-sm text-ink'>{entry.disposition === 'inline' ? t('previewLink') : entry.disposition === 'attachment' ? t('attachmentLink') : t('unavailable')}</dd></div>}
                  </> : kind === 'publication' ? <>
                    <div><dt className='text-xs font-semibold text-muted'>{t('publishedRevision')}</dt><dd className='mt-1 text-sm text-ink'>{entry.revision ?? t('unavailable')}</dd></div>
                    <div><dt className='text-xs font-semibold text-muted'>{t('publishedAt')}</dt><dd className='mt-1 text-sm text-ink'>{displayTime(entry.published_at)}</dd></div>
                  </> : null}
                </dl>
              </article>)}</div>}
            <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-muted'>{t('showing', { shown: data.events.length, total: data.total_count })}</p><div className='flex flex-wrap gap-2'><PortalButton type='button' disabled={!data.has_previous} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>{t('previous', { item: config.item })}</PortalButton><PortalButton type='button' disabled={!data.has_next} onClick={() => setOffset(value => value + pageSize)}>{t('next', { item: config.item })}</PortalButton></div></div>
          </>}
  </section>
}

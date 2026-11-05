'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getApiErrorDetail, getDoctorEpisodes, getDoctorWorkspace, isAuthError, type DoctorEpisodeListResponse, type DoctorWorkspaceResponse } from '@/lib/api'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { PortalBadge, PortalButton } from '@/components/patient/PatientPortalPrimitives'

type PageMetadata = { page: number; filtered_count: number; has_previous: boolean; has_next: boolean }
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled'
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PT'
}
function QueueSection({ id, title, description, loading, error, retry, children }: { id: string; title: string; description?: string; loading: boolean; error: string; retry: () => void; children: ReactNode }) {
  return <section aria-labelledby={id} aria-busy={loading} className='rounded-2xl border border-theme bg-surface p-5 sm:p-6'>
    <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
      <div><h2 id={id} className='portal-h2'>{title}</h2>{description && <p className='text-sm text-muted'>{description}</p>}</div>
      <PortalButton disabled={loading} onClick={retry}>Refresh {title.toLowerCase()}</PortalButton>
    </div>
    {loading ? <p role='status' className='py-8 text-center text-muted'>Loading {title.toLowerCase()}…</p>
      : error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-5 text-ink'><p>{error}</p><PortalButton onClick={retry}>Retry {title.toLowerCase()}</PortalButton></div>
      : children}
  </section>
}
function Pagination({ data, count, name, onPage }: { data: PageMetadata; count: number; name: string; onPage: (page: number) => void }) {
  return <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'>
    <p className='text-sm text-muted'>Page {data.page} · Showing {count} of {data.filtered_count}</p>
    <div className='flex gap-2'><PortalButton disabled={!data.has_previous} onClick={() => onPage(Math.max(1, data.page - 1))}>Previous {name}</PortalButton><PortalButton disabled={!data.has_next} onClick={() => onPage(data.page + 1)}>Next {name}</PortalButton></div>
  </div>
}

export default function PhysicianWorkspace() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<{key: string; data: DoctorWorkspaceResponse | null; error: string} | null>(null)
  const [episodes, setEpisodes] = useState<{key: string; data: DoctorEpisodeListResponse | null; error: string} | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [consultationPage, setConsultationPage] = useState(1)
  const [episodePage, setEpisodePage] = useState(1)
  const [consultationReload, setConsultationReload] = useState(0)
  const [episodeReload, setEpisodeReload] = useState(0)
  const consultationKey = `${statusFilter}:${consultationPage}:${consultationReload}`
  const episodeKey = `${episodePage}:${episodeReload}`
  const loading = workspace?.key !== consultationKey
  const episodesLoading = episodes?.key !== episodeKey
  const workspaceData = workspace?.data
  const episodeData = episodes?.data
  const error = loading ? '' : workspace?.error ?? ''
  const episodeError = episodesLoading ? '' : episodes?.error ?? ''
  const pageSize = 10

  useEffect(() => {
    let current = true
    getDoctorWorkspace(statusFilter || undefined, { page: consultationPage, page_size: pageSize })
      .then(data => { if (current) setWorkspace({key: consultationKey, data, error: ''}) })
      .catch(failure => {
        if (!current) return
        if (isAuthError(failure)) { router.replace('/auth/doctor/login'); return }
        setWorkspace(previous => ({key: consultationKey, data: previous?.data ?? null, error: getApiErrorDetail(failure) || 'Unable to load consultations. Please retry.'}))
      })
    return () => { current = false }
  }, [router, statusFilter, consultationPage, consultationKey])

  useEffect(() => {
    let current = true
    // CWS episodes have a separate lifecycle. A consultation status must never
    // be sent as an episode filter or hide unrelated assigned clinical work.
    getDoctorEpisodes(undefined, { page: episodePage, page_size: pageSize })
      .then(data => { if (current) setEpisodes({key: episodeKey, data, error: ''}) })
      .catch(failure => {
        if (!current) return
        if (isAuthError(failure)) { router.replace('/auth/doctor/login'); return }
        setEpisodes(previous => ({key: episodeKey, data: previous?.data ?? null, error: getApiErrorDetail(failure) || 'Unable to load assigned episodes. Please retry.'}))
      })
    return () => { current = false }
  }, [router, episodePage, episodeKey])

  const options = workspaceData?.status_options ?? []
  const selectedLabel = options.find(option => option.value === statusFilter)?.label
  const cards: [string, number | null | undefined][] = [
    ['Total consultations', workspaceData?.total_count],
    ['Filtered consultations', loading ? null : workspaceData?.filtered_count],
    ['In-progress consultations', workspaceData?.active_consultation_count],
    ['Assigned episodes', episodeData?.total_count],
  ]
  return <div className='space-y-6'>
    <header className='flex flex-wrap items-end justify-between gap-4'>
      <div className='min-w-0'><h1 className='text-2xl font-bold text-ink'>Physician Workspace</h1><p className='mt-1 text-sm text-muted'>Consultations and assigned clinical episodes</p></div>
      <div className='grid gap-2'><label htmlFor='consultation-status-filter' className='text-sm font-semibold text-secondary'>Consultation status</label>
        <select id='consultation-status-filter' value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setConsultationPage(1) }} className='min-h-11 rounded-xl border border-theme bg-surface px-4 py-2 text-ink'>
          <option value=''>All statuses</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </header>
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>{cards.map(([label, count]) => <div key={label} className='rounded-xl border border-theme bg-surface p-5'><p className='text-sm font-medium text-secondary'>{label}</p><p className='mt-2 text-3xl font-bold text-ink'>{count ?? '—'}</p></div>)}</div>

    <QueueSection id='consultations-title' title='Consultations' loading={loading} error={error} retry={() => setConsultationReload(value => value + 1)}>
      {!workspaceData?.consultations.length ? <div className='py-8 text-center'><h3 className='portal-h3'>{statusFilter ? `No ${selectedLabel?.toLowerCase() || 'matching'} consultations` : 'No consultations assigned'}</h3><p className='text-muted'>{statusFilter ? 'Choose All statuses to see your complete consultation history.' : 'Assigned consultations will appear here when booked.'}</p></div>
        : <div className='grid gap-3'>{workspaceData.consultations.map(consultation => <button key={consultation.consultation_id} type='button' onClick={() => router.push(`/doctor/workspace/${consultation.consultation_id}`)} className='flex w-full flex-col items-start justify-between gap-4 rounded-xl border border-theme bg-canvas p-4 text-left transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center'>
          <span className='flex min-w-0 items-center gap-3'><span aria-hidden className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-subtle font-semibold text-ink'>{initials(consultation.patient_name)}</span>
            <span className='min-w-0'><span className='block font-semibold text-ink'>{consultation.patient_name}</span><span className='block text-sm text-muted'>{formatDate(consultation.scheduled_time)}</span>{consultation.waiting_duration_minutes !== null && <span className='mt-1 block text-xs text-secondary'>Waiting {consultation.waiting_duration_minutes} min</span>}</span>
          </span><span className='flex shrink-0 items-center gap-3'><ClinicalStatusBadge status={consultation.status} domain='consultation' /><span aria-hidden className='text-muted'>→</span></span>
        </button>)}</div>}
      {workspaceData && <Pagination data={workspaceData} count={workspaceData.consultations.length} name='consultations' onPage={setConsultationPage} />}
    </QueueSection>

    <QueueSection id='clinical-episodes-title' title='Clinical workflow episodes' description='Assigned episodes use a separate clinical lifecycle and are independent of the consultation filter.' loading={episodesLoading} error={episodeError} retry={() => setEpisodeReload(value => value + 1)}>
      {!episodeData?.episodes.length ? <p className='py-8 text-center text-muted'>No assigned episodes found.</p>
        : <div className='grid gap-3'>{episodeData.episodes.map(episode => <button key={episode.episode_id} type='button' onClick={() => router.push(`/doctor/episodes/${episode.episode_id}`)} className='flex w-full flex-col items-start justify-between gap-4 rounded-xl border border-theme bg-canvas p-4 text-left transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center'>
          <span className='flex min-w-0 items-center gap-3'><span aria-hidden className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-subtle font-semibold text-ink'>{initials(episode.patient.name)}</span><span className='min-w-0'><span className='block font-semibold text-ink'>{episode.patient.name}</span><span className='block text-sm text-muted'>{episode.chief_complaint || episode.status.replaceAll('_', ' ')}</span>{episode.intake_submitted_at && <span className='mt-1 block text-xs text-secondary'>Intake submitted: {formatDate(episode.intake_submitted_at)}</span>}</span></span>
          <span className='flex flex-wrap items-center gap-2'><PortalBadge tone={episode.ai_draft_ready ? 'success' : 'neutral'}>{episode.ai_draft_ready ? 'AI draft ready' : episode.latest_ai_job_status?.replaceAll('_', ' ') || 'No AI draft'}</PortalBadge><ClinicalStatusBadge status={episode.status} domain='episode' /><span aria-hidden className='text-muted'>→</span></span>
        </button>)}</div>}
      {episodeData && <Pagination data={episodeData} count={episodeData.episodes.length} name='episodes' onPage={setEpisodePage} />}
    </QueueSection>
  </div>
}

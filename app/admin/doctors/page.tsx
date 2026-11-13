'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalResource } from '@/lib/use-portal-resource'
import { clinicianPage, clinicianPagePath, type ClinicianRow } from '@/lib/admin-clinicians'
import DoctorReviewDialog from '@/components/admin/DoctorReviewDialog'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import { PortalBadge, PortalButton, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import SupportReference from '@/components/ui/SupportReference'

type Tab = 'all' | 'pending'
const readScope = () => readAccountScope('admin')
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}

function DoctorCard({ doctor, onView, canReview }: { doctor: ClinicianRow; onView: (id: string) => void; canReview: boolean }) {
  const access = doctor.clinical_access
  const tone = doctor.status === 'ACTIVE' ? 'success' : ['SUSPENDED', 'REJECTED', 'DEACTIVATED'].includes(doctor.status) ? 'danger' : 'warning'
  return <article className='admin-doctor-card flex min-w-0 flex-col gap-5 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between' aria-label={doctor.full_name}>
    <div className='flex min-w-0 flex-1 items-start gap-4'><ProfileAvatar name={doctor.full_name} kind='doctor' size={48} />
      <div className='min-w-0 flex-1 break-words'><h2 className='text-base font-semibold text-ink'>{doctor.full_name}</h2>
        <p className='mt-1 break-all text-sm text-secondary'>{doctor.email}</p><p className='mt-2 text-sm leading-6 text-secondary'>{doctor.specialty || 'Specialty not provided'}{doctor.phone ? ` · ${doctor.phone}` : ''}</p>
        <dl className='mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm'>
          <div><dt className='mb-1 text-muted'>Account status</dt><dd><PortalBadge tone={tone}>{doctor.status.replaceAll('_', ' ').toUpperCase()}</PortalBadge></dd></div>
          <div><dt className='mb-1 text-muted'>Clinical access</dt><dd><PortalBadge tone={access?.status === 'enabled' ? 'success' : 'warning'}>{access?.status === 'enabled' ? 'Enabled' : access?.status === 'blocked' ? 'Blocked' : 'Not assessed'}</PortalBadge></dd></div>
        </dl><p className='mt-3 text-sm leading-6 text-secondary'>{access?.message || 'Open the review to check clinical eligibility.'}</p>
      </div></div>
    <div className='admin-doctor-actions flex flex-wrap items-center gap-3'><PortalButton type='button' onClick={() => onView(doctor.provider_id)}>View</PortalButton>
      {canReview && <PortalButton type='button' tone='primary' onClick={() => onView(doctor.provider_id)}>Verify</PortalButton>}</div>
  </article>
}

export default function AdminDoctorsPage() {
  const pathname = usePathname(), scope = useSyncExternalStore(subscribe, readScope, () => null)
  return <ClinicianRoster key={JSON.stringify([scope, pathname])} scope={scope} pathname={pathname} />
}

function ClinicianRoster({ scope, pathname }: { scope: string | null; pathname: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('all'), [allPage, setAllPage] = useState({ limit: 25, offset: 0 }), [pendingPage, setPendingPage] = useState({ limit: 25, offset: 0 })
  const [searchDraft, setSearchDraft] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const [selected, setSelected] = useState<{ providerId: string; context: object } | null>(null), [notice, setNotice] = useState('')
  const all = usePortalResource<unknown>(scope ? clinicianPagePath('all', allPage, search, status) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const pending = usePortalResource<unknown>(scope ? clinicianPagePath('pending', pendingPage, search) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const allData = useMemo(() => clinicianPage(all.data, allPage), [all.data, allPage]), pendingData = useMemo(() => clinicianPage(pending.data, pendingPage), [pending.data, pendingPage])
  if (allData?.paginated && allData.offset !== allPage.offset) { setAllPage({ ...allPage, offset: allData.offset }); setNotice('The clinician list changed. Showing the nearest available page.') }
  if (pendingData?.paginated && pendingData.offset !== pendingPage.offset) { setPendingPage({ ...pendingPage, offset: pendingData.offset }); setNotice('The pending queue changed. Showing the nearest available page.') }
  const resource = activeTab === 'all' ? all : pending, data = activeTab === 'all' ? allData : pendingData
  const page = activeTab === 'all' ? allPage : pendingPage, setPage = activeTab === 'all' ? setAllPage : setPendingPage
  const busy = resource.refreshing || searchDraft.trim() !== search, invalid = resource.data !== null && !data
  const loadError = resource.error ? resource.errorMessage : invalid ? 'The clinician list returned an invalid response. Refresh the list before continuing.' : ''
  const context = useMemo(() => ({ scope, pathname, activeTab, page, searchDraft, search, status, permission: data?.canReview ?? false }), [scope, pathname, activeTab, page, searchDraft, search, status, data?.canReview])
  const latestContext = useRef(context), changingPage = useRef(false), focusPage = useRef(false), pageStatus = useRef<HTMLParagraphElement>(null)
  const current = () => Boolean(scope && latestContext.current === context && readScope() === scope && currentPortal() === 'admin' && window.location.pathname === pathname)
  useLayoutEffect(() => { latestContext.current = context; changingPage.current = false }, [context])
  useEffect(() => {
    const timer = setTimeout(() => { const normalized = searchDraft.trim(); if (normalized === search) return
      setAllPage(value => ({ ...value, offset: 0 })); setPendingPage(value => ({ ...value, offset: 0 })); setSearch(normalized)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchDraft, search])
  useEffect(() => { if (!busy && focusPage.current) { pageStatus.current?.focus(); focusPage.current = false } }, [busy, page])
  const changeTab = (tab: Tab) => { if (!current() || activeTab === tab || changingPage.current) return; changingPage.current = true; setSelected(null); setNotice(''); setActiveTab(tab) }
  const navigate = (direction: 'previous' | 'next' | 'first') => {
    if (!current() || busy || changingPage.current || (direction === 'next' && !data?.hasNext) || (direction !== 'next' && page.offset === 0)) return
    changingPage.current = true; focusPage.current = true; setSelected(null); setNotice('')
    setPage({ ...page, offset: direction === 'first' ? 0 : direction === 'next' ? page.offset + page.limit : Math.max(0, page.offset - page.limit) })
  }
  const refresh = () => { if (!current() || changingPage.current) return; setSelected(null); all.retry(); pending.retry() }
  const review = (providerId: string) => { if (!current() || busy || changingPage.current || !data?.doctors.some(doctor => doctor.provider_id === providerId)) return; setSelected({ providerId, context }) }
  const closeReview = (saved: boolean) => { if (!current()) return; setSelected(null); if (saved) setNotice('Clinician decision saved. The clinician list and pending queue are being refreshed.'); all.retry(); pending.retry() }
  const title = activeTab === 'all' ? 'clinicians' : 'pending verifications'
  const countLabel = (kind: Tab) => { const source = kind === 'all' ? all : pending, result = kind === 'all' ? allData : pendingData; return source.error ? 'unavailable' : result?.total === null ? 'total unavailable' : result?.total ?? '…' }
  return <section aria-labelledby='clinician-roster-title' className='flex min-w-0 flex-col gap-5'>
    <header className='flex flex-wrap items-start justify-between gap-4'><div><h1 id='clinician-roster-title' className='text-3xl font-extrabold tracking-tight text-ink'>Doctors Management</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>Review clinician credentials and account status. An active account still needs clinical approval before it can provide care.</p></div>
      <PortalButton type='button' onClick={refresh} disabled={busy}>Refresh clinician lists</PortalButton></header>
    <nav aria-label='Clinician queues' className='flex flex-wrap gap-3 border-b border-theme pb-4'>
      <PortalButton type='button' aria-pressed={activeTab === 'all'} tone={activeTab === 'all' ? 'primary' : 'secondary'} onClick={() => changeTab('all')}>All Doctors ({countLabel('all')})</PortalButton>
      <PortalButton type='button' aria-pressed={activeTab === 'pending'} tone={activeTab === 'pending' ? 'primary' : 'secondary'} onClick={() => changeTab('pending')}>Pending Verification ({countLabel('pending')})</PortalButton></nav>
    <div className='admin-doctor-filters flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end'><div className='min-w-0 flex-1'><label htmlFor='clinician-search' className='mb-2 block text-sm font-semibold text-ink'>Search clinicians</label>
      <input id='clinician-search' type='search' maxLength={200} placeholder='Search doctors...' value={searchDraft} onChange={event => { setSelected(null); setNotice(''); setSearchDraft(event.target.value) }} className='min-h-11 w-full min-w-0 rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink' /></div>
      {activeTab === 'all' && <div className='min-w-0 sm:w-60'><label htmlFor='clinician-status' className='mb-2 block text-sm font-semibold text-ink'>Filter clinicians by status</label>
        <select id='clinician-status' value={status} disabled={!allData?.statusOptions.length} onChange={event => { if (!current() || event.target.value === status) return; changingPage.current = true; setSelected(null); setNotice(''); setAllPage(value => ({ ...value, offset: 0 })); setStatus(event.target.value) }} className='min-h-11 w-full min-w-0 rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink'>
          <option value=''>All Status</option>{allData?.statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}</div>
    <nav aria-label='Clinician list pages' className='flex flex-wrap items-center gap-3'>
      <p ref={pageStatus} tabIndex={-1} role='status' aria-label='Clinician list page' aria-live='polite' className='text-sm leading-6 text-secondary'>Page {Math.floor(page.offset / page.limit) + 1}{busy ? ' · Loading doctors...' : data?.total !== null && data ? ` · ${data.total} ${title}` : ''}</p>
      <PortalButton type='button' disabled={busy || page.offset === 0} onClick={() => navigate('previous')}>Previous {title}</PortalButton>
      <PortalButton type='button' disabled={busy || !data?.hasNext} onClick={() => navigate('next')}>Next {title}</PortalButton>
      {page.offset > 0 && <PortalButton type='button' disabled={busy} onClick={() => navigate('first')}>First page</PortalButton>}
      <label className='flex min-w-0 items-center gap-2 text-sm text-secondary'>Per page<select aria-label='Clinicians per page' value={page.limit} disabled={busy} onChange={event => { const limit = Number(event.target.value); if (!current() || ![25, 50].includes(limit) || limit === page.limit) return; changingPage.current = true; setSelected(null); setPage({ limit, offset: 0 }) }} className='min-h-11 rounded-xl border border-theme bg-surface px-3 py-2 text-ink'><option value={25}>25</option><option value={50}>50</option></select></label></nav>
    {notice && <p role='status' className='rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6 text-ink'>{notice}</p>}
    {loadError && <div role='alert' aria-label='Clinician list error' className='rounded-xl border border-theme bg-surface-subtle p-5 text-sm leading-6 text-ink'><p>{loadError}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={refresh}>Retry clinician list</PortalButton></div>}
    {busy && <p role='status' className='py-5 text-sm text-secondary'>Loading doctors...</p>}
    {!busy && !loadError && data && <>
      {data.paginated && data.doctors.length > 0 && <p className='text-sm text-secondary'>Showing {data.offset + 1}–{data.offset + data.doctors.length} of {data.total} {title}.</p>}
      {!data.paginated && <p className='text-sm leading-6 text-secondary'>This service returned only a bounded first-page view. Complete pagination could not be confirmed. Refresh after the service update; no further pages are assumed.</p>}
      {!data.canReview && <p className='text-sm leading-6 text-secondary'>You can inspect clinician details. Recording decisions requires current super administrator or operations administrator permission.</p>}
      {!data.doctors.length ? <PortalEmptyState title={activeTab === 'all' ? 'No doctors found' : 'No pending verifications'} description={search ? 'Try a different search or clear the filters.' : activeTab === 'all' ? 'Clinician accounts will appear here after registration.' : 'No applications are awaiting review on this page.'} />
        : <div className='flex min-w-0 flex-col gap-3'>{data.doctors.map(doctor => <DoctorCard key={doctor.provider_id} doctor={doctor} onView={review} canReview={activeTab === 'pending' && data.canReview} />)}</div>}
    </>}
    {selected?.context === context && data?.doctors.some(doctor => doctor.provider_id === selected.providerId) && <DoctorReviewDialog key={selected.providerId} providerId={selected.providerId} onClose={() => closeReview(false)} onSaved={() => closeReview(true)} />}
  </section>
}

'use client'

import { useTranslations } from 'next-intl'
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

/** API codes (PENDING_VERIFICATION) become message keys (pendingVerification). */
const codeKey = (code: string) => code.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

function DoctorCard({ doctor, onView, canReview }: { doctor: ClinicianRow; onView: (id: string) => void; canReview: boolean }) {
  const t = useTranslations('adminDoctors');
  const access = doctor.clinical_access
  const tone = doctor.status === 'ACTIVE' ? 'success' : ['SUSPENDED', 'REJECTED', 'DEACTIVATED'].includes(doctor.status) ? 'danger' : 'warning'
  return <article className='admin-doctor-card flex min-w-0 flex-col gap-5 rounded-2xl border border-theme bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between' aria-label={doctor.full_name}>
    <div className='flex min-w-0 flex-1 items-start gap-4'><ProfileAvatar name={doctor.full_name} kind='doctor' size={48} />
      <div className='min-w-0 flex-1 break-words'><h2 className='text-base font-semibold text-ink'>{doctor.full_name}</h2>
        <p className='mt-1 break-all text-sm text-secondary'>{doctor.email}</p><p className='mt-2 text-sm leading-6 text-secondary'>{doctor.specialty || t('specialtyMissing')}{doctor.phone ? ` · ${doctor.phone}` : ''}</p>
        <dl className='mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm'>
          <div><dt className='mb-1 text-muted'>{t('accountStatus')}</dt><dd><PortalBadge tone={tone}>{t.has(`accountStatusLabel.${codeKey(doctor.status)}`) ? t(`accountStatusLabel.${codeKey(doctor.status)}`) : doctor.status.replaceAll('_', ' ')}</PortalBadge></dd></div>
          <div><dt className='mb-1 text-muted'>{t('clinicalAccess')}</dt><dd><PortalBadge tone={access?.status === 'enabled' ? 'success' : 'warning'}>{access?.status === 'enabled' ? t('accessEnabled') : access?.status === 'blocked' ? t('accessBlocked') : t('accessNotAssessed')}</PortalBadge></dd></div>
        </dl><p className='mt-3 text-sm leading-6 text-secondary'>{access?.message || t('accessHint')}</p>
      </div></div>
    <div className='admin-doctor-actions flex flex-wrap items-center gap-3'><PortalButton type='button' onClick={() => onView(doctor.provider_id)}>{t('view')}</PortalButton>
      {canReview && <PortalButton type='button' tone='primary' onClick={() => onView(doctor.provider_id)}>{t('verify')}</PortalButton>}</div>
  </article>
}

export default function AdminDoctorsPage() {
  const pathname = usePathname(), scope = useSyncExternalStore(subscribe, readScope, () => null)
  return <ClinicianRoster key={JSON.stringify([scope, pathname])} scope={scope} pathname={pathname} />
}

function ClinicianRoster({ scope, pathname }: { scope: string | null; pathname: string }) {
  const t = useTranslations('adminDoctors');
  const [activeTab, setActiveTab] = useState<Tab>('all'), [allPage, setAllPage] = useState({ limit: 25, offset: 0 }), [pendingPage, setPendingPage] = useState({ limit: 25, offset: 0 })
  const [searchDraft, setSearchDraft] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const [selected, setSelected] = useState<{ providerId: string; context: object } | null>(null), [notice, setNotice] = useState('')
  const all = usePortalResource<unknown>(scope ? clinicianPagePath('all', allPage, search, status) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const pending = usePortalResource<unknown>(scope ? clinicianPagePath('pending', pendingPage, search) : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const allData = useMemo(() => clinicianPage(all.data, allPage), [all.data, allPage]), pendingData = useMemo(() => clinicianPage(pending.data, pendingPage), [pending.data, pendingPage])
  if (allData?.paginated && allData.offset !== allPage.offset) { setAllPage({ ...allPage, offset: allData.offset }); setNotice(t('listChanged')) }
  if (pendingData?.paginated && pendingData.offset !== pendingPage.offset) { setPendingPage({ ...pendingPage, offset: pendingData.offset }); setNotice(t('queueChanged')) }
  const resource = activeTab === 'all' ? all : pending, data = activeTab === 'all' ? allData : pendingData
  const page = activeTab === 'all' ? allPage : pendingPage, setPage = activeTab === 'all' ? setAllPage : setPendingPage
  const busy = resource.refreshing || searchDraft.trim() !== search, invalid = resource.data !== null && !data
  const loadError = resource.error ? resource.errorMessage : invalid ? t('invalidList') : ''
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
  const closeReview = (saved: boolean) => { if (!current()) return; setSelected(null); if (saved) setNotice(t('decisionSaved')); all.retry(); pending.retry() }
  const title = activeTab === 'all' ? t('titleClinicians') : t('titlePending')
  const countLabel = (kind: Tab) => { const source = kind === 'all' ? all : pending, result = kind === 'all' ? allData : pendingData; return source.error ? t('countUnavailable') : result?.total === null ? t('totalUnavailable') : result?.total ?? '…' }
  return <section aria-labelledby='clinician-roster-title' className='flex min-w-0 flex-col gap-5'>
    <header className='flex flex-wrap items-start justify-between gap-4'><div><h1 id='clinician-roster-title' className='text-3xl font-extrabold tracking-tight text-ink'>{t('doctorsManagement')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('reviewClinicianCredentialsAndAccount')}</p></div>
      <PortalButton type='button' onClick={refresh} disabled={busy}>{t('refreshClinicianLists')}</PortalButton></header>
    <nav aria-label={t('clinicianQueues')} className='flex flex-wrap gap-3 border-b border-theme pb-4'>
      <PortalButton type='button' aria-pressed={activeTab === 'all'} tone={activeTab === 'all' ? 'primary' : 'secondary'} onClick={() => changeTab('all')}>{t('tabAll', { count: String(countLabel('all')) })}</PortalButton>
      <PortalButton type='button' aria-pressed={activeTab === 'pending'} tone={activeTab === 'pending' ? 'primary' : 'secondary'} onClick={() => changeTab('pending')}>{t('tabPending', { count: String(countLabel('pending')) })}</PortalButton></nav>
    <div className='admin-doctor-filters flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end'><div className='min-w-0 flex-1'><label htmlFor='clinician-search' className='mb-2 block text-sm font-semibold text-ink'>{t('searchClinicians')}</label>
      <input id='clinician-search' type='search' maxLength={200} placeholder={t('searchDoctors')} value={searchDraft} onChange={event => { setSelected(null); setNotice(''); setSearchDraft(event.target.value) }} className='min-h-11 w-full min-w-0 rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink' /></div>
      {activeTab === 'all' && <div className='min-w-0 sm:w-60'><label htmlFor='clinician-status' className='mb-2 block text-sm font-semibold text-ink'>{t('filterCliniciansByStatus')}</label>
        <select id='clinician-status' value={status} disabled={!allData?.statusOptions.length} onChange={event => { if (!current() || event.target.value === status) return; changingPage.current = true; setSelected(null); setNotice(''); setAllPage(value => ({ ...value, offset: 0 })); setStatus(event.target.value) }} className='min-h-11 w-full min-w-0 rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink'>
          <option value=''>{t('allStatus')}</option>{allData?.statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}</div>
    <nav aria-label={t('clinicianListPages')} className='flex flex-wrap items-center gap-3'>
      <p ref={pageStatus} tabIndex={-1} role='status' aria-label={t('clinicianListPage')} aria-live='polite' className='text-sm leading-6 text-secondary'>{t('pageNumber', { page: Math.floor(page.offset / page.limit) + 1 })}{busy ? ` · ${t('loadingDoctors')}` : data?.total !== null && data ? ` · ${data.total} ${title}` : ''}</p>
      <PortalButton type='button' disabled={busy || page.offset === 0} onClick={() => navigate('previous')}>{t('previous', { title })}</PortalButton>
      <PortalButton type='button' disabled={busy || !data?.hasNext} onClick={() => navigate('next')}>{t('next', { title })}</PortalButton>
      {page.offset > 0 && <PortalButton type='button' disabled={busy} onClick={() => navigate('first')}>{t('firstPage')}</PortalButton>}
      <label className='flex min-w-0 items-center gap-2 text-sm text-secondary'>{t('perPage')}<select aria-label={t('cliniciansPerPage')} value={page.limit} disabled={busy} onChange={event => { const limit = Number(event.target.value); if (!current() || ![25, 50].includes(limit) || limit === page.limit) return; changingPage.current = true; setSelected(null); setPage({ limit, offset: 0 }) }} className='min-h-11 rounded-xl border border-theme bg-surface px-3 py-2 text-ink'><option value={25}>25</option><option value={50}>50</option></select></label></nav>
    {notice && <p role='status' className='rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-6 text-ink'>{notice}</p>}
    {loadError && <div role='alert' aria-label={t('clinicianListError')} className='rounded-xl border border-theme bg-surface-subtle p-5 text-sm leading-6 text-ink'><p>{loadError}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={refresh}>{t('retryClinicianList')}</PortalButton></div>}
    {busy && <p role='status' className='py-5 text-sm text-secondary'>{t('loadingDoctors')}</p>}
    {!busy && !loadError && data && <>
      {data.paginated && data.doctors.length > 0 && <p className='text-sm text-secondary'>{t('showing', { from: data.offset + 1, to: data.offset + data.doctors.length, total: String(data.total), title })}</p>}
      {!data.paginated && <p className='text-sm leading-6 text-secondary'>{t('boundedView')}</p>}
      {!data.canReview && <p className='text-sm leading-6 text-secondary'>{t('youCanInspectClinicianDetails')}</p>}
      {!data.doctors.length ? <PortalEmptyState title={activeTab === 'all' ? t('emptyAll') : t('emptyPending')} description={search ? t('emptySearch') : activeTab === 'all' ? t('emptyAllHint') : t('emptyPendingHint')} />
        : <div className='flex min-w-0 flex-col gap-3'>{data.doctors.map(doctor => <DoctorCard key={doctor.provider_id} doctor={doctor} onView={review} canReview={activeTab === 'pending' && data.canReview} />)}</div>}
    </>}
    {selected?.context === context && data?.doctors.some(doctor => doctor.provider_id === selected.providerId) && <DoctorReviewDialog key={selected.providerId} providerId={selected.providerId} onClose={() => closeReview(false)} onSaved={() => closeReview(true)} />}
  </section>
}

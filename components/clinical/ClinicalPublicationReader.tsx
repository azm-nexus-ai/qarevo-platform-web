'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { EmptyRecords, RecordFields, RecordLoadState } from '@/components/patient/ClinicalRecords'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { publicationApiPath, publicationHref, publicationPage, selectedPublication, type PublicationPortal } from '@/lib/clinical-publications'
import { publishedConsultationSummary, summaryPublicationTime } from '@/lib/patient-consultation-summary'
import { usePortalResource } from '@/lib/use-portal-resource'

const subscribeAccount = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
const linkStyle = 'portal-button portal-button-secondary q-button q-button-secondary'
type Props = { portal: PublicationPortal; consultationId: string | null; recordId: string | null; invalidLink: boolean }

/** Read-only published records. Draft content is never requested by this reader. */
export default function ClinicalPublicationReader({ portal, consultationId, recordId, invalidLink }: Props) {
  const readScope = useCallback(() => readAccountScope(portal), [portal])
  const scope = useSyncExternalStore(subscribeAccount, readScope, () => null)
  const key = JSON.stringify([portal, scope, consultationId])
  const [pagination, setPagination] = useState<{ key: string; cursors: number[]; currentId: string | null } | null>(null)
  const [observedLatest, setObservedLatest] = useState<{ key: string; revision: number } | null>(null)
  const cursors = pagination?.key === key ? pagination.cursors : []
  const before = cursors.at(-1)
  const enabled = Boolean(consultationId && !invalidLink)
  const history = usePortalResource<unknown>(enabled ? publicationApiPath(portal, consultationId!, { beforeRevision: before }) : null, false, { refreshOnFocus: true })
  const page = useMemo(() => consultationId ? publicationPage(history.data, consultationId, before) : null, [history.data, consultationId, before])
  const invalidHistory = history.data !== null && !page
  const historyError = history.error || invalidHistory
  const firstPage = before === undefined
  // Capture only the current record's UUID when paging metadata. Older pages
  // must never silently replace the clinical document being read.
  const anchoredId = pagination?.key === key ? pagination.currentId : null
  const detailId = recordId ?? (portal === 'doctor' ? (firstPage && page ? page.items[0]?.id ?? null : anchoredId) : null)
  const contentPath = !enabled ? null : detailId ? publicationApiPath(portal, consultationId!, { recordId: detailId })
    : portal === 'patient' ? `/api/v1/patient/consultation-summary?consultation_id=${consultationId}` : null
  const content = usePortalResource<unknown>(contentPath, portal === 'patient' && !recordId, { refreshOnFocus: true })
  const selected = consultationId && detailId ? selectedPublication(content.data, consultationId, detailId) : null
  const record = detailId ? selected?.record ?? null : consultationId ? publishedConsultationSummary(content.data, consultationId) : null
  const invalidContent = content.data !== null && !record
  // A page transition temporarily clears its response. Previously confirmed
  // newer publication metadata must not make an older body appear current.
  const observedRevision = observedLatest?.key === key ? observedLatest.revision : 0
  const latestKnown = Math.max(observedRevision, record?.revision ?? 0, selected?.latest_published_revision ?? 0, page?.latest_published_revision ?? 0)
  if (enabled && latestKnown > observedRevision) setObservedLatest({ key, revision: latestKnown })
  const superseded = Boolean(record && latestKnown > record.revision)
  const doctorAwaitingHistory = portal === 'doctor' && !recordId && !detailId
  const loading = content.loading || (doctorAwaitingHistory && history.loading)
  const error = content.error || invalidContent || (doctorAwaitingHistory && historyError)
  const refreshing = content.refreshing || history.refreshing
  const refresh = () => { content.retry(); history.retry() }
  const resetHistory = () => { setPagination({ key, cursors: [], currentId: null }); history.retry() }
  const errorMessage = [404, 410].includes(content.errorStatus ?? 0)
    ? 'This published revision is no longer available through this portal. Return to the current summary or contact your care team.'
    : invalidContent ? 'A published summary could not be confirmed for this consultation. Retry or contact your care team.'
      : content.errorMessage || (invalidHistory ? 'The published-version list could not be confirmed. Retry or contact your care team.' : history.errorMessage)
  const currentHref = consultationId ? publicationHref(portal, consultationId) : undefined

  return <div className='space-y-5'>
    {enabled && <div className='flex flex-wrap items-center justify-between gap-3'><p className='max-w-2xl text-sm leading-6 text-secondary'>Published versions are read-only. Opening a version does not change clinical instructions or a saved draft.</p><PortalButton type='button' disabled={refreshing} onClick={refresh}>{refreshing ? 'Refreshing summary…' : 'Refresh summary'}</PortalButton></div>}
    {!enabled ? <EmptyRecords title={invalidLink ? 'This summary link is invalid' : 'No consultation summary available'} description='Open a published summary from your medical records or consultation details. The link must identify one consultation.' showDashboardLink={false} />
      : <RecordLoadState loading={loading} error={error} errorMessage={errorMessage} loadingMessage='Loading your published consultation summary…' retry={refresh}>
        {record ? <PortalCard role='article' aria-label='Published consultation summary'>
          <div className='flex flex-wrap items-start justify-between gap-3'><h2 className='portal-h2'>Clinician-approved consultation summary</h2><ClinicalStatusBadge status='Published' domain='record' /></div>
          <section aria-label='Published revision status' className={`mt-4 rounded-xl border border-theme p-4 ${superseded ? 'bg-surface-subtle' : 'bg-surface-subtle'}`}>
            <h3 className='portal-h3'>{superseded ? 'Superseded published revision' : 'Latest published revision'}</h3>
            <p className='text-sm leading-6 text-secondary'>{superseded ? `You are reading revision ${record.revision}. A newer published version is available (revision ${latestKnown}). Read the current summary for the latest instructions.` : `You are reading the latest confirmed published version, revision ${record.revision}.`}</p>
            {superseded && currentHref && <Link href={currentHref} prefetch={false} onClick={resetHistory} className={`${linkStyle} mt-3`}>Return to current summary</Link>}
          </section>
          <dl className='my-5 grid gap-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm sm:grid-cols-3'>
            <div><dt className='font-semibold text-secondary'>Published revision</dt><dd className='mt-1 text-ink'>Revision {record.revision}</dd></div>
            <div><dt className='font-semibold text-secondary'>Published</dt><dd className='mt-1 text-ink'><time dateTime={record.published_at!}>{summaryPublicationTime(record.published_at)}</time></dd></div>
            <div><dt className='font-semibold text-secondary'>Document language</dt><dd className='mt-1 text-ink'>{record.language === 'de' ? 'German' : 'English'}</dd></div>
          </dl>
          {record.amendment_reason && <section aria-labelledby='summary-amendment-title' className='mb-5 rounded-xl border border-theme bg-surface-subtle p-4'><h3 id='summary-amendment-title' className='portal-h3'>Amendment reason</h3><p className='whitespace-pre-wrap break-words text-sm leading-7 text-secondary'>{record.amendment_reason}</p></section>}
          <RecordFields record={record} fields={[
            ['summary', 'Summary'], ['history', 'History'], ['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Care plan'], ['safety_net', 'Safety and follow-up advice'],
          ]} />
        </PortalCard> : <EmptyRecords title='No consultation summary available' description='A published summary is not available through this link. Check the published versions below, refresh, or contact your care team.' showDashboardLink={false} />}
      </RecordLoadState>}
    {content.error && recordId && currentHref && <Link href={currentHref} prefetch={false} className={linkStyle}>Return to current summary</Link>}
    {enabled && !(doctorAwaitingHistory && historyError) && <PortalCard role='region' aria-label='Published summary versions'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'><div><h2 className='portal-h2'>Published versions</h2><p className='text-sm leading-6 text-secondary'>Only clinician-published versions are listed. Older versions preserve what was shared at that time.</p></div><PortalButton disabled={history.refreshing} onClick={history.retry}>Refresh versions</PortalButton></div>
      {history.loading ? <p role='status' className='text-sm text-secondary'>Loading published versions…</p>
        : historyError ? <div role='alert'><p className='mb-3 text-sm leading-6 text-secondary'>{invalidHistory ? 'The published-version list could not be confirmed. Please retry.' : history.errorMessage}</p><PortalButton onClick={history.retry}>Retry published versions</PortalButton></div>
          : !page?.items.length ? <p className='text-sm text-secondary'>No published versions are available through this portal.</p>
            : <ol className='grid gap-3'>{page.items.map(item => <li key={item.id} className='flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
              <div className='min-w-0'><p className='font-semibold text-ink'>Revision {item.revision}{item.revision === latestKnown ? ' · Current' : ' · Superseded'}</p><p className='mt-1 text-sm leading-6 text-secondary'><time dateTime={item.published_at!}>{summaryPublicationTime(item.published_at)}</time> · {item.language === 'de' ? 'German' : 'English'}</p></div>
              <Link href={publicationHref(portal, consultationId, item.id)!} prefetch={false} aria-current={record?.id.toLowerCase() === item.id ? 'page' : undefined} className={linkStyle}>View revision {item.revision}</Link>
            </li>)}</ol>}
      <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-secondary'>Page {cursors.length + 1} · Up to 20 versions per page</p><div className='flex flex-wrap gap-2'><PortalButton disabled={!cursors.length || history.refreshing} onClick={() => setPagination({ key, cursors: cursors.slice(0, -1), currentId: detailId })}>Newer revisions</PortalButton><PortalButton disabled={!page?.has_more || !page.next_before_revision || history.refreshing} onClick={() => { if (page?.next_before_revision) setPagination({ key, cursors: [...cursors, page.next_before_revision], currentId: detailId }) }}>Older revisions</PortalButton></div></div>
    </PortalCard>}
    {refreshing && !loading && <p role='status' className='text-sm text-secondary'>Checking for the latest published revision…</p>}
    <nav aria-label='Consultation summary navigation' className='flex flex-wrap gap-3'>{portal === 'patient' ? <><Link href='/patient/medical-records' className={linkStyle}>Back to medical records</Link><Link href='/patient/appointments' className={linkStyle}>View my appointments</Link></> : <><Link href={consultationId ? `/doctor/workspace/${consultationId}` : '/doctor/workspace'} className={linkStyle}>Back to consultation</Link><Link href='/doctor/workspace' className={linkStyle}>View physician workspace</Link></>}</nav>
  </div>
}

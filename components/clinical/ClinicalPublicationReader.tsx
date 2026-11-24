'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { EmptyRecords, RecordFields, RecordLoadState } from '@/components/patient/ClinicalRecords'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import SupportReference from '@/components/ui/SupportReference'
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
  const t = useTranslations('publicationReader')
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
    ? t('revisionGone')
    : invalidContent ? t('unconfirmed')
      : content.errorMessage || (invalidHistory ? t('listUnconfirmed') : history.errorMessage)
  const currentHref = consultationId ? publicationHref(portal, consultationId) : undefined

  return <div className='space-y-5'>
    {enabled && <div className='flex flex-wrap items-center justify-between gap-3'><p className='max-w-2xl text-sm leading-6 text-secondary'>{t('readOnly')}</p><PortalButton type='button' disabled={refreshing} onClick={refresh}>{refreshing ? t('refreshing') : t('refresh')}</PortalButton></div>}
    {!enabled ? <EmptyRecords title={invalidLink ? t('invalidLink') : t('none')} description={t('openFromRecords')} showDashboardLink={false} />
      : <RecordLoadState loading={loading} error={error} errorMessage={errorMessage} errorRequestId={content.errorRequestId ?? (doctorAwaitingHistory ? history.errorRequestId : null)} loadingMessage={t('loading')} retry={refresh}>
        {record ? <PortalCard role='article' aria-label={t('title')}>
          <div className='flex flex-wrap items-start justify-between gap-3'><h2 className='portal-h2'>{t('approved')}</h2><ClinicalStatusBadge status='Published' domain='record' /></div>
          <section aria-label={t('statusLabel')} className={`mt-4 rounded-xl border border-theme p-4 ${superseded ? 'bg-surface-subtle' : 'bg-surface-subtle'}`}>
            <h3 className='portal-h3'>{superseded ? t('supersededTitle') : t('latestTitle')}</h3>
            <p className='text-sm leading-6 text-secondary'>{superseded ? t('superseded', { revision: record.revision, latest: latestKnown }) : t('latest', { revision: record.revision })}</p>
            {superseded && currentHref && <Link href={currentHref} prefetch={false} onClick={resetHistory} className={`${linkStyle} mt-3`}>{t('returnCurrent')}</Link>}
          </section>
          <dl className='my-5 grid gap-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm sm:grid-cols-3'>
            <div><dt className='font-semibold text-secondary'>{t('publishedRevision')}</dt><dd className='mt-1 text-ink'>{t('revision', { revision: record.revision })}</dd></div>
            <div><dt className='font-semibold text-secondary'>{t('published')}</dt><dd className='mt-1 text-ink'><time dateTime={record.published_at!}>{summaryPublicationTime(record.published_at)}</time></dd></div>
            <div><dt className='font-semibold text-secondary'>{t('documentLanguage')}</dt><dd className='mt-1 text-ink'>{record.language === 'de' ? t('german') : t('english')}</dd></div>
          </dl>
          {record.amendment_reason && <section aria-labelledby='summary-amendment-title' className='mb-5 rounded-xl border border-theme bg-surface-subtle p-4'><h3 id='summary-amendment-title' className='portal-h3'>{t('amendmentReason')}</h3><p className='whitespace-pre-wrap break-words text-sm leading-7 text-secondary'>{record.amendment_reason}</p></section>}
          <RecordFields record={record} fields={[
            ['summary', t('secSummary')], ['history', t('secHistory')], ['findings', t('secFindings')], ['assessment', t('secAssessment')], ['plan', t('secPlan')], ['safety_net', t('secSafety')],
          ]} />
        </PortalCard> : <EmptyRecords title={t('none')} description={t('notViaLink')} showDashboardLink={false} />}
      </RecordLoadState>}
    {content.error && recordId && currentHref && <Link href={currentHref} prefetch={false} className={linkStyle}>{t('returnCurrent')}</Link>}
    {enabled && !(doctorAwaitingHistory && historyError) && <PortalCard role='region' aria-label={t('versionsLabel')}>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'><div><h2 className='portal-h2'>{t('versions')}</h2><p className='text-sm leading-6 text-secondary'>{t('versionsIntro')}</p></div><PortalButton disabled={history.refreshing} onClick={history.retry}>{t('refreshVersions')}</PortalButton></div>
      {history.loading ? <p role='status' className='text-sm text-secondary'>{t('loadingVersions')}</p>
        : historyError ? <div role='alert'><p className='mb-3 text-sm leading-6 text-secondary'>{invalidHistory ? 'The published-version list could not be confirmed. Please retry.' : history.errorMessage}</p><SupportReference requestId={history.errorRequestId} /><PortalButton onClick={history.retry}>{t('retryVersions')}</PortalButton></div>
          : !page?.items.length ? <p className='text-sm text-secondary'>{t('noVersions')}</p>
            : <ol className='grid gap-3'>{page.items.map(item => <li key={item.id} className='flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
              <div className='min-w-0'><p className='font-semibold text-ink'>{t('revision', { revision: item.revision })}{item.revision === latestKnown ? ` · ${t('current')}` : ` · ${t('supersededShort')}`}</p><p className='mt-1 text-sm leading-6 text-secondary'><time dateTime={item.published_at!}>{summaryPublicationTime(item.published_at)}</time> · {item.language === 'de' ? t('german') : t('english')}</p></div>
              <Link href={publicationHref(portal, consultationId, item.id)!} prefetch={false} aria-current={record?.id.toLowerCase() === item.id ? 'page' : undefined} className={linkStyle}>View revision {item.revision}</Link>
            </li>)}</ol>}
      <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-secondary'>Page {cursors.length + 1} · Up to 20 versions per page</p><div className='flex flex-wrap gap-2'><PortalButton disabled={!cursors.length || history.refreshing} onClick={() => setPagination({ key, cursors: cursors.slice(0, -1), currentId: detailId })}>{t('newer')}</PortalButton><PortalButton disabled={!page?.has_more || !page.next_before_revision || history.refreshing} onClick={() => { if (page?.next_before_revision) setPagination({ key, cursors: [...cursors, page.next_before_revision], currentId: detailId }) }}>{t('older')}</PortalButton></div></div>
    </PortalCard>}
    {refreshing && !loading && <p role='status' className='text-sm text-secondary'>{t('checkingLatest')}</p>}
    <nav aria-label={t('navigation')} className='flex flex-wrap gap-3'>{portal === 'patient' ? <><Link href='/patient/medical-records' className={linkStyle}>{t('backToRecords')}</Link><Link href='/patient/appointments' className={linkStyle}>{t('myAppointments')}</Link></> : <><Link href={consultationId ? `/doctor/workspace/${consultationId}` : '/doctor/workspace'} className={linkStyle}>{t('backToConsultation')}</Link><Link href='/doctor/workspace' className={linkStyle}>{t('workspace')}</Link></>}</nav>
  </div>
}

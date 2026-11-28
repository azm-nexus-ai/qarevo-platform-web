'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
import { readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { summaryPublicationTime } from '@/lib/patient-consultation-summary'
import { usePatientNotifications } from '@/lib/use-patient-notifications'

export default function PatientNotifications({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  // Remount the memory-only inbox on route changes, including equal head URLs,
  // so the resource cleanup aborts both reads and pending read receipts.
  return <PatientNotificationPage key={pathname} compact={compact} />
}

function PatientNotificationPage({ compact }: { compact: boolean }) {
  const t = useTranslations('patientNotifications')
  const notices = usePatientNotifications(), pathname = usePathname()
  const pageStatus = useRef<HTMLParagraphElement>(null), previousPage = useRef(notices.pageNumber)
  const busy = notices.loading || notices.refreshing || Boolean(notices.pendingId)
  useEffect(() => {
    if (!compact && previousPage.current !== notices.pageNumber) pageStatus.current?.focus()
    previousPage.current = notices.pageNumber
  }, [compact, notices.pageNumber])
  return <section aria-label={t('label')} aria-busy={busy} className='min-w-0 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><div><p className='text-sm leading-6 text-secondary'>{compact ? t('compactIntro') : notices.paginated ? t('pagedIntro') : t('recentIntro')}</p>{notices.unreadCount !== null && <p className='text-sm font-semibold leading-6 text-ink'>Unread notifications: {notices.unreadCount}</p>}{!notices.loading && !notices.error && !notices.paginated && <p className='text-sm leading-6 text-secondary'>{t('partial')}</p>}</div><PortalButton type='button' disabled={busy} onClick={notices.refresh}>{notices.refreshing ? t('refreshing') : t('refresh')}</PortalButton></div>
    {!compact && (notices.paginated || notices.hasNewer) && <nav aria-label={t('pages')} className='flex flex-wrap items-center gap-3'>
      <p ref={pageStatus} tabIndex={-1} role='status' aria-live='polite' className='text-sm leading-6 text-secondary'>{t('page', { page: notices.pageNumber })}{notices.loading ? ` · ${t('loading')}` : ''}</p>
      <PortalButton type='button' disabled={busy || !notices.hasNewer} onClick={notices.newer}>{t('newer')}</PortalButton>
      <PortalButton type='button' disabled={busy || !notices.hasOlder} onClick={notices.older}>{t('older')}</PortalButton>
      {notices.hasNewer && <PortalButton type='button' disabled={busy} onClick={notices.newest}>{t('newest')}</PortalButton>}
    </nav>}
    {notices.loading ? <p aria-live='polite' className='py-3 text-sm text-secondary'>{t('loading')}</p>
      : notices.error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-sm leading-6 text-secondary'>{notices.errorMessage}</p><PortalButton onClick={notices.refresh}>{t('retry')}</PortalButton></div>
        : <>
          {notices.invalidCount > 0 && <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='text-sm leading-6 text-secondary'>{t('unverified')}</p></div>}
          {!notices.items.length ? <p className='rounded-xl border border-dashed border-theme p-4 text-sm leading-6 text-secondary'>{notices.invalidCount ? t('noneVerified') : notices.hasNewer ? t('nonePage') : t('none')}</p>
            : <ol className='grid min-w-0 gap-3'>{(compact ? notices.items.slice(0, 5) : notices.items).map(notice => <li key={notice.id} data-notification-id={notice.id} className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'><span className='text-xs font-semibold uppercase tracking-wide text-secondary'>{notice.official ? t('kindPublication') : notice.careRecord ? t('kindCare') : t('kindAccount')}</span><span className='rounded-full border border-theme bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink'>{notice.isRead ? t('read') : t('new')}</span></div>
              <h3 className='portal-h3 mt-3 break-words'>{notice.title}</h3>
              {notice.body && <p className='mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-secondary' style={{ overflowWrap: 'anywhere' }}>{notice.body}</p>}
              {(notice.createdAt || notice.actor) && <p className='mt-2 text-xs leading-6 text-secondary'>{notice.actor && <span>{notice.actor}{notice.createdAt ? ' · ' : ''}</span>}{notice.createdAt && <time dateTime={notice.createdAt}>{summaryPublicationTime(notice.createdAt)}</time>}</p>}
              <div className='mt-3 flex flex-wrap gap-2'>
                {notice.href && <Link href={notice.href} prefetch={false} className='portal-button portal-button-secondary q-button q-button-secondary' onClick={event => { if (readAccountScope('patient') !== notices.scope || currentPortal() !== 'patient' || window.location.pathname !== pathname) event.preventDefault() }}>{notice.official ? t('viewSummary') : notice.careRecord ? t('viewInstructions') : t('open')}</Link>}
                {!notice.isRead && <PortalButton type='button' disabled={busy} onClick={() => void notices.markRead(notice.id, notices.scope)} aria-label={t(notices.errorId === notice.id ? 'retryMarkNamed' : 'markNamed', { title: notice.title })}>{notices.pendingId === notice.id ? t('marking') : notices.errorId === notice.id ? t('retryMark') : t('mark')}</PortalButton>}
              </div>
              {notices.errorId === notice.id && <p role='alert' className='mt-3 text-sm leading-6 text-secondary'>{notices.mutationError}</p>}
            </li>)}</ol>}
          {compact && <Link href='/patient/notifications' className='inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4'>{t('viewAll')}</Link>}
        </>}
  </section>
}

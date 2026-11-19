'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
  const notices = usePatientNotifications(), pathname = usePathname()
  const pageStatus = useRef<HTMLParagraphElement>(null), previousPage = useRef(notices.pageNumber)
  const busy = notices.loading || notices.refreshing || Boolean(notices.pendingId)
  useEffect(() => {
    if (!compact && previousPage.current !== notices.pageNumber) pageStatus.current?.focus()
    previousPage.current = notices.pageNumber
  }, [compact, notices.pageNumber])
  return <section aria-label='Patient notifications' aria-busy={busy} className='min-w-0 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><div><p className='text-sm leading-6 text-secondary'>{compact ? 'Up to 5 recent account and care updates.' : notices.paginated ? 'Up to 50 account and care updates per page.' : 'Up to 50 recent account and care updates.'}</p>{notices.unreadCount !== null && <p className='text-sm font-semibold leading-6 text-ink'>Unread notifications: {notices.unreadCount}</p>}{!notices.loading && !notices.error && !notices.paginated && <p className='text-sm leading-6 text-secondary'>Only recent updates are available. Older history and the total unread count could not be confirmed.</p>}</div><PortalButton type='button' disabled={busy} onClick={notices.refresh}>{notices.refreshing ? 'Refreshing notifications…' : 'Refresh notifications'}</PortalButton></div>
    {!compact && (notices.paginated || notices.hasNewer) && <nav aria-label='Notification pages' className='flex flex-wrap items-center gap-3'>
      <p ref={pageStatus} tabIndex={-1} role='status' aria-live='polite' className='text-sm leading-6 text-secondary'>Page {notices.pageNumber}{notices.loading ? ' · Loading notifications…' : ''}</p>
      <PortalButton type='button' disabled={busy || !notices.hasNewer} onClick={notices.newer}>Newer notifications</PortalButton>
      <PortalButton type='button' disabled={busy || !notices.hasOlder} onClick={notices.older}>Older notifications</PortalButton>
      {notices.hasNewer && <PortalButton type='button' disabled={busy} onClick={notices.newest}>Newest notifications</PortalButton>}
    </nav>}
    {notices.loading ? <p aria-live='polite' className='py-3 text-sm text-secondary'>Loading notifications…</p>
      : notices.error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-sm leading-6 text-secondary'>{notices.errorMessage}</p><PortalButton onClick={notices.refresh}>Retry notifications</PortalButton></div>
        : <>
          {notices.invalidCount > 0 && <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='text-sm leading-6 text-secondary'>Some notifications could not be verified. Refresh notifications or open your medical records directly.</p></div>}
          {!notices.items.length ? <p className='rounded-xl border border-dashed border-theme p-4 text-sm leading-6 text-secondary'>{notices.invalidCount ? 'No verified notifications are available on this page. You can try another page or refresh notifications.' : notices.hasNewer ? 'No notifications are available on this page. Use Newer notifications or Newest notifications to continue.' : 'No notifications yet. Updates will appear here when available.'}</p>
            : <ol className='grid min-w-0 gap-3'>{(compact ? notices.items.slice(0, 5) : notices.items).map(notice => <li key={notice.id} data-notification-id={notice.id} className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'><span className='text-xs font-semibold uppercase tracking-wide text-secondary'>{notice.official ? 'Clinical publication' : notice.careRecord ? 'Care record update' : 'Account update'}</span><span className='rounded-full border border-theme bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink'>{notice.isRead ? 'Read' : 'New'}</span></div>
              <h3 className='portal-h3 mt-3 break-words'>{notice.title}</h3>
              {notice.body && <p className='mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-secondary' style={{ overflowWrap: 'anywhere' }}>{notice.body}</p>}
              {notice.createdAt && <p className='mt-2 text-xs leading-6 text-secondary'><time dateTime={notice.createdAt}>{summaryPublicationTime(notice.createdAt)}</time></p>}
              <div className='mt-3 flex flex-wrap gap-2'>
                {notice.href && <Link href={notice.href} prefetch={false} className='portal-button portal-button-secondary q-button q-button-secondary' onClick={event => { if (readAccountScope('patient') !== notices.scope || currentPortal() !== 'patient' || window.location.pathname !== pathname) event.preventDefault() }}>{notice.official ? 'View consultation summary' : notice.careRecord ? 'View current care instructions' : 'Open update'}</Link>}
                {!notice.isRead && <PortalButton type='button' disabled={busy} onClick={() => void notices.markRead(notice.id, notices.scope)} aria-label={`${notices.errorId === notice.id ? 'Retry marking' : 'Mark'} ${notice.title} as read`}>{notices.pendingId === notice.id ? 'Marking as read…' : notices.errorId === notice.id ? 'Retry mark as read' : 'Mark as read'}</PortalButton>}
              </div>
              {notices.errorId === notice.id && <p role='alert' className='mt-3 text-sm leading-6 text-secondary'>{notices.mutationError}</p>}
            </li>)}</ol>}
          {compact && <Link href='/patient/notifications' className='inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4'>View all recent notifications</Link>}
        </>}
  </section>
}

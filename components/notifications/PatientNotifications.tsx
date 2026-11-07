'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
import { readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { summaryPublicationTime } from '@/lib/patient-consultation-summary'
import { usePatientNotifications } from '@/lib/use-patient-notifications'

export default function PatientNotifications({ compact = false }: { compact?: boolean }) {
  const notices = usePatientNotifications(), pathname = usePathname()
  return <section aria-label='Patient notifications' aria-busy={notices.refreshing} className='min-w-0 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><p className='text-sm leading-6 text-secondary'>{compact ? 'Up to 5 recent account and care updates.' : 'Up to 50 recent account and care updates.'}</p><PortalButton type='button' disabled={notices.refreshing} onClick={notices.refresh}>{notices.refreshing ? 'Refreshing notifications…' : 'Refresh notifications'}</PortalButton></div>
    {notices.loading ? <p role='status' className='py-3 text-sm text-secondary'>Loading notifications…</p>
      : notices.error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-3 text-sm leading-6 text-secondary'>{notices.errorMessage}</p><PortalButton onClick={notices.refresh}>Retry notifications</PortalButton></div>
        : <>
          {notices.invalidCount > 0 && <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='text-sm leading-6 text-secondary'>Some notifications could not be verified. Refresh notifications or open your medical records directly.</p></div>}
          {!notices.items.length ? <p className='rounded-xl border border-dashed border-theme p-4 text-sm leading-6 text-secondary'>{notices.invalidCount ? 'No verified notifications are available. Use Refresh notifications to try again.' : 'No notifications yet. Updates will appear here when available.'}</p>
            : <ol className='grid min-w-0 gap-3'>{notices.items.slice(0, compact ? 5 : 50).map(notice => <li key={notice.id} data-notification-id={notice.id} className='min-w-0 rounded-xl border border-theme bg-surface p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'><span className='text-xs font-semibold uppercase tracking-wide text-secondary'>{notice.official ? 'Clinical publication' : 'Account update'}</span><span className='rounded-full border border-theme bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink'>{notice.isRead ? 'Read' : 'New'}</span></div>
              <h3 className='portal-h3 mt-3 break-words'>{notice.title}</h3>
              {notice.body && <p className='mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-secondary' style={{ overflowWrap: 'anywhere' }}>{notice.body}</p>}
              {notice.createdAt && <p className='mt-2 text-xs leading-6 text-secondary'><time dateTime={notice.createdAt}>{summaryPublicationTime(notice.createdAt)}</time></p>}
              <div className='mt-3 flex flex-wrap gap-2'>
                {notice.href && <Link href={notice.href} prefetch={false} className='portal-button portal-button-secondary q-button q-button-secondary' onClick={event => { if (readAccountScope('patient') !== notices.scope || currentPortal() !== 'patient' || window.location.pathname !== pathname) event.preventDefault() }}>{notice.official ? 'View consultation summary' : 'Open update'}</Link>}
                {!notice.isRead && <PortalButton type='button' disabled={Boolean(notices.pendingId)} onClick={() => void notices.markRead(notice.id, notices.scope)} aria-label={`${notices.errorId === notice.id ? 'Retry marking' : 'Mark'} ${notice.title} as read`}>{notices.pendingId === notice.id ? 'Marking as read…' : notices.errorId === notice.id ? 'Retry mark as read' : 'Mark as read'}</PortalButton>}
              </div>
              {notices.errorId === notice.id && <p role='alert' className='mt-3 text-sm leading-6 text-secondary'>{notices.mutationError}</p>}
            </li>)}</ol>}
          {compact && <Link href='/patient/notifications' className='inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4'>View all recent notifications</Link>}
        </>}
  </section>
}

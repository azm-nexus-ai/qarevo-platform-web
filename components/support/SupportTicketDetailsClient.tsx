'use client'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import SupportContentShell from '@/components/support/SupportContentShell'
export default function SupportTicketDetailsClient({ ticketId }: { ticketId: string }) {
  const t = useTranslations('support')
  return <SupportContentShell title={t('supportTicketUnavailable')}><section className='support-help-card'><p role='status'>{t('supportTicketsAreNotConnected')}</p><p>{t('reference')} <span style={{overflowWrap:'anywhere'}}>{ticketId}</span></p><Link href='/support' className='theme-toggle'>{t('backToSupport')}</Link></section></SupportContentShell>
}

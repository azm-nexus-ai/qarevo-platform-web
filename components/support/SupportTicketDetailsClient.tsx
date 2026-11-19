'use client'
import Link from 'next/link'
import SupportContentShell from '@/components/support/SupportContentShell'
export default function SupportTicketDetailsClient({ ticketId }: { ticketId: string }) {
  return <SupportContentShell title='Support ticket unavailable'><section className='support-help-card'><p role='status'>Support tickets are not connected in this development environment. No ticket data is available for this reference.</p><p>Reference: <span style={{overflowWrap:'anywhere'}}>{ticketId}</span></p><Link href='/support' className='theme-toggle'>Back to Support</Link></section></SupportContentShell>
}

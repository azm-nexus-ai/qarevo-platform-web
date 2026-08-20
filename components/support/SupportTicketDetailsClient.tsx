'use client'

import Link from 'next/link'
import { useState } from 'react'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { T } from '@/lib/tokens'

const TIMELINE = [
  { title: 'Ticket created', body: 'Patient submitted details about invoice mismatch after insurance application.', time: 'Today • 09:15 AM' },
  { title: 'Support review started', body: 'Billing support agent assigned and began reviewing claim reconciliation.', time: 'Today • 10:02 AM' },
  { title: 'Awaiting patient confirmation', body: 'Support requested the affected invoice screenshot and payment reference.', time: 'Today • 10:34 AM' },
]

const REPLIES = [
  { author: 'Ada Okonkwo', role: 'Billing Support Agent', message: 'We have reviewed the invoice and the insurance adjustment has partially synced. Please share the payment reference so we can finalize the balance update.', time: '10:34 AM' },
  { author: 'John Adewale', role: 'Patient', message: 'Thank you. I paid through my Visa card yesterday and can attach the transaction reference.', time: '11:08 AM' },
]

export default function SupportTicketDetailsClient({ ticketId }: { ticketId: string }) {
  const [reply, setReply] = useState('')
  const [closed, setClosed] = useState(false)

  return (
    <PatientPortalShell
      title={`Support Ticket ${ticketId}`}
      description='Review the conversation timeline, agent updates, attachments, and respond to your support thread from the same authenticated help workspace.'
      headerActions={<Link href='/support' style={{ textDecoration: 'none' }}><PortalButton tone='secondary'>Back to Support</PortalButton></Link>}
      rightRail={
        <div className='grid gap-3'>
          <PortalCard>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ticket Status</p>
            <div className='flex flex-wrap gap-2 mb-3'>
              <PortalBadge tone={closed ? 'success' : 'warning'}>{closed ? 'Closed' : 'Open'}</PortalBadge>
              <PortalBadge tone='info'>Billing</PortalBadge>
            </div>
            <div className='grid gap-2'>
              {[
                ['Support Agent', 'Ada Okonkwo'],
                ['Priority', 'Medium'],
                ['Last Updated', 'Today • 11:08 AM'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Attachments</p>
            <div className='grid gap-2'>
              {['invoice-screenshot.pdf', 'payment-reference.png'].map((file) => (
                <div key={file} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: T.navy }}>{file}</p>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>
      }
    >
      <div className='grid gap-4'>
        <PortalCard>
          <div className='mb-4'>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Conversation Timeline</p>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Progress and support actions</h2>
          </div>
          <div className='grid gap-3'>
            {TIMELINE.map((item) => (
              <div key={item.title} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: T.slate, lineHeight: 1.65 }}>{item.body}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </PortalCard>

        <PortalCard>
          <div className='mb-4'>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Replies</p>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Discussion with support</h2>
          </div>
          <div className='grid gap-3 mb-4'>
            {REPLIES.map((item) => (
              <div key={`${item.author}-${item.time}`} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: item.role.includes('Agent') ? 'rgba(32,181,223,0.05)' : 'rgba(247,250,252,0.9)' }}>
                <div className='flex flex-wrap items-start justify-between gap-3 mb-2'>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.author}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2 }}>{item.role}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{item.time}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.65 }}>{item.message}</p>
              </div>
            ))}
          </div>

          <div className='grid gap-3'>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder='Reply to the support team' rows={5} className='rounded-2xl border px-4 py-3 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.92)', color: T.navy, resize: 'vertical' }} />
            <div className='flex gap-2 flex-wrap'>
              <PortalButton tone='primary' onClick={() => setReply('')}>Send Reply</PortalButton>
              <PortalButton tone='secondary'>Attach File</PortalButton>
              <PortalButton tone='danger' onClick={() => setClosed(true)}>Close Ticket</PortalButton>
            </div>
          </div>
        </PortalCard>
      </div>
    </PatientPortalShell>
  )
}
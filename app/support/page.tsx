'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T } from '@/lib/tokens'

const QUICK_HELP = [
  { title: 'Appointments', body: 'Booking, rescheduling, and joining consultations', icon: ICONS.calendar },
  { title: 'Prescriptions', body: 'Medication plans, downloads, and refills', icon: ICONS.heart },
  { title: 'Lab Results', body: 'Diagnostic uploads and report visibility', icon: ICONS.cpu },
  { title: 'Billing', body: 'Invoices, claims, and payment guidance', icon: ICONS.info },
  { title: 'Technical Issues', body: 'Camera, audio, login, and browser help', icon: ICONS.video },
  { title: 'Account', body: 'Security, settings, and profile updates', icon: ICONS.user },
]

const FAQS = [
  { question: 'How do I book appointments?', answer: 'Use Find a Doctor to choose a specialist, review the profile, and continue through the booking flow.' },
  { question: 'How do I cancel appointments?', answer: 'Open your appointment details, review your scheduled visit, and use the cancellation or reschedule tools when available.' },
  { question: 'How do I download prescriptions?', answer: 'Visit Prescription & Care Plan and use the document actions to download or share your medication summary.' },
  { question: 'How do I upload lab results?', answer: 'Open Lab Requests & Diagnostic Tests and attach new reports through the upload section.' },
  { question: 'How do I contact my doctor?', answer: 'Use Messages to send a note to your care team before or after your consultation.' },
]

const TICKETS = [
  { id: 'SUP-2048', category: 'Billing', status: 'Open', updated: '2 hours ago' },
  { id: 'SUP-2039', category: 'Technical Issue', status: 'Waiting on You', updated: 'Yesterday' },
  { id: 'SUP-2012', category: 'Appointments', status: 'Resolved', updated: '4 days ago' },
]

const CONTACT_OPTIONS = [
  { label: 'Live Chat', meta: 'Available now', icon: ICONS.ema },
  { label: 'Call Support', meta: '+234 800 QAREVO', icon: ICONS.activity },
  { label: 'Email Support', meta: 'support@qarevo.test', icon: ICONS.ema },
  { label: 'WhatsApp', meta: 'Placeholder', icon: ICONS.user },
] as const

export default function SupportPage() {
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Appointments')
  const [priority, setPriority] = useState('Medium')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<string | null>(FAQS[0].question)

  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return FAQS
    return FAQS.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(query))
  }, [search])

  return (
    <PatientPortalShell
      title='Help & Support'
      description='Search help content, raise support tickets, review existing issues, and get urgent assistance without leaving your patient portal.'
      headerActions={<PortalButton tone='primary'>Live Chat</PortalButton>}
      rightRail={
        <div className='grid gap-3'>
          <PortalCard>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Emergency Help</p>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Immediate assistance</h2>
            <div className='grid gap-2'>
              {[
                ['Emergency Number', '112'],
                ['Nearest Hospital', 'Qarevo Care Centre • 2.1 km'],
                ['Urgent Response', 'Available 24/7'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                </div>
              ))}
            </div>
            <div className='mt-3'>
              <PortalButton tone='danger' fullWidth>Call Emergency Services</PortalButton>
            </div>
          </PortalCard>
        </div>
      }
    >
      <div className='grid gap-4'>
        {submitted ? <PortalBadge tone='success'>Support ticket submitted successfully.</PortalBadge> : null}

        <PortalCard>
          <div className='flex items-center gap-3 rounded-2xl border px-4 py-3' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.92)' }}>
            <Ico p={ICONS.search} size={18} sw={1.8} color={T.slate2} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Search help articles'
              aria-label='Search Help Articles'
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: T.navy, fontSize: '14px' }}
            />
          </div>
        </PortalCard>

        <PortalCard>
          <div className='mb-4'>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quick Help</p>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Jump into common support topics</h2>
          </div>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {QUICK_HELP.map((item) => (
              <div key={item.title} className='rounded-2xl border p-4 transition hover:-translate-y-px' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(32,181,223,0.12)', display: 'grid', placeItems: 'center', marginBottom: '10px' }}>
                  <Ico p={item.icon} size={16} sw={1.7} color={T.blue} />
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.6 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </PortalCard>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
          <PortalCard>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>FAQ</p>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Answers to common questions</h2>
            </div>
            <div className='grid gap-3'>
              {filteredFaqs.length === 0 ? (
                <PortalEmptyState title='No matching help articles' description='Try another keyword or browse the quick help categories above.' />
              ) : (
                filteredFaqs.map((item) => {
                  const expanded = openFaq === item.question
                  return (
                    <button
                      key={item.question}
                      type='button'
                      onClick={() => setOpenFaq(expanded ? null : item.question)}
                      className='rounded-2xl border p-4 text-left transition hover:-translate-y-px focus:outline-none focus:ring-2'
                      style={{ borderColor: expanded ? 'rgba(32,181,223,0.2)' : 'rgba(4,53,77,0.08)', background: expanded ? 'rgba(32,181,223,0.05)' : 'rgba(247,250,252,0.9)' }}
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.question}</span>
                        <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={expanded ? T.blue : T.slate2} />
                      </div>
                      {expanded ? <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: T.slate, lineHeight: 1.65 }}>{item.answer}</p> : null}
                    </button>
                  )
                })
              )}
            </div>
          </PortalCard>

          <PortalCard>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contact Options</p>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Reach the support team your way</h2>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {CONTACT_OPTIONS.map((item) => (
                <div key={item.label} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(32,181,223,0.12)', display: 'grid', placeItems: 'center', marginBottom: '10px' }}>
                    <Ico p={item.icon} size={16} sw={1.7} color={T.blue} />
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.6 }}>{item.meta}</p>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
          <PortalCard>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Support Tickets</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Open issues and recent conversations</h2>
              </div>
              <PortalBadge tone='info'>{TICKETS.length} active threads</PortalBadge>
            </div>
            <div className='grid gap-3'>
              {TICKETS.map((ticket) => (
                <div key={ticket.id} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{ticket.id}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate }}>{ticket.category}</p>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>Last updated {ticket.updated}</p>
                    </div>
                    <div className='flex flex-col items-end gap-2'>
                      <PortalBadge tone={ticket.status === 'Resolved' ? 'success' : ticket.status === 'Open' ? 'warning' : 'info'}>{ticket.status}</PortalBadge>
                      <Link href={`/support/${ticket.id}`} style={{ color: T.blue, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>View Ticket</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Create Support Ticket</p>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Tell us what you need help with</h2>
            </div>
            <form
              className='grid gap-3'
              onSubmit={(event) => {
                event.preventDefault()
                setSubmitted(true)
              }}
            >
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder='Subject' className='rounded-2xl border px-4 py-3 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.92)', color: T.navy }} />
              <div className='grid gap-3 sm:grid-cols-2'>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className='rounded-2xl border px-4 py-3 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.92)', color: T.navy }}>
                  {['Appointments', 'Billing', 'Technical Issue', 'Account', 'Prescriptions'].map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className='rounded-2xl border px-4 py-3 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.92)', color: T.navy }}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder='Describe the issue in detail' rows={6} className='rounded-2xl border px-4 py-3 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.92)', color: T.navy, resize: 'vertical' }} />
              <label className='rounded-2xl border border-dashed px-4 py-4 text-sm' style={{ borderColor: 'rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.7)', color: T.slate }}>
                Attachment
                <input type='file' className='mt-2 block text-xs' />
              </label>
              <div className='flex gap-2 flex-wrap'>
                <PortalButton tone='primary' type='submit'>Submit</PortalButton>
                <PortalButton tone='secondary' type='button' onClick={() => { setSubject(''); setDescription(''); setSubmitted(false) }}>Clear</PortalButton>
              </div>
            </form>
          </PortalCard>
        </div>
      </div>
    </PatientPortalShell>
  )
}

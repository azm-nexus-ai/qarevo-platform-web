'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { getBookingPhysician } from '@/lib/booking'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import HoverBtn from '@/components/buttons/HoverBtn'


type TimelineItem = {
  title: string
  sub: string
  time: string
  active?: boolean
}

type ChecklistItem = {
  label: string
  hint: string
}

type CommunicationItem = {
  label: string
  state: string
  tone: string
}

type ActionItem = {
  label: string
  sub: string
  icon: string | readonly string[]
  href: string
}


const timelineItems: TimelineItem[] = [
  { title: '24 Hours Before', sub: 'Reminder notification', time: 'Tomorrow morning', active: true },
]

const checklistItems: ChecklistItem[] = [
  { label: 'Review your medical history', hint: 'Keep your records ready for the physician' },
  { label: 'Upload additional medical documents', hint: 'Add recent reports or prescriptions' },
  { label: 'Prepare questions for your physician', hint: 'Bring a short list to make the most of the visit' },
  { label: 'Ensure a stable internet connection', hint: 'A reliable connection helps the consultation flow smoothly' },
  { label: 'Join 5 minutes before your appointment', hint: 'You will be guided into the room promptly' },
  { label: 'Enable camera and microphone', hint: 'A quick check helps avoid delays' },
]

const communicationItems: CommunicationItem[] = [
  { label: 'Appointment confirmation email', state: 'Sent', tone: T.green },
  { label: 'SMS reminder', state: 'Scheduled', tone: T.blue },
  { label: 'Push notifications', state: 'Enabled', tone: T.green },
  { label: 'Calendar reminder', state: 'Active', tone: T.blue },
]

const quickActions: ActionItem[] = [
  { label: 'View Appointment Details', sub: 'Open your visit summary', icon: ICONS.calendar, href: '/patient/appointment-details' },
  { label: 'Return to Dashboard', sub: 'Back to your care hub', icon: ICONS.activity, href: PATIENT_ROUTES.dashboard },
  { label: 'Message Physician', sub: 'Share notes before the consult', icon: ICONS.ema, href: PATIENT_ROUTES.messages },
  { label: 'View Medical Records', sub: 'Check your history', icon: ICONS.shield, href: PATIENT_ROUTES.medicalRecords },
  { label: 'Find Another Doctor', sub: 'Explore other specialists', icon: ICONS.steth, href: '/patient/find-doctor' },
]

function formatFee(value: number) {
  return value > 0 ? `$${value}` : 'Not configured'
}

function readLabel(service: string | null) {
  switch (service) {
    case 'physical':
      return 'In-person Consultation'
    case 'follow-up':
      return 'Follow-up Consultation'
    default:
      return 'Video Consultation'
  }
}

function SuccessPageContent() {
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id')
  const physician = physicianId ? PHYSICIANS.find((item) => item.id === physicianId) : null
  const physicianData = useMemo(() => getBookingPhysician(searchParams, physician), [searchParams, physician])
  const service = searchParams.get('service')
  const fee = searchParams.get('fee')
  const duration = searchParams.get('duration')
  const insurance = searchParams.get('insurance')
  const date = searchParams.get('date')
  const slot = searchParams.get('slot')
  const notes = searchParams.get('notes')
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [reminderEnabled, setReminderEnabled] = useState(true)

  // Show error state if required booking data is missing
  if (!physicianId || !date || !slot) {
    return (
      <PatientPortalShell
        eyebrow="Booking Not Found"
        title="No booking information available"
        description="We couldn't find the booking details you're looking for. The session may have expired or the link may be incorrect."
      >
        <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(4,53,77,0.06)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Ico p={ICONS.calendar} size={28} sw={1.5} color={T.slate2} />
          </div>
          <h2 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy }}>Booking not found</h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
            The booking details you're looking for don't exist or may have been removed. Please check your appointments page or start a new booking.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={PATIENT_ROUTES.appointments} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 20px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, border: 'none', textDecoration: 'none' }}>
              View my appointments
            </Link>
            <Link href={PATIENT_ROUTES.dashboard} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 20px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Back to dashboard
            </Link>
          </div>
        </section>
      </PatientPortalShell>
    )
  }

  const parsedFee = fee ? Number(fee) : (physicianData.consultationFee ?? 0)

  const appointmentId = useMemo(() => {
    const prefix = physicianData.name.split(' ').pop()?.slice(0, 3).toUpperCase() ?? 'QRV'
    let hash = 0
    const str = `${physicianData.name}-${date}-${slot}`
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0 }
    const suffix = Math.abs(hash).toString().padStart(5, '0').slice(-5)
    return `QRV-${prefix}-${suffix}`
  }, [physicianData.name, date, slot])

  const bookingReference = useMemo(() => {
    let hash = 0
    const str = `ref-${date}-${slot}`
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0 }
    const suffix = Math.abs(hash).toString().padStart(3, '0').slice(-3)
    return `REF-20260810-${suffix}`
  }, [date, slot])

  const rightRailContent = (
    <div style={{ display: 'grid', gap: '12px' }}>
      <section style={{ ...Glass.pill, borderRadius: '22px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booking Snapshot</p>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            ['Physician', physicianData.name],
            ['Consultation', readLabel(service)],
            ['Date', date],
            ['Time', slot],
            ['Fee', formatFee(parsedFee)],
            ['Insurance', insurance || 'Not specified'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
              <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.blue }}>
            <Ico p={ICONS.lock} size={14} sw={1.8} />
          </div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>Protected care journey</p>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: T.slate, lineHeight: 1.6 }}>Your appointment details remain secure and ready for your care team. You can review everything at any time from your dashboard.</p>
        <HoverBtn
          onClick={() => {}}
          base={{
            minHeight: '40px',
            borderRadius: '12px',
            border: 'none',
            background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '0 12px',
            boxShadow: '0 6px 16px rgba(32,181,223,0.24)',
          }}
          on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(32,181,223,0.28)' }}
        >
          Manage reminders
          <Ico p={ICONS.arrowFwd} size={12} sw={2} />
        </HoverBtn>
      </section>
    </div>
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .success-hero { position: relative; overflow: hidden; padding: 28px; border-radius: 28px; background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(247,250,252,0.92) 100%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.float}; }
        .success-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.12), transparent 36%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.1), transparent 28%); pointer-events: none; }
        .success-grid { display: grid; gap: 14px; margin-top: 14px; }
        .success-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border-radius: 24px; border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; padding: 20px; }
        .success-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .success-check { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: rgba(32,181,223,0.12); color: ${T.blue}; flex-shrink: 0; }
        .success-animate { animation: qarevo-pop 0.8s ease both; }
        .success-float { animation: qarevo-float 3.4s ease-in-out infinite; }
        .mobile-sticky-actions { display: none; }
        @keyframes qarevo-pop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes qarevo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
      <PatientPortalShell
        eyebrow="Booking Complete"
        title="Booking Confirmed"
        description="Your consultation has been successfully scheduled. Details have been sent to your email and added to your care dashboard."
        rightRail={rightRailContent}
      >
          <section className='success-hero' style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div className='success-badge' style={{ marginBottom: '10px' }}>
                  <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />
                  Appointment secured
                </div>
                <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your Booking is Confirmed!</h1>
                <p style={{ margin: '0 0 16px', maxWidth: '720px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
                  Your consultation has been successfully scheduled. We have shared the appointment details with your email and updated your care dashboard for a smooth, confident start.
                </p>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '10px' }}>
                  <Link href='#' style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.26)' }}>
                    Add to Calendar
                  </Link>
                </div>
              </div>
              <div className='success-animate' style={{ width: '180px', height: '180px', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(32,181,223,0.12), rgba(165,224,218,0.28))', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.glow, display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
                <div className='success-float' style={{ width: '112px', height: '112px', borderRadius: '50%', background: 'rgba(255,255,255,0.82)', display: 'grid', placeItems: 'center', border: '1px solid rgba(32,181,223,0.16)' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(15,158,119,0.16), rgba(165,224,218,0.28))', display: 'grid', placeItems: 'center' }}>
                    <Ico p={ICONS.check} size={30} sw={2.6} color={T.green} />
                  </div>
                </div>
                <div style={{ position: 'absolute', right: '16px', top: '16px', width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(52,140,234,0.15)', border: '1px solid rgba(255,255,255,0.72)' }} />
                <div style={{ position: 'absolute', left: '16px', bottom: '16px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(32,181,223,0.2)' }} />
              </div>
            </div>
          </section>

          <div className='success-grid'>
            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appointment Summary</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your consultation is ready</h2>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', color: T.green, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Ico p={ICONS.check} size={10} sw={2.2} color={T.green} />
                  Verified
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physicianData.imageUrl ? (
                    <img src={physicianData.imageUrl} alt={physicianData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physicianData.experienceYears} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physicianData.languages.length ? physicianData.languages.join(', ') : 'Languages not listed'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Consultation Type', readLabel(service)],
                  ['Appointment Date', date],
                  ['Appointment Time', slot],
                  ['Timezone', 'Africa/Lagos (GMT+1)'],
                  ['Duration', duration],
                  ['Consultation Fee', formatFee(parsedFee)],
                  ['Insurance Coverage', insurance || 'Not specified'],
                  ['Appointment ID', appointmentId],
                  ['Booking Reference', bookingReference],
                  ['Patient Notes', notes || 'No additional notes provided'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>What Happens Next</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A thoughtful path from booking to care</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.blue }}>Timeline</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {timelineItems.map((item) => (
                  <div key={item.title} className={`success-step ${item.active ? 'active' : ''}`} style={{ transition: 'all 0.2s ease' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: item.active ? T.blue : T.teal, marginTop: '2px', boxShadow: item.active ? '0 0 0 6px rgba(32,181,223,0.12)' : '0 0 0 6px rgba(165,224,218,0.16)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px', color: T.navy }}>{item.title}</strong>
                        <span style={{ fontSize: '11px', color: T.slate2 }}>{item.time}</span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparation Checklist</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything you need for a calm visit</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.green }}>Ready</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {checklistItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div className='success-check' style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '10px' }}>
                      <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{item.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Calendar Integration</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Keep everything in sync</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.blue }}>Sync ready</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Add to Google Calendar', 'Add to Apple Calendar', 'Download ICS File', 'Sync Calendar'].map((action) => (
                  <button key={action} type='button' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    <span>{action}</span>
                    <Ico p={ICONS.arrowFwd} size={13} sw={1.8} color={T.blue} />
                  </button>
                ))}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Communication</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Stay informed and reassured</h2>
                </div>
                <button type='button' onClick={() => setReminderEnabled((value) => !value)} style={{ border: 'none', background: reminderEnabled ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.06)', color: reminderEnabled ? T.blue : T.slate2, padding: '7px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {reminderEnabled ? 'Preferences on' : 'Preferences off'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {communicationItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item.label}</span>
                    <span style={{ fontSize: '12px', color: item.tone, fontWeight: 700 }}>{item.state}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quick Actions</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Jump to what matters next</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {quickActions.map((action) => {
                  const active = hoveredAction === action.label
                  return (
                    <Link key={action.label} href={action.href} onMouseEnter={() => setHoveredAction(action.label)} onMouseLeave={() => setHoveredAction(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', borderRadius: '12px', background: active ? 'rgba(255,255,255,0.98)' : 'rgba(247,250,252,0.82)', border: '1px solid rgba(4,53,77,0.08)', textDecoration: 'none', transition: 'all 0.18s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: active ? 'rgba(32,181,223,0.14)' : 'rgba(165,224,218,0.2)', color: T.blue }}>
                          <Ico p={action.icon} size={14} sw={1.8} />
                        </span>
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{action.label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>{action.sub}</p>
                        </div>
                      </div>
                      <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={active ? '#348CEA' : T.slate2} />
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className='success-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Support</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Need help before your consultation?</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Contact Support', '/support'],
                  ['Live Chat', '/support'],
                  ['FAQs', '/support'],
                  ['Help Centre', '/support'],
                ].map(([label, href]) => (
                  <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)', textDecoration: 'none', color: T.navy, fontSize: '13px', fontWeight: 700 }}>
                    <span>{label}</span>
                    <Ico p={ICONS.arrowSm} size={13} sw={1.8} color={T.blue} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className='mobile-sticky-actions'>
            <Link href='/patient/appointment-details' style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 14px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.26)' }}>
              View Appointment Details
            </Link>
            <Link href={PATIENT_ROUTES.dashboard} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.94)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Return to Dashboard
            </Link>
          </div>
        </PatientPortalShell>
      </>
    )
}

function SuccessPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Finishing up</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Finalizing your appointment</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>We are preparing your confirmation details.</p>
        </div>
      </div>
    </main>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessPageFallback />}>
      <SuccessPageContent />
    </Suspense>
  )
}

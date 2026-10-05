'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

type ChecklistItem = {
  label: string
  hint: string
}

type DocumentItem = {
  label: string
  meta: string
  status: string
}

type MessageItem = {
  title: string
  body: string
  time: string
}



const checklistItems: ChecklistItem[] = [
  { label: 'Keep your ID ready', hint: 'A quick verification helps the visit start smoothly' },
  { label: 'Review your symptoms', hint: 'Highlight what feels new or urgent for the physician' },
  { label: 'Upload recent test results', hint: 'Recent reports help shape the plan of care' },
  { label: 'Test your camera and microphone', hint: 'A short check avoids delays before your visit' },
]

const documentItems: DocumentItem[] = [
  { label: 'Medication list', meta: 'Updated 2 days ago', status: 'Ready' },
  { label: 'Blood pressure trend', meta: 'Uploaded today', status: 'Shared' },
  { label: 'Recent labs', meta: 'Available in records', status: 'Ready' },
]

const messageItems: MessageItem[] = [
  { title: 'Prep note from your care team', body: 'Please join 10 minutes early and keep your medication list close by.', time: 'Just now' },
  { title: 'Insurance confirmation', body: 'Your selected plan is verified for this consultation.', time: '1h ago' },
]

function formatFee(value: number) {
  return `$${value}`
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

function parseSlotTime(slot: string): { hour: number; minute: number } | null {
  const normalized = slot.trim().toLowerCase().replace(/\s+/g, '')
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?(am|pm)?/)

  if (!match) {
    return null
  }

  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const suffix = match[3]

  if (suffix === 'pm' && hour < 12) {
    hour += 12
  }

  if (suffix === 'am' && hour === 12) {
    hour = 0
  }

  return { hour, minute }
}

function getAppointmentTarget(dateValue: string, slot: string) {
  const today = new Date()
  let dayOffset = 0

  const normalizedDate = dateValue.toLowerCase()
  if (normalizedDate.includes('tomorrow')) {
    dayOffset = 1
  }

  const parsed = parseSlotTime(slot)
  if (!parsed) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, 16, 30)
  }

  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, parsed.hour, parsed.minute)
}

function AppointmentDetailsPageContent() {
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId')
  const physician = physicianId ? PHYSICIANS.find((item) => item.id === physicianId) : null
  const service = searchParams.get('service')
  const fee = searchParams.get('fee')
  const duration = searchParams.get('duration')
  const insurance = searchParams.get('insurance')
  const date = searchParams.get('date')
  const slot = searchParams.get('slot')
  const notes = searchParams.get('notes')
  
  // Show error state if required appointment data is missing
  if (!physicianId || !date || !slot) {
    return (
      <PatientPortalShell
        eyebrow="Appointment Not Found"
        title="No appointment details available"
        description="We couldn't find the appointment you're looking for. It may have been cancelled, or the link may be incorrect."
      >
        <section className='appt-card' style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(4,53,77,0.06)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Ico p={ICONS.calendar} size={28} sw={1.5} color={T.slate2} />
          </div>
          <h2 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy }}>Appointment not found</h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
            The appointment details you're looking for don't exist or may have been removed. Please check your appointments page or contact support.
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
  
  const parsedFee = fee ? Number(fee) : (physician?.consultationFee ?? 0)
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const appointmentId = useMemo(() => {
    const prefix = physician?.name.split(' ').pop()?.slice(0, 3).toUpperCase() ?? 'QRV'
    let hash = 0
    const str = `${physician?.name ?? ''}-${date}-${slot}`
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0 }
    const suffix = Math.abs(hash).toString().padStart(5, '0').slice(-5)
    return `QRV-${prefix}-${suffix}`
  }, [physician?.name, date, slot])

  const bookingReference = useMemo(() => {
    let hash = 0
    const str = `ref-${date}-${slot}`
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0 }
    const suffix = Math.abs(hash).toString().padStart(3, '0').slice(-3)
    return `REF-20260810-${suffix}`
  }, [date, slot])

  const countdown = useMemo(() => {
    const target = getAppointmentTarget(date, slot)
    const diff = target.getTime() - now.getTime()

    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isLive: true }
    }

    const hours = Math.floor(diff / 1000 / 60 / 60)
    const minutes = Math.floor((diff / 1000 / 60) % 60)
    const seconds = Math.floor((diff / 1000) % 60)

    return { hours, minutes, seconds, isLive: false }
  }, [date, slot, now])

  const rightRailContent = (
    <section className='appt-card'>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ready to join</p>
      <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A smooth handoff to your consultation</h2>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>Review the key info, open the room at the right time, and stay supported by your care team from the moment the appointment begins.</p>

      <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
          <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Appointment</div>
          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{date} · {slot}</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
          <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Physician</div>
          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{physician?.name ?? 'Selected physician'}</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
          <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>How to join</div>
          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>Join 10 minutes early in a quiet place</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          { label: 'Open meeting room', sub: 'Use the join link when you are ready', icon: ICONS.video, href: `/patient/video-consultation/waiting-room?${searchParams.toString()}` },
          { label: 'Message physician', sub: 'Share a quick note before the visit', icon: ICONS.ema, href: PATIENT_ROUTES.messages },
          { label: 'Need help?', sub: 'Contact support immediately', icon: ICONS.shield, href: '/support' },
        ].map((action) => {
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
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .appt-hero { position: relative; overflow: hidden; padding: 28px; border-radius: 28px; background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(247,250,252,0.92) 100%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.float}; }
        .appt-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.12), transparent 36%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.1), transparent 28%); pointer-events: none; }
        .appt-grid { display: grid; gap: 14px; margin-top: 14px; }
        .appt-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border-radius: 24px; border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; padding: 20px; }
        .appt-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .appt-countdown { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .appt-countdown > div { padding: 10px; border-radius: 14px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.08); text-align: center; }
        @media (max-width: 640px) { .appt-countdown { grid-template-columns: 1fr; } }
      `}</style>
      <PatientPortalShell
        eyebrow="Pre-consultation Hub"
        title="Appointment Details"
        description="Everything for your visit is assembled here — physician profile, visit details, prep notes, and a simple path to join when it is time."
        rightRail={rightRailContent}
      >
          <section className='appt-hero' style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div className='appt-pill' style={{ marginBottom: '10px' }}>
                  <Ico p={ICONS.calendar} size={10} sw={2.2} color={T.blue} />
                  Pre-consultation hub
                </div>
                <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your consultation is almost ready</h1>
                <p style={{ margin: '0 0 16px', maxWidth: '720px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
                  Everything for your visit is assembled here — the physician profile, visit details, prep notes, and a simple path to join when it is time.
                </p>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '10px' }}>
                  <Link href={`/patient/video-consultation/waiting-room?${searchParams.toString()}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, border: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.26)', cursor: 'pointer', textDecoration: 'none' }}>
                    Join consultation now
                  </Link>
                  <Link href={PATIENT_ROUTES.dashboard} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                    Back to dashboard
                  </Link>
                </div>
              </div>
              <div style={{ minWidth: '240px', width: '280px', borderRadius: '24px', padding: '16px', background: 'rgba(255,255,255,0.74)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: Sh.glow }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Starts in</p>
                <div className='appt-countdown' style={{ marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '18px', color: T.navy }}>{String(countdown.hours).padStart(2, '0')}</strong>
                    <div style={{ fontSize: '10px', color: T.slate2, marginTop: '3px' }}>Hours</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: '18px', color: T.navy }}>{String(countdown.minutes).padStart(2, '0')}</strong>
                    <div style={{ fontSize: '10px', color: T.slate2, marginTop: '3px' }}>Minutes</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: '18px', color: T.navy }}>{String(countdown.seconds).padStart(2, '0')}</strong>
                    <div style={{ fontSize: '10px', color: T.slate2, marginTop: '3px' }}>Seconds</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.55 }}>
                  {countdown.isLive ? 'Your consultation window is now open.' : `Your appointment is scheduled for ${slot} on ${date}.`}
                </div>
              </div>
            </div>
          </section>

          <div className='appt-grid'>
            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your care partner</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.green }}>Verified</div>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '92px', height: '92px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physician?.name ?? 'Selected physician'}</h3>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physician?.specialty ?? 'Care Team'} · {physician?.hospital ?? 'Qarevo Care Network'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physician?.experienceYears ?? 12} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physician?.languages.join(', ') ?? 'English, French'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation details</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything you need to know</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Service', readLabel(service)],
                  ['Date', date],
                  ['Time', slot],
                  ['Duration', duration],
                  ['Fee', formatFee(parsedFee)],
                  ['Insurance', insurance],
                  ['Appointment ID', appointmentId],
                  ['Reference', bookingReference],
                  ['Notes', notes || 'No additional notes provided'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparation checklist</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A calm start to your visit</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.green }}>Ready</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {checklistItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.green }}>
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

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Document center</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Share what matters</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {documentItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{item.meta}</p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: T.blue }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Message preview</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A helpful note from your care team</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {messageItems.map((item) => (
                  <div key={item.title} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: T.navy }}>{item.title}</strong>
                      <span style={{ fontSize: '11px', color: T.slate2 }}>{item.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.6 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Device readiness</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Set up before the visit</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Stable internet connection', 'Recommended'],
                  ['Camera and microphone', 'Ready'],
                  ['Quiet environment', 'Suggested'],
                ].map(([label, state]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.blue, fontWeight: 700 }}>{state}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='appt-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reminder settings</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Stay calmly informed</h2>
                </div>
                <button type='button' onClick={() => setReminderEnabled((value) => !value)} style={{ border: 'none', background: reminderEnabled ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.06)', color: reminderEnabled ? T.blue : T.slate2, padding: '7px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {reminderEnabled ? 'Preferences on' : 'Preferences off'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Email confirmation', reminderEnabled ? 'Enabled' : 'Paused'],
                  ['SMS reminder', reminderEnabled ? 'Scheduled' : 'Paused'],
                  ['Calendar alert', reminderEnabled ? 'Active' : 'Off'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: reminderEnabled ? T.blue : T.slate2, fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </PatientPortalShell>
      </>
    )
}

export default function AppointmentDetailsPage() {
  return (
    <Suspense>
      <AppointmentDetailsPageContent />
    </Suspense>
  )
}

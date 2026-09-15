'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type ChecklistItem = {
  key: string
  label: string
  hint: string
}

type DeviceStatus = {
  label: string
  status: 'Ready' | 'Needs Attention' | 'Checking...'
  tone: string
}

type GuidelineItem = {
  title: string
  hint: string
  icon: string | readonly string[]
}


const checklistItems: ChecklistItem[] = [
  { key: 'camera', label: 'Camera Ready', hint: 'Your camera is positioned clearly and visible.' },
  { key: 'microphone', label: 'Microphone Ready', hint: 'Your microphone is connected and audible.' },
  { key: 'internet', label: 'Stable Internet', hint: 'A reliable connection helps the visit stay smooth.' },
  { key: 'quiet', label: 'Quiet Environment', hint: 'A calm setting helps your physician focus.' },
  { key: 'documents', label: 'Medical Documents Uploaded', hint: 'Recent records and reports are available.' },
  { key: 'questions', label: 'Questions Prepared', hint: 'Your notes are ready for review.' },
]

const guidelineItems: GuidelineItem[] = [
  { title: 'Join 5 minutes early', hint: 'A short buffer helps everything feel effortless.', icon: ICONS.calendar },
  { title: 'Use headphones if possible', hint: 'This keeps audio crisp and private.', icon: ICONS.video },
  { title: 'Ensure good lighting', hint: 'A bright face makes the visit feel more personal.', icon: ICONS.activity },
  { title: 'Keep previous medications nearby', hint: 'Helpful if your physician wants to review your history.', icon: ICONS.heart },
]

const reminderOptions = [
  { label: 'Email Reminder', value: 'Enabled' },
  { label: 'SMS Reminder', value: 'Scheduled' },
  { label: 'Push Notification', value: 'Active' },
  { label: 'Calendar Reminder', value: 'Synced' },
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

  if (dateValue.toLowerCase().includes('tomorrow')) {
    dayOffset = 1
  }

  const parsed = parseSlotTime(slot)
  if (!parsed) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, 16, 30)
  }

  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, parsed.hour, parsed.minute)
}

function WaitingRoomPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const service = searchParams.get('service') ?? 'video'
  const fee = Number(searchParams.get('fee') ?? physician?.consultationFee ?? 140)
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const notes = searchParams.get('notes') ?? ''

  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({
    camera: true,
    microphone: true,
    internet: true,
    quiet: true,
    documents: false,
    questions: false,
  })
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatus[]>([
    { label: 'Camera', status: 'Ready', tone: T.green },
    { label: 'Microphone', status: 'Ready', tone: T.green },
    { label: 'Speaker', status: 'Ready', tone: T.green },
    { label: 'Internet Connection', status: 'Checking...', tone: T.blue },
    { label: 'Browser Compatibility', status: 'Ready', tone: T.green },
    { label: 'Device Battery', status: 'Ready', tone: T.green },
  ])
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

  const canJoin = countdown.isLive || (countdown.hours === 0 && countdown.minutes <= 10)

  const completedCount = useMemo(() => Object.values(checklistState).filter(Boolean).length, [checklistState])
  const progressPercent = Math.round((completedCount / checklistItems.length) * 100)

  const handleToggleChecklist = (key: string) => {
    setChecklistState((value) => ({ ...value, [key]: !value[key] }))
  }

  const handleRunDeviceTest = () => {
    setDeviceStatuses((prev) => prev.map((item) => ({ ...item, status: 'Checking...', tone: T.blue })))

    window.setTimeout(() => {
      setDeviceStatuses([
        { label: 'Camera', status: 'Ready', tone: T.green },
        { label: 'Microphone', status: 'Ready', tone: T.green },
        { label: 'Speaker', status: 'Ready', tone: T.green },
        { label: 'Internet Connection', status: 'Ready', tone: T.green },
        { label: 'Browser Compatibility', status: 'Ready', tone: T.green },
        { label: 'Device Battery', status: 'Needs Attention', tone: T.amber },
      ])
    }, 1200)
  }

  const handleJoin = () => {
    if (!canJoin) return

    const query = new URLSearchParams({
      physicianId,
      service,
      fee: String(fee),
      duration,
      insurance,
      date,
      slot,
      notes,
      progress: String(progressPercent),
    })

    router.push(`/patient/video-consultation/device-check?${query.toString()}`)
  }

  const rightRailContent = (
    <section className='waiting-card'>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ready to join</p>
      <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A smooth handoff to your consultation</h2>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>Review the key info, complete the preparation items, and open the consultation room when you are ready.</p>

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
          <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Preparation</div>
          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{progressPercent}% complete</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          { label: 'Join Consultation', sub: canJoin ? 'You are now able to enter' : 'Available 10 minutes before your visit', icon: ICONS.video, href: '#', action: handleJoin },
          { label: 'Message Doctor', sub: 'Share a quick note before the visit', icon: ICONS.ema, href: PATIENT_ROUTES.messages },
          { label: 'Need Help?', sub: 'Contact support immediately', icon: ICONS.shield, href: '/support' },
        ].map((action) => {
          const active = hoveredAction === action.label
          const content = (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', borderRadius: '12px', background: active ? 'rgba(255,255,255,0.98)' : 'rgba(247,250,252,0.82)', border: '1px solid rgba(4,53,77,0.08)', textDecoration: 'none', transition: 'all 0.18s ease' }}>
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
            </div>
          )

          if (action.label === 'Join Consultation') {
            return (
              <button key={action.label} type='button' onClick={action.action as () => void} disabled={!canJoin} onMouseEnter={() => setHoveredAction(action.label)} onMouseLeave={() => setHoveredAction(null)} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: canJoin ? 'pointer' : 'not-allowed' }}>
                {content}
              </button>
            )
          }

          return (
            <Link key={action.label} href={action.href} onMouseEnter={() => setHoveredAction(action.label)} onMouseLeave={() => setHoveredAction(null)} style={{ textDecoration: 'none' }}>
              {content}
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
        .waiting-hero { position: relative; overflow: hidden; padding: 28px; border-radius: 28px; background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(247,250,252,0.92) 100%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.float}; }
        .waiting-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.12), transparent 36%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.1), transparent 28%); pointer-events: none; }
        .waiting-grid { display: grid; gap: 14px; margin-top: 14px; }
        .waiting-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border-radius: 24px; border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; padding: 20px; }
        .waiting-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .waiting-countdown { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .waiting-countdown > div { padding: 10px; border-radius: 14px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.08); text-align: center; }
        .waiting-check-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(247,250,252,0.86); border: 1px solid rgba(4,53,77,0.08); transition: all 0.2s ease; }
        .waiting-check-item.completed { background: rgba(165,224,218,0.18); border-color: rgba(32,181,223,0.16); }
        .waiting-float { animation: qarevo-float 3.4s ease-in-out infinite; }
        .mobile-join { display: none; }
        @keyframes qarevo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
      <PatientPortalShell
        eyebrow="Virtual Visit"
        title="Virtual Waiting Room"
        description="Please review your appointment details and complete the preparation checklist before joining."
        rightRail={rightRailContent}
      >
          <section className='waiting-hero' style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div className='waiting-pill' style={{ marginBottom: '10px' }}>
                  <Ico p={ICONS.video} size={10} sw={2.2} color={T.blue} />
                  Video Consultation
                </div>
                <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your consultation is almost ready to begin</h1>
                <p style={{ margin: '0 0 16px', maxWidth: '720px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
                  Please review your appointment details and complete the quick preparation checklist before joining. Your care team is ready, and everything is in place for a calm, confident visit.
                </p>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button type='button' onClick={handleJoin} disabled={!canJoin} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 16px', borderRadius: '12px', background: canJoin ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.08)', color: canJoin ? '#fff' : T.slate2, fontSize: '13px', fontWeight: 700, border: 'none', boxShadow: canJoin ? '0 8px 22px rgba(32,181,223,0.26)' : 'none', cursor: canJoin ? 'pointer' : 'not-allowed', opacity: canJoin ? 1 : 0.8 }}>
                    Join Consultation
                  </button>
                  <Link href='/patient/appointment-details' style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                    Review Details
                  </Link>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: T.slate2, lineHeight: 1.6 }}>
                  The Join Consultation button becomes available 10 minutes before your scheduled appointment.
                </p>
              </div>
              <div style={{ minWidth: '240px', width: '280px', borderRadius: '24px', padding: '16px', background: 'rgba(255,255,255,0.74)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: Sh.glow }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation begins in</p>
                <div className='waiting-countdown' style={{ marginBottom: '10px' }}>
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

          <div className='waiting-grid'>
            <section className='waiting-card'>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physician?.experienceYears ?? 0} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physician?.languages.join(', ') ?? 'Languages not listed'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.zap} size={12} sw={1.75} color={T.blue} />{physician && physician.reviews > 0 ? `${physician.rating} rating` : 'No ratings yet'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation summary</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your visit details at a glance</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Consultation Type', readLabel(service)],
                  ['Appointment Date', date],
                  ['Appointment Time', slot],
                  ['Duration', duration],
                  ['Booking Reference', bookingReference],
                  ['Consultation Fee', formatFee(fee)],
                  ['Insurance Status', insurance],
                  ['Appointment ID', appointmentId],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparation checklist</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything is set for a calm visit</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.blue }}>{progressPercent}% ready</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {checklistItems.map((item) => {
                  const completed = checklistState[item.key]
                  return (
                    <button key={item.key} type='button' onClick={() => handleToggleChecklist(item.key)} className={`waiting-check-item ${completed ? 'completed' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: completed ? 'rgba(32,181,223,0.14)' : 'rgba(4,53,77,0.06)', color: completed ? T.green : T.slate2 }}>
                        <Ico p={ICONS.check} size={12} sw={2.4} color={completed ? T.green : T.slate2} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.label}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{item.hint}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Device status</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A quick check before you enter</h2>
                </div>
                <button type='button' onClick={handleRunDeviceTest} style={{ border: 'none', background: 'rgba(32,181,223,0.12)', color: T.blue, padding: '7px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  Run Device Test
                </button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {deviceStatuses.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item.label}</span>
                    <span style={{ fontSize: '12px', color: item.tone, fontWeight: 700 }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upload documents</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Share anything new before your visit</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Medical Reports', 'Lab Results', 'X-Ray Images', 'Prescriptions', 'Insurance Documents'].map((title) => (
                  <div key={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{title}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>Optional upload</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type='button' style={{ border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.92)', color: T.navy, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Upload</button>
                      <button type='button' style={{ border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.92)', color: T.navy, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Preview</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient notes</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Share anything you would like reviewed</h2>
                </div>
              </div>
              <textarea placeholder='Add any additional information or questions you would like your physician to review before the consultation begins.' style={{ width: '100%', minHeight: '130px', borderRadius: '16px', border: '1px solid rgba(4,53,77,0.1)', padding: '12px 14px', fontSize: '13px', color: T.navy, background: 'rgba(247,250,252,0.86)', resize: 'vertical' }} defaultValue={notes} />
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation guidelines</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A premium, calm start</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {guidelineItems.map((item) => (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.blue }}>
                      <Ico p={item.icon} size={13} sw={1.8} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{item.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Messages</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Recent conversation</h2>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.blue }}>2 unread</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { title: 'Pre-consultation note', body: 'Please keep your medication list close by and join a few minutes early.', time: 'Just now' },
                  { title: 'Insurance confirmed', body: 'Your selected plan is ready for today’s appointment.', time: '1h ago' },
                ].map((item) => (
                  <div key={item.title} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: T.navy }}>{item.title}</strong>
                      <span style={{ fontSize: '11px', color: T.slate2 }}>{item.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.55 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reminders</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Stay informed without overwhelm</h2>
                </div>
                <button type='button' onClick={() => setReminderEnabled((value) => !value)} style={{ border: 'none', background: reminderEnabled ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.06)', color: reminderEnabled ? T.blue : T.slate2, padding: '7px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {reminderEnabled ? 'Preferences on' : 'Preferences off'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {reminderOptions.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item.label}</span>
                    <span style={{ fontSize: '12px', color: reminderEnabled ? T.blue : T.slate2, fontWeight: 700 }}>{reminderEnabled ? item.value : 'Paused'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='waiting-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Support</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Need help before your consultation?</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Need Help?', 'Live Chat', 'Contact Support', 'Technical Assistance', 'Frequently Asked Questions'].map((label) => (
                  <Link key={label} href='/support' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)', textDecoration: 'none', color: T.navy, fontSize: '13px', fontWeight: 700 }}>
                    <span>{label}</span>
                    <Ico p={ICONS.arrowSm} size={13} sw={1.8} color={T.blue} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className='mobile-join'>
            <button type='button' onClick={handleJoin} disabled={!canJoin} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 14px', borderRadius: '12px', background: canJoin ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.08)', color: canJoin ? '#fff' : T.slate2, fontSize: '13px', fontWeight: 700, border: 'none', boxShadow: canJoin ? '0 8px 22px rgba(32,181,223,0.26)' : 'none', cursor: canJoin ? 'pointer' : 'not-allowed' }}>
              Join Consultation
            </button>
            <Link href='/patient/appointment-details' style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.94)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Review Details
            </Link>
          </div>
        </PatientPortalShell>
      </>
    )
}

export default function WaitingRoomPage() {
  return (
    <Suspense>
      <WaitingRoomPageContent />
    </Suspense>
  )
}

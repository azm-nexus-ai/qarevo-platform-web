'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import ReviewModal from '@/components/patient/ReviewModal'
import { apiGet, apiPost, getApiErrorDetail } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | 'Confirmed'
  | 'Today'
  | 'Starting Soon'
  | 'Waiting'
  | 'Rescheduled'
  | 'Completed'
  | 'Cancelled'

type ConsultationType = 'Video Consultation' | 'In-Person' | 'Follow-Up' | 'Second Opinion'

type Appointment = {
  id: string
  physician: string
  specialty: string
  hospital: string
  imageUrl: string
  consultationType: ConsultationType
  date: string
  time: string
  duration: string
  status: AppointmentStatus
  bookingRef: string
  reason: string
  paymentStatus: 'Paid' | 'Pending' | 'Refunded'
  startAt: string
  cancellationDate?: string
  cancellationReason?: string
  hasSummary?: boolean
  hasPrescription?: boolean
  hasLabRequest?: boolean
  hasReviewed?: boolean
}

type ApiAppointment = {
  id: string
  consultation_modality?: string | null
  start_at?: string | null
  end_at?: string | null
  status?: string | null
  payment_status?: string | null
}

function normalizeAppointmentStatus(status?: string | null): AppointmentStatus {
  const normalized = status?.toUpperCase()
  if (normalized === 'CANCELLED') return 'Cancelled'
  if (normalized === 'COMPLETED') return 'Completed'
  if (normalized === 'RESCHEDULED') return 'Rescheduled'
  return 'Confirmed'
}

function normalizePaymentStatus(status?: string | null): Appointment['paymentStatus'] {
  const normalized = status?.toUpperCase()
  if (normalized === 'REFUNDED') return 'Refunded'
  if (normalized === 'PENDING') return 'Pending'
  return 'Paid'
}

type Tab = 'upcoming' | 'past' | 'cancelled'

// ─── Badge ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg: Record<AppointmentStatus, { bg: string; color: string; dot?: string }> = {
    'Today':          { bg: 'rgba(32,181,223,0.12)',  color: T.blue,  dot: T.blue  },
    'Starting Soon':  { bg: 'rgba(217,119,6,0.12)',   color: T.amber, dot: T.amber },
    'Confirmed':      { bg: 'rgba(15,158,119,0.12)',  color: T.green, dot: T.green },
    'Waiting':        { bg: 'rgba(32,181,223,0.1)',   color: T.blue               },
    'Rescheduled':    { bg: 'rgba(52,140,234,0.12)',  color: '#348CEA'            },
    'Completed':      { bg: 'rgba(15,158,119,0.1)',   color: T.green              },
    'Cancelled':      { bg: 'rgba(220,38,38,0.1)',    color: T.red                },
  }
  const s = cfg[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>
      {s.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />}
      {status}
    </span>
  )
}

// ─── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ConsultationType }) {
  const isVideo = type === 'Video Consultation'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, ...Glass.chip, color: isVideo ? T.blue : T.slate }}>
      <Ico p={isVideo ? ICONS.video : ICONS.steth} size={11} sw={1.8} />
      {type}
    </span>
  )
}

// ─── Section card shell ────────────────────────────────────────────────────────

function SCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Today banner ──────────────────────────────────────────────────────────────

function TodayBanner({ appt, onJoin, onDetails }: { appt: Appointment; onJoin: () => void; onDetails: () => void }) {
  const [countdown, setCountdown] = useState('2h 14m')

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const target = new Date()
      target.setHours(16, 30, 0, 0)
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) { setCountdown('Starting now'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(32,181,223,0.08) 0%, rgba(52,140,234,0.08) 100%)',
      border: '1px solid rgba(32,181,223,0.22)',
      borderRadius: '20px',
      padding: '20px',
      marginBottom: '14px',
      boxShadow: '0 0 0 3px rgba(32,181,223,0.05), ' + Sh.glow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.blue, boxShadow: '0 0 0 3px rgba(32,181,223,0.2)', animation: 'appt-pulse 2s infinite' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.blue }}>
          {"Today's Appointment"}
        </span>
      </div>
      <div className='appt-today-grid'>
        <Image
          src={appt.imageUrl}
          alt={appt.physician}
          width={80}
          height={80}
          loading="eager"
          style={{ width: '80px', height: '80px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.12)', boxShadow: '0 6px 16px rgba(4,53,77,0.14)', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: '0 0 3px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.025em', color: T.navy }}>{appt.physician}</h3>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <TypeBadge type={appt.consultationType} />
            <StatusBadge status={appt.status} />
            <span style={{ fontSize: '12.5px', color: T.slate }}>
              <strong style={{ color: T.navy }}>{appt.time}</strong> · {appt.duration}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>Starts in</p>
            <p style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.blue }}>{countdown}</p>
          </div>
          <HoverBtn
            onClick={onJoin}
            base={{ minHeight: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(32,181,223,0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 10px 24px rgba(52,140,234,0.35)' }}
          >
            <Ico p={ICONS.video} size={14} sw={1.8} color="#fff" />
            Join Consultation
          </HoverBtn>
          <HoverBtn
            onClick={onDetails}
            base={{ minHeight: '40px', padding: '0 16px', borderRadius: '11px', border: '1px solid rgba(4,53,77,0.13)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            View Details
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Upcoming card ─────────────────────────────────────────────────────────────

function UpcomingCard({ appt, onJoin, onDetails, onReschedule, onCancel }: {
  appt: Appointment
  onJoin: () => void
  onDetails: () => void
  onReschedule: () => void
  onCancel: () => void
}) {
  const showJoin = appt.status === 'Starting Soon' || appt.status === 'Today'

  return (
    <SCard style={{ padding: '18px' }}>
      <div className='appt-card-grid'>
        <Image
          src={appt.imageUrl}
          alt={appt.physician}
          width={72}
          height={72}
          loading="lazy"
          style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.1)', boxShadow: '0 4px 12px rgba(4,53,77,0.12)', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: '12.5px', color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              {appt.date} · {appt.time}
            </span>
            <span style={{ fontSize: '12.5px', color: T.slate }}>· {appt.duration}</span>
          </div>
          <div style={{ fontSize: '11.5px', color: T.slate2 }}>
            Ref: <span style={{ fontWeight: 600, color: T.slate, fontFamily: 'monospace' }}>{appt.bookingRef}</span>
          </div>
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {showJoin && (
            <HoverBtn
              onClick={onJoin}
              base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.28)' }}
              on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.34)' }}
            >
              <Ico p={ICONS.video} size={12} sw={1.8} color="#fff" />
              Join Consultation
            </HoverBtn>
          )}
          <HoverBtn
            onClick={onDetails}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            View Details
          </HoverBtn>
          <HoverBtn
            onClick={onReschedule}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.slate, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Reschedule
          </HoverBtn>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: T.red, fontWeight: 600, padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            Cancel Appointment
          </button>
        </div>
      </div>
    </SCard>
  )
}

function PastCard({ appt, onReview }: { appt: Appointment; onReview: (appt: Appointment) => void }) {
  const router = useRouter()
  return (
    <SCard style={{ padding: '18px' }}>
      <div className='appt-card-grid'>
        <Image
          src={appt.imageUrl}
          alt={appt.physician}
          width={72}
          height={72}
          loading="lazy"
          style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.1)', boxShadow: '0 4px 12px rgba(4,53,77,0.08)', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status="Completed" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: '12.5px', color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              {appt.date} · {appt.time}
            </span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.5 }}>{appt.reason}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {appt.hasSummary && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', color: T.green, fontSize: '11px', fontWeight: 600 }}>
                <Ico p={ICONS.check} size={10} sw={1.8} color={T.green} />
                Summary
              </span>
            )}
            {appt.hasPrescription && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '11px', fontWeight: 600 }}>
                <Ico p={ICONS.pill} size={10} sw={1.8} color={T.blue} />
                Prescription
              </span>
            )}
            {appt.hasLabRequest && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(52,140,234,0.1)', color: '#348CEA', fontSize: '11px', fontWeight: 600 }}>
                <Ico p={ICONS.activity} size={10} sw={1.8} color='#348CEA' />
                Lab Request
              </span>
            )}
          </div>
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <Link
            href={PATIENT_ROUTES.appointmentDetails}
            style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            View Details
          </Link>
          {appt.hasPrescription && (
            <Link
              href={PATIENT_ROUTES.prescriptions}
              style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
            >
              View Prescription
            </Link>
          )}
          {!appt.hasReviewed && (
            <HoverBtn
              onClick={() => onReview(appt)}
              base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.24)' }}
              on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.3)' }}
            >
              Write Review
            </HoverBtn>
          )}
          <HoverBtn
            onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.slate, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Book Follow-Up
          </HoverBtn>
        </div>
      </div>
    </SCard>
  )
}

// ─── Cancelled card ────────────────────────────────────────────────────────────

function CancelledCard({ appt }: { appt: Appointment }) {
  const router = useRouter()
  return (
    <SCard style={{ padding: '18px', opacity: 0.88 }}>
      <div className='appt-card-grid'>
        <Image
          src={appt.imageUrl}
          alt={appt.physician}
          width={72}
          height={72}
          loading="lazy"
          style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.1)', boxShadow: '0 4px 12px rgba(4,53,77,0.08)', flexShrink: 0, filter: 'grayscale(25%)' }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status="Cancelled" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: '12.5px', color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              Original: {appt.date} · {appt.time}
            </span>
          </div>
          {appt.cancellationDate && (
            <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate }}>
              Cancelled on {appt.cancellationDate}
            </p>
          )}
          {appt.cancellationReason && (
            <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>{appt.cancellationReason}</p>
          )}
          {appt.paymentStatus === 'Refunded' && (
            <span style={{ display: 'inline-block', marginTop: '8px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', color: T.green, fontSize: '11px', fontWeight: 700 }}>
              Payment Refunded
            </span>
          )}
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <Link
            href={PATIENT_ROUTES.appointmentDetails}
            style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            View Details
          </Link>
          <HoverBtn
            onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.24)' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.3)' }}
          >
            Book Again
          </HoverBtn>
        </div>
      </div>
    </SCard>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, onAction }: { tab: Tab; onAction: () => void }) {
  const cfg = {
    upcoming: {
      icon: ICONS.calendar,
      title: 'No upcoming appointments',
      desc: "You don't have any consultations scheduled yet. Find a doctor and book your first appointment.",
      cta: 'Find a Doctor',
    },
    past: {
      icon: ICONS.activity,
      title: 'No past appointments yet',
      desc: 'Completed appointments and consultation summaries will appear here.',
      cta: null as string | null,
    },
    cancelled: {
      icon: ICONS.shield,
      title: 'No cancelled appointments',
      desc: 'Cancelled or withdrawn appointments will appear here.',
      cta: null as string | null,
    },
  }[tab]

  return (
    <div style={{ padding: '52px 24px', textAlign: 'center', borderRadius: '20px', border: '1px dashed rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.82)' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Ico p={cfg.icon} size={24} sw={1.5} color={T.blue} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em' }}>{cfg.title}</h3>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: T.slate, lineHeight: 1.65, maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>{cfg.desc}</p>
      {cfg.cta && (
        <HoverBtn
          onClick={onAction}
          base={{ minHeight: '44px', padding: '0 22px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.28)' }}
          on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.32)' }}
        >
          <Ico p={ICONS.steth} size={14} sw={1.8} color="#fff" />
          {cfg.cta}
        </HoverBtn>
      )}
    </div>
  )
}

// ─── Reschedule Modal ──────────────────────────────────────────────────────────

const TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM']
const DAYS = ['Mon, Aug 11', 'Tue, Aug 12', 'Wed, Aug 13', 'Thu, Aug 14', 'Fri, Aug 15']

function RescheduleModal({ appt, onClose, onConfirm }: { appt: Appointment; onClose: () => void; onConfirm: () => void }) {
  const [selDay, setSelDay] = useState(DAYS[0])
  const [selTime, setSelTime] = useState('')

  const handleConfirm = () => {
    if (!selTime) return
    onConfirm()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div
        aria-hidden
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reschedule appointment"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: Sh.float,
          padding: '28px',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Reschedule Appointment</h2>
            <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>{appt.physician} · {appt.specialty}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid rgba(4,53,77,0.12)', borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.slate2 }}>Select a date</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {DAYS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setSelDay(d)}
              style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${selDay === d ? T.blue : 'rgba(4,53,77,0.12)'}`, background: selDay === d ? 'rgba(32,181,223,0.1)' : 'rgba(255,255,255,0.9)', color: selDay === d ? T.blue : T.slate, fontSize: '12.5px', fontWeight: selDay === d ? 700 : 500, cursor: 'pointer', transition: 'all 0.12s' }}
            >
              {d}
            </button>
          ))}
        </div>

        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.slate2 }}>Available times</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '24px' }}>
          {TIMES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setSelTime(t)}
              style={{ padding: '10px 8px', borderRadius: '10px', border: `1px solid ${selTime === t ? T.blue : 'rgba(4,53,77,0.12)'}`, background: selTime === t ? 'rgba(32,181,223,0.1)' : 'rgba(255,255,255,0.9)', color: selTime === t ? T.blue : T.slate, fontSize: '12.5px', fontWeight: selTime === t ? 700 : 500, cursor: 'pointer', transition: 'all 0.12s', textAlign: 'center' }}
            >
              {t}
            </button>
          ))}
        </div>

        {selTime && (
          <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '14px', background: 'rgba(32,181,223,0.06)', border: '1px solid rgba(32,181,223,0.18)' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: T.navy }}>
              New appointment: <span style={{ color: T.blue }}>{selDay} at {selTime}</span>
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <HoverBtn
            onClick={handleConfirm}
            base={{ flex: 1, minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: 'none', background: selTime ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: selTime ? '#fff' : T.slate2, fontSize: '13.5px', fontWeight: 700, cursor: selTime ? 'pointer' : 'not-allowed', boxShadow: selTime ? '0 5px 16px rgba(32,181,223,0.28)' : 'none' }}
            on={selTime ? { transform: 'translateY(-1px)' } : {}}
          >
            Confirm Reschedule
          </HoverBtn>
          <HoverBtn
            onClick={onClose}
            base={{ minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Cancel
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({ appt, onClose, onConfirm }: { appt: Appointment; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(reason || 'Patient requested cancellation')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cancel appointment confirmation"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '28px' }}
      >
        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 18px' }}>
          <Ico p={ICONS.calendar} size={22} sw={1.5} color={T.red} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Cancel Appointment?</h2>
        <p style={{ margin: '0 0 6px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>
          Are you sure you want to cancel your consultation with <strong style={{ color: T.navy }}>{appt.physician}</strong>?
        </p>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: T.slate2 }}>
          {appt.date} · {appt.time} · {appt.consultationType}
        </p>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
            Reason for cancellation (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please let us know why you're cancelling..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.15)',
              background: 'rgba(255,255,255,0.9)',
              fontSize: '13px',
              color: T.navy,
              resize: 'vertical',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <HoverBtn
            onClick={onClose}
            base={{ flex: 1, minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.13)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Keep Appointment
          </HoverBtn>
          <HoverBtn
            onClick={handleConfirm}
            base={{ minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(255,245,245,0.96)', color: T.red, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
            on={{ background: 'rgba(255,238,238,0.98)', transform: 'translateY(-1px)' }}
          >
            Cancel Appointment
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Success toast ─────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 300, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(15,158,119,0.22)', boxShadow: '0 8px 28px rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600 }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(15,158,119,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ico p={ICONS.check} size={13} sw={2.2} color={T.green} />
      </span>
      {message}
    </div>
  )
}

// ─── Page Inner ────────────────────────────────────────────────────────────────

function AppointmentsPageInner() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [cancelled, setCancelled] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<Appointment | null>(null)

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const data = await apiGet<{ appointments?: ApiAppointment[] }>('/api/v1/patient/appointments')
        const appointments = data.appointments || []
        const transformed: Appointment[] = appointments
          .filter((apt): apt is ApiAppointment & { start_at: string } => Boolean(apt.start_at))
          .map((apt) => {
            const startsAt = new Date(apt.start_at)
            return {
            id: apt.id,
            physician: 'Assigned physician',
            specialty: 'Care team',
            hospital: 'Qarevo Health',
            imageUrl: '/icons/profilePic.svg',
            consultationType: apt.consultation_modality === 'in_person' ? 'In-Person' : 'Video Consultation',
            date: startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: '30 min',
            status: normalizeAppointmentStatus(apt.status),
            bookingRef: `QRV-${apt.id.slice(0, 8)}`,
            reason: 'Consultation',
            paymentStatus: normalizePaymentStatus(apt.payment_status),
            startAt: apt.start_at,
            hasSummary: normalizeAppointmentStatus(apt.status) === 'Completed',
          }
        })
          
        const now = new Date()
        const upcomingApts = transformed.filter((apt) =>
          apt.status !== 'Cancelled' && apt.status !== 'Completed' && new Date(apt.startAt) > now
        )
        const cancelledApts = transformed.filter((apt) => apt.status === 'Cancelled')
        const pastApts = transformed.filter((apt) =>
          apt.status === 'Completed' || new Date(apt.startAt) <= now
        )

        setUpcoming(upcomingApts)
        setCancelled(cancelledApts)
        setPast(pastApts)
      } catch (error) {
        console.error('Failed to fetch appointments:', error)
        setToast(getApiErrorDetail(error) || 'Failed to load appointments.')
      } finally {
        setLoading(false)
      }
    }
    fetchAppointments()
  }, [])

  const todayAppt = upcoming.find(a => a.date === 'Today')

  const handleJoin = () => {
    router.push('/patient/video-consultation/waiting-room')
  }

  const handleDetails = () => {
    router.push(PATIENT_ROUTES.appointmentDetails)
  }

  const handleRescheduleConfirm = () => {
    setRescheduleTarget(null)
    setToast('Appointment rescheduled successfully.')
  }

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelTarget) return

    try {
      await apiPost(`/api/v1/appointments/${cancelTarget.id}/cancel?reason=${encodeURIComponent(reason)}`)
      const appt: Appointment = { ...cancelTarget, status: 'Cancelled', cancellationDate: 'Today', cancellationReason: reason, paymentStatus: 'Refunded' }
      setUpcoming(prev => prev.filter(a => a.id !== cancelTarget.id))
      setCancelled(prev => [appt, ...prev])
      setCancelTarget(null)
      setToast('Appointment cancelled. A refund has been initiated.')
      if (upcoming.filter(a => a.id !== cancelTarget.id).length === 0) {
        setActiveTab('cancelled')
      }
    } catch (error) {
      setToast(getApiErrorDetail(error) || 'Failed to cancel appointment. Please try again.')
    }
  }

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!reviewTarget) return
    
    try {
      await apiPost('/api/v1/patient/reviews', {
        rating,
        comment,
        appointment_id: reviewTarget.id,
      })
      setToast('Review submitted successfully!')
      setPast(prev => prev.map(appt => appt.id === reviewTarget.id ? { ...appt, hasReviewed: true } : appt))
      setReviewTarget(null)
    } catch (error) {
      setToast(getApiErrorDetail(error) || 'Failed to submit review. Please try again.')
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'past', label: 'Past', count: past.length },
    { key: 'cancelled', label: 'Cancelled', count: cancelled.length },
  ]

  const bookButton = (
    <HoverBtn
      onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
      base={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.3)', whiteSpace: 'nowrap' }}
      on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' }}
    >
      <Ico p={ICONS.calendar} size={14} sw={1.8} color="#fff" />
      + Book Consultation
    </HoverBtn>
  )

  if (loading) {
    return (
      <PatientPortalShell
        eyebrow="Patient Platform"
        title="Appointments"
        description="Manage your upcoming consultations, view past appointments, and keep track of your healthcare schedule."
        headerActions={bookButton}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
          Loading your appointments...
        </div>
      </PatientPortalShell>
    )
  }

  return (
    <>
      <style>{`
        @keyframes appt-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(32,181,223,0.5); }
          70%  { box-shadow: 0 0 0 7px rgba(32,181,223,0); }
          100% { box-shadow: 0 0 0 0 rgba(32,181,223,0); }
        }
        .appt-today-grid {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: center;
        }
        .appt-card-grid {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: start;
        }
        .appt-card-actions { flex-shrink: 0; min-width: 160px; }
        @media (max-width: 640px) {
          .appt-today-grid { grid-template-columns: auto 1fr; }
          .appt-today-grid > :last-child { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; }
          .appt-card-grid { grid-template-columns: auto 1fr; }
          .appt-card-actions { grid-column: 1 / -1; flex-direction: row !important; align-items: center !important; flex-wrap: wrap; }
        }
        @media (max-width: 420px) {
          .appt-today-grid { grid-template-columns: 1fr; }
          .appt-card-grid { grid-template-columns: 1fr; }
          .appt-card-actions { grid-column: unset; }
        }
      `}</style>

      <PatientPortalShell
        eyebrow="Patient Platform"
        title="Appointments"
        description="Manage your upcoming consultations, view past appointments, and keep track of your healthcare schedule."
        headerActions={bookButton}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(4,53,77,0.04)', borderRadius: '12px', padding: '4px' }}>
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{ flex: 1, minHeight: '38px', padding: '0 12px', borderRadius: '9px', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? T.navy : T.slate2, fontSize: '13px', fontWeight: activeTab === key ? 700 : 500, cursor: 'pointer', transition: 'all 0.14s', boxShadow: activeTab === key ? '0 1px 4px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {label}
              {count > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '18px', padding: '0 5px', borderRadius: '999px', background: activeTab === key ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.08)', color: activeTab === key ? T.blue : T.slate2, fontSize: '10.5px', fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* UPCOMING */}
          {activeTab === 'upcoming' && (
            <>
              {todayAppt && (
                <TodayBanner
                  appt={todayAppt}
                  onJoin={handleJoin}
                  onDetails={handleDetails}
                />
              )}
              {upcoming.filter(a => a.date !== 'Today').length > 0 && (
                <SCard>
                  <h2 style={{ margin: '0 0 14px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Upcoming Consultations</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {upcoming.filter(a => a.date !== 'Today').map(appt => (
                      <UpcomingCard
                        key={appt.id}
                        appt={appt}
                        onJoin={handleJoin}
                        onDetails={handleDetails}
                        onReschedule={() => setRescheduleTarget(appt)}
                        onCancel={() => setCancelTarget(appt)}
                      />
                    ))}
                  </div>
                </SCard>
              )}
              {todayAppt && (
                <SCard style={{ padding: '18px' }}>
                  <UpcomingCard
                    appt={todayAppt}
                    onJoin={handleJoin}
                    onDetails={handleDetails}
                    onReschedule={() => setRescheduleTarget(todayAppt)}
                    onCancel={() => setCancelTarget(todayAppt)}
                  />
                </SCard>
              )}
              {upcoming.length === 0 && (
                <EmptyState tab="upcoming" onAction={() => router.push(PATIENT_ROUTES.findDoctor)} />
              )}
            </>
          )}

          {/* PAST */}
          {activeTab === 'past' && (
            <>
              {past.length > 0 ? (
                <SCard>
                  <h2 style={{ margin: '0 0 14px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Completed Appointments</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {past.map(appt => <PastCard key={appt.id} appt={appt} onReview={setReviewTarget} />)}
                  </div>
                </SCard>
              ) : (
                <EmptyState tab="past" onAction={() => {}} />
              )}
            </>
          )}

          {/* CANCELLED */}
          {activeTab === 'cancelled' && (
            <>
              {cancelled.length > 0 ? (
                <SCard>
                  <h2 style={{ margin: '0 0 14px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Cancelled Appointments</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cancelled.map(appt => <CancelledCard key={appt.id} appt={appt} />)}
                  </div>
                </SCard>
              ) : (
                <EmptyState tab="cancelled" onAction={() => {}} />
              )}
            </>
          )}
        </div>
      </PatientPortalShell>

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          appt={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={handleRescheduleConfirm}
        />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelModal
          appt={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          isOpen={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSubmit}
          physicianName={reviewTarget.physician}
          appointmentId={reviewTarget.id}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}

export default function PatientAppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsPageInner />
    </Suspense>
  )
}

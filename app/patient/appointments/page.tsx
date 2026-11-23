'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import DoctorAvatar from '@/components/cards/DoctorAvatar'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import AppointmentRescheduleDialog from '@/components/patient/AppointmentRescheduleDialog'
import ReviewModal from '@/components/patient/ReviewModal'
import { apiGet, apiPost, getApiErrorDetail } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | 'Unknown'
  | 'No show'
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
  imageUrl?: string | null
  consultationType: ConsultationType
  date: string
  time: string
  duration: string
  status: AppointmentStatus
  bookingRef: string
  reason: string
  paymentStatus: 'Paid' | 'Pending' | 'Refunded' | 'Not configured'
  startAt: string
  endAt: string
  consultationId?: string | null
  providerId?: string | null
  cancellationDate?: string
  cancellationReason?: string
  hasSummary?: boolean
  hasPrescription?: boolean
  hasLabRequest?: boolean
  hasReviewed?: boolean
}

type ApiAppointment = {
  id: string
  consultation_id?: string | null
  provider_id?: string | null
  provider_name?: string | null
  provider_image_url?: string | null
  specialty?: string | null
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
  if (['BOOKED', 'SCHEDULED', 'CONFIRMED'].includes(normalized || '')) return 'Confirmed'
  if (normalized === 'NO_SHOW') return 'No show'
  return 'Unknown'
}

function normalizePaymentStatus(status?: string | null): Appointment['paymentStatus'] {
  const normalized = status?.toUpperCase()
  if (normalized === 'REFUNDED') return 'Refunded'
  if (normalized === 'PENDING') return 'Pending'
  if (normalized === 'PAID') return 'Paid'
  return 'Not configured'
}

type Tab = 'upcoming' | 'past' | 'cancelled'

// ─── Badge ─────────────────────────────────────────────────────────────────────

const STATUS_KEYS: Record<AppointmentStatus, string> = {"Unknown": "statusUnknown", "No show": "statusNoShow", "Confirmed": "statusConfirmed", "Today": "statusToday", "Starting Soon": "statusStartingSoon", "Waiting": "statusWaiting", "Rescheduled": "statusRescheduled", "Completed": "statusCompleted", "Cancelled": "statusCancelled"}
const TYPE_KEYS: Record<ConsultationType, string> = {"Video Consultation": "typeVideo", "In-Person": "typeInPerson", "Follow-Up": "typeFollowUp", "Second Opinion": "typeSecondOpinion"}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useTranslations('patientAppointments')
  const cfg: Record<AppointmentStatus, { bg: string; color: string; dot?: string }> = {
    'Unknown': { bg: 'var(--surface-subtle)', color: T.slate },
    'No show': { bg: 'var(--surface-subtle)', color: T.slate },
    'Today':          { bg: 'rgba(32,181,223,0.12)',  color: T.link,  dot: T.blue  },
    'Starting Soon':  { bg: 'rgba(217,119,6,0.12)',   color: T.amber, dot: T.amber },
    'Confirmed':      { bg: 'rgba(15,158,119,0.12)',  color: T.green, dot: T.green },
    'Waiting':        { bg: 'rgba(32,181,223,0.1)',   color: T.link               },
    'Rescheduled':    { bg: 'rgba(52,140,234,0.12)',  color: "var(--link)"            },
    'Completed':      { bg: 'rgba(15,158,119,0.1)',   color: T.green              },
    'Cancelled':      { bg: 'rgba(220,38,38,0.1)',    color: T.red                },
  }
  const s = cfg[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '999px', fontSize: "13px", fontWeight: 700, background: s.bg, color: s.color }}>
      {s.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />}
      {t(STATUS_KEYS[status])}
    </span>
  )
}

// ─── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ConsultationType }) {
  const t = useTranslations('patientAppointments')
  const isVideo = type === 'Video Consultation'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', fontSize: "13px", fontWeight: 600, ...Glass.chip, color: isVideo ? T.link : T.slate }}>
      <Ico p={isVideo ? ICONS.video : ICONS.steth} size={11} sw={1.8} />
      {t(TYPE_KEYS[type])}
    </span>
  )
}

// ─── Section card shell ────────────────────────────────────────────────────────

function SCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface-glass)",
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: "1px solid var(--border)",
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
  const t = useTranslations('patientAppointments')
  const [countdown, setCountdown] = useState(() => t('checkingTime'))

  useEffect(() => {
    const update = () => {
      const diff = new Date(appt.startAt).getTime() - Date.now()
      if (diff <= 0) { setCountdown(t('timeReached')); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.ceil((diff % 3600000) / 60000)
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [appt.startAt])

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
        <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.link }}>
          {t('todaysAppointment')}
        </span>
      </div>
      <div className='appt-today-grid'>
        <DoctorAvatar imageUrl={appt.imageUrl || undefined} name={appt.physician} size={80}/>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: '0 0 3px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.025em', color: T.navy }}>{appt.physician}</h3>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <TypeBadge type={appt.consultationType} />
            <StatusBadge status={appt.status} />
            <span style={{ fontSize: "13px", color: T.slate }}>
              <strong style={{ color: T.navy }}>{appt.time}</strong> · {appt.duration}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 2px', fontSize: "13px", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{t('startsIn')}</p>
            <p style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.link }}>{countdown}</p>
          </div>
          <HoverBtn
            onClick={onJoin}
            base={{ minHeight: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(32,181,223,0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 10px 24px rgba(52,140,234,0.35)' }}
          >
            <Ico p={ICONS.video} size={14} sw={1.8} color="#fff" />
            {t('joinConsultation')}
          </HoverBtn>
          <HoverBtn
            onClick={onDetails}
            base={{ minHeight: '40px', padding: '0 16px', borderRadius: '11px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
          >
            {t('viewDetails')}
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
  const t = useTranslations('patientAppointments')
  const showJoin = Boolean(appt.consultationId) && appt.consultationType === 'Video Consultation'

  return (
    <SCard style={{ padding: '18px' }}>
      <div className='appt-card-grid'>
        <DoctorAvatar imageUrl={appt.imageUrl || undefined} name={appt.physician} size={72}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: "13px", color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: "13px", color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              {appt.date} · {appt.time}
            </span>
            <span style={{ fontSize: "13px", color: T.slate }}>· {appt.duration}</span>
          </div>
          <div style={{ fontSize: "13px", color: T.slate2 }}>
            {t('ref')} <span style={{ fontWeight: 600, color: T.slate, fontFamily: 'monospace' }}>{appt.bookingRef}</span>
          </div>
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {showJoin && (
            <HoverBtn
              onClick={onJoin}
              base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: "13px", fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.28)' }}
              on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.34)' }}
            >
              <Ico p={ICONS.video} size={12} sw={1.8} color="#fff" />
              {t('joinConsultation')}
            </HoverBtn>
          )}
          <HoverBtn
            onClick={onDetails}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
          >
            {t('viewDetails')}
          </HoverBtn>
          <HoverBtn
            onClick={onReschedule}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.slate, fontSize: "13px", fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
          >
            {t('reschedule')}
          </HoverBtn>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: "13px", color: T.red, fontWeight: 600, padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            {t('cancelAppointment')}
          </button>
        </div>
      </div>
    </SCard>
  )
}

function PastCard({ appt, onReview }: { appt: Appointment; onReview: (appt: Appointment) => void }) {
  const t = useTranslations('patientAppointments')
  const router = useRouter()
  return (
    <SCard style={{ padding: '18px' }}>
      <div className='appt-card-grid'>
        <DoctorAvatar imageUrl={appt.imageUrl || undefined} name={appt.physician} size={72}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: "13px", color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status="Completed" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: "13px", color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              {appt.date} · {appt.time}
            </span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.5 }}>{appt.reason}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {appt.hasSummary && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', color: T.green, fontSize: "13px", fontWeight: 600 }}>
                <Ico p={ICONS.check} size={10} sw={1.8} color={T.green} />
                {t('summary')}
              </span>
            )}
            {appt.hasPrescription && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 600 }}>
                <Ico p={ICONS.pill} size={10} sw={1.8} color={T.blue} />
                {t('prescription')}
              </span>
            )}
            {appt.hasLabRequest && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(52,140,234,0.1)', color: "var(--link)", fontSize: "13px", fontWeight: 600 }}>
                <Ico p={ICONS.activity} size={10} sw={1.8} color='#348CEA' />
                {t('labRequest')}
              </span>
            )}
          </div>
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <Link
            href={`${PATIENT_ROUTES.appointmentDetails}?appointmentId=${encodeURIComponent(appt.id)}`}
            style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            {t('viewDetails')}
          </Link>
          {appt.hasPrescription && (
            <Link
              href={PATIENT_ROUTES.prescriptions}
              style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
            >
              {t('viewPrescription')}
            </Link>
          )}
          {!appt.hasReviewed && (
            <HoverBtn
              onClick={() => onReview(appt)}
              base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: "13px", fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.24)' }}
              on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.3)' }}
            >
              {t('writeReview')}
            </HoverBtn>
          )}
          <HoverBtn
            onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.slate, fontSize: "13px", fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
          >
            {t('bookFollowUp')}
          </HoverBtn>
        </div>
      </div>
    </SCard>
  )
}

// ─── Cancelled card ────────────────────────────────────────────────────────────

function CancelledCard({ appt }: { appt: Appointment }) {
  const t = useTranslations('patientAppointments')
  const router = useRouter()
  return (
    <SCard style={{ padding: '18px', opacity: 0.88 }}>
      <div className='appt-card-grid'>
        <DoctorAvatar imageUrl={appt.imageUrl || undefined} name={appt.physician} size={72}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{appt.physician}</h3>
              <p style={{ margin: '0 0 8px', fontSize: "13px", color: T.slate2 }}>{appt.specialty} · {appt.hospital}</p>
            </div>
            <StatusBadge status="Cancelled" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <TypeBadge type={appt.consultationType} />
            <span style={{ fontSize: "13px", color: T.slate, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ico p={ICONS.calendar} size={12} sw={1.8} color={T.slate2} />
              {t('originalSlot', { date: appt.date, time: appt.time })}
            </span>
          </div>
          {appt.cancellationDate && (
            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}>
              {t('cancelledOn', { date: appt.cancellationDate })}
            </p>
          )}
          {appt.cancellationReason && (
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{appt.cancellationReason}</p>
          )}
          {appt.paymentStatus === 'Refunded' && (
            <span style={{ display: 'inline-block', marginTop: '8px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', color: T.green, fontSize: "13px", fontWeight: 700 }}>
              {t('paymentRefunded')}
            </span>
          )}
        </div>
        <div className='appt-card-actions' style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <Link
            href={`${PATIENT_ROUTES.appointmentDetails}?appointmentId=${encodeURIComponent(appt.id)}`}
            style={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            {t('viewDetails')}
          </Link>
          <HoverBtn
            onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
            base={{ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: "13px", fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(32,181,223,0.24)' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.3)' }}
          >
            {t('bookAgain')}
          </HoverBtn>
        </div>
      </div>
    </SCard>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, onAction }: { tab: Tab; onAction: () => void }) {
  const t = useTranslations('patientAppointments')
  const cfg = {
    upcoming: {
      icon: ICONS.calendar,
      title: t('emptyUpcomingTitle'),
      desc: t('emptyUpcomingBody'),
      cta: t('findFreeAppointments'),
    },
    past: {
      icon: ICONS.activity,
      title: t('emptyPastTitle'),
      desc: t('emptyPastBody'),
      cta: null as string | null,
    },
    cancelled: {
      icon: ICONS.shield,
      title: t('emptyCancelledTitle'),
      desc: t('emptyCancelledBody'),
      cta: null as string | null,
    },
  }[tab]

  return (
    <div style={{ padding: '52px 24px', textAlign: 'center', borderRadius: '20px', border: "1px dashed var(--border)", background: "var(--surface-subtle)" }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Ico p={cfg.icon} size={24} sw={1.5} color={T.blue} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em' }}>{cfg.title}</h3>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: T.slate, lineHeight: 1.65, maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>{cfg.desc}</p>
      {cfg.cta && (
        <HoverBtn
          onClick={onAction}
          base={{ minHeight: '44px', padding: '0 22px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.28)' }}
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

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({ appt, onClose, onConfirm }: { appt: Appointment; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const t = useTranslations('patientAppointments')
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await onConfirm(reason.trim() || t('defaultCancelReason')) }
    catch (error) { setError(getApiErrorDetail(error) || 'Cancellation failed. Your appointment remains booked. Please retry.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }}
    aria-labelledby="cancel-appointment-title" className="qarevo-cancel-dialog">
    <style>{`.qarevo-cancel-dialog { margin: auto; width: min(460px, calc(100% - 24px)); padding: 28px; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); color: var(--ink); } .qarevo-cancel-dialog::backdrop { background: #061b2abb; backdrop-filter: blur(4px); }`}</style>
    <form onSubmit={confirm} aria-busy={busy}>
      <h2 id="cancel-appointment-title" className="text-xl font-semibold">{t('cancelAppointment2')}</h2>
      <p className="mt-3 text-muted">{appt.physician} · {appt.date} · {appt.time}</p>
      <label htmlFor="cancel-reason" className="mt-5 block font-medium">{t('reasonForCancellationOptional')}</label>
      <textarea id="cancel-reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-theme bg-surface-subtle p-3" />
      {error && <p role="alert" className="mt-3 text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-theme px-4">{t('keepAppointment')}</button>
        <button type="submit" disabled={busy} className="min-h-11 rounded-xl border border-theme px-4 font-semibold text-red-700 dark:text-red-300">{busy ? t('cancelling') : t('confirmCancel')}</button>
      </div>
    </form>
  </dialog>
}

// ─── Success toast ─────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div role="status" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 300, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '14px', background: "var(--surface-glass)", backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(15,158,119,0.22)', boxShadow: '0 8px 28px rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600 }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(15,158,119,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ico p={ICONS.check} size={13} sw={2.2} color={T.green} />
      </span>
      {message}
    </div>
  )
}

// ─── Page Inner ────────────────────────────────────────────────────────────────

function AppointmentsPageInner() {
  const t = useTranslations('patientAppointments')
  const dateLocale = useLocale() === 'de' ? 'de-DE' : 'en-GB'
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
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    async function fetchAppointments() {
      setLoading(true)
      try {
        const data = await apiGet<{ appointments?: ApiAppointment[]; time_zone?: string }>('/api/v1/patient/appointments')
        if (!active) return
        const userTimeZone = data.time_zone || 'Europe/Berlin'
        const appointments = data.appointments || []
        const transformed: Appointment[] = appointments
          .filter((apt): apt is ApiAppointment & { start_at: string } => Boolean(apt.start_at))
          .map((apt) => {
            const startsAt = new Date(apt.start_at)
            return {
            id: apt.id,
            physician: apt.provider_name || t('assignedClinician'),
            providerId: apt.provider_id,
            consultationId: apt.consultation_id,
            specialty: apt.specialty || t('careTeam'),
            hospital: 'Qarevo Health',
            imageUrl: apt.provider_image_url || undefined,
            consultationType: apt.consultation_modality === 'in_person' ? 'In-Person' : 'Video Consultation',
            date: startsAt.toLocaleDateString('en-CA', { timeZone: userTimeZone }) === new Date().toLocaleDateString('en-CA', { timeZone: userTimeZone }) ? t('today') : startsAt.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', timeZone: userTimeZone }),
            time: startsAt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone }),
            duration: apt.end_at ? t('minutes', { count: Math.round((new Date(apt.end_at).getTime() - startsAt.getTime()) / 60000) }) : t('durationUnavailable'),
            status: normalizeAppointmentStatus(apt.status),
            bookingRef: `QRV-${apt.id.slice(0, 8)}`,
            reason: t('consultation'),
            paymentStatus: normalizePaymentStatus(apt.payment_status),
            startAt: apt.start_at,
            endAt: apt.end_at || apt.start_at,
          }
        })

        const now = new Date()
        const upcomingApts = transformed.filter((apt) =>
          !['Cancelled', 'Completed', 'No show'].includes(apt.status) && new Date(apt.endAt).getTime() + 30 * 60000 > now.getTime()
        )
        const cancelledApts = transformed.filter((apt) => apt.status === 'Cancelled')
        const pastApts = transformed.filter((apt) =>
          apt.status !== 'Cancelled' && (['Completed', 'No show'].includes(apt.status) || new Date(apt.endAt).getTime() + 30 * 60000 <= now.getTime())
        )

        setUpcoming(upcomingApts)
        setCancelled(cancelledApts)
        setPast(pastApts)
      } catch (error) {
        console.error('Failed to fetch appointments:', error)
        if (active) setToast(getApiErrorDetail(error) || 'Failed to load appointments.')
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchAppointments()
    return () => { active = false }
  }, [refresh])

  const todayAppt = upcoming.find(a => a.date === 'Today')

  const handleJoin = (appointment: Appointment) => {
    if (!appointment.consultationId) { setToast('This appointment has no linked consultation. Contact support.'); return }
    router.push(`/patient/video-consultation/waiting-room?consultationId=${encodeURIComponent(appointment.consultationId)}`)
  }

  const handleDetails = (appointment: Appointment) => {
    router.push(`${PATIENT_ROUTES.appointmentDetails}?appointmentId=${encodeURIComponent(appointment.id)}`)
  }

  const handleRescheduleConfirm = () => {
    setRescheduleTarget(null)
    setRefresh(value => value + 1)
    setToast('Appointment rescheduled successfully.')
  }

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelTarget) return

    try {
      await apiPost(`/api/v1/appointments/${cancelTarget.id}/cancel`, { reason })
      const appt: Appointment = { ...cancelTarget, status: 'Cancelled', cancellationDate: 'Today', cancellationReason: reason }
      setUpcoming(prev => prev.filter(a => a.id !== cancelTarget.id))
      setCancelled(prev => [appt, ...prev])
      setCancelTarget(null)
      setToast('Appointment cancelled. No payment or refund was processed.')
      if (upcoming.filter(a => a.id !== cancelTarget.id).length === 0) {
        setActiveTab('cancelled')
      }
    } catch (error) {
      throw error
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
    { key: 'upcoming', label: t('tabUpcoming'), count: upcoming.length },
    { key: 'past', label: t('tabPast'), count: past.length },
    { key: 'cancelled', label: t('tabCancelled'), count: cancelled.length },
  ]

  const bookButton = (
    <HoverBtn
      onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
      base={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.3)', whiteSpace: 'nowrap' }}
      on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' }}
    >
      <Ico p={ICONS.calendar} size={14} sw={1.8} color="#fff" />
      {t('bookConsultation')}
    </HoverBtn>
  )

  if (loading) {
    return (
      <PatientPortalShell
        eyebrow={t('patientPlatform')}
        title={t('appointments')}
        description={t('manageYourUpcomingConsultationsView')}
        headerActions={bookButton}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
          {t('loadingYourAppointments')}
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
        eyebrow={t('patientPlatform')}
        title={t('appointments')}
        description={t('manageYourUpcomingConsultationsView')}
        headerActions={bookButton}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: "var(--surface-hover)", borderRadius: '12px', padding: '4px' }}>
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{ flex: 1, minHeight: '38px', padding: '0 12px', borderRadius: '9px', border: 'none', background: activeTab === key ? "var(--surface)" : 'transparent', color: activeTab === key ? T.navy : T.slate2, fontSize: '13px', fontWeight: activeTab === key ? 700 : 500, cursor: 'pointer', transition: 'all 0.14s', boxShadow: activeTab === key ? '0 1px 4px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {label}
              {count > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '18px', padding: '0 5px', borderRadius: '999px', background: activeTab === key ? 'rgba(32,181,223,0.12)' : "var(--surface-hover)", color: activeTab === key ? T.link : T.slate2, fontSize: "13px", fontWeight: 700 }}>
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
                  onJoin={() => handleJoin(todayAppt)}
                  onDetails={() => handleDetails(todayAppt)}
                />
              )}
              {upcoming.length > 0 && (
                <SCard>
                  <h2 className="portal-h2">{t('upcomingConsultations')}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {upcoming.map(appt => (
                      <UpcomingCard
                        key={appt.id}
                        appt={appt}
                        onJoin={() => handleJoin(appt)}
                        onDetails={() => handleDetails(appt)}
                        onReschedule={() => setRescheduleTarget(appt)}
                        onCancel={() => setCancelTarget(appt)}
                      />
                    ))}
                  </div>
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
                  <h2 style={{ margin: '0 0 14px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{t('completedAppointments')}</h2>
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
                  <h2 style={{ margin: '0 0 14px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{t('cancelledAppointments')}</h2>
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
        <AppointmentRescheduleDialog
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={handleRescheduleConfirm}
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

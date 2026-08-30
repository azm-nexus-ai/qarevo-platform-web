'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { getPatientDashboard, readAccessToken, searchPatientDashboard } from '@/lib/api'
import type { PatientDashboardSearchResult } from '@/lib/api'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import DoctorCard from '@/components/cards/DoctorCard'
import AIItem from '@/components/cards/AIItem'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import LogoutModal from '@/components/ui/LogoutModal'

type NavItem = {
  label: string
  icon: string | readonly string[]
  href: string
}

type SummaryCard = {
  label: string
  value: string
  sub: string
  icon: string | readonly string[]
  tint: string
  href: string
}

type QuickAction = {
  label: string
  sub: string
  icon: string | readonly string[]
  href: string
}

const sideNavItems: NavItem[] = [
  ...PATIENT_SIDEBAR_ITEMS,
]

const summaryCards: SummaryCard[] = [
  { label: 'Upcoming Appointment', value: '1', sub: 'Today at 4:30 PM', icon: ICONS.calendar, tint: 'rgba(32,181,223,0.14)', href: PATIENT_ROUTES.appointmentDetails },
  { label: 'Assigned Physician', value: 'Dr. Sophia Reed', sub: 'Cardiology', icon: ICONS.steth, tint: 'rgba(52,140,234,0.14)', href: '/patient/physicians/sophia-reed' },
  { label: 'Health Records', value: '18', sub: '2 new this week', icon: ICONS.shield, tint: 'rgba(165,224,218,0.24)', href: PATIENT_ROUTES.medicalRecords },
  { label: 'Active Prescriptions', value: '3', sub: '1 refill due', icon: ICONS.heart, tint: 'rgba(32,181,223,0.12)', href: PATIENT_ROUTES.prescriptions },
  { label: 'Unread Messages', value: '4', sub: '2 from clinicians', icon: ICONS.message, tint: 'rgba(52,140,234,0.14)', href: PATIENT_ROUTES.messages },
  { label: 'Recent Lab Requests', value: '2', sub: 'Available now', icon: ICONS.cpu, tint: 'rgba(165,224,218,0.24)', href: PATIENT_ROUTES.labRequests },
]

const quickActions: QuickAction[] = [
  { label: 'Book Appointment', sub: 'Schedule visit', icon: ICONS.calendar, href: PATIENT_ROUTES.findDoctor },
  { label: 'Find a Physician', sub: 'Specialist discovery', icon: ICONS.steth, href: PATIENT_ROUTES.findDoctor },
  { label: 'View Prescriptions', sub: 'Medication plan', icon: ICONS.heart, href: PATIENT_ROUTES.prescriptions },
  { label: 'View Lab Requests', sub: 'Recent tests', icon: ICONS.cpu, href: PATIENT_ROUTES.labRequests },
  { label: 'Medical Records', sub: 'View documents', icon: ICONS.shield, href: PATIENT_ROUTES.medicalRecords },
  { label: 'Messages', sub: 'Care team chat', icon: ICONS.message, href: PATIENT_ROUTES.messages },
  { label: 'Emergency Contacts', sub: 'Urgent support', icon: ICONS.user, href: PATIENT_ROUTES.support },
  { label: 'Health Tracker', sub: 'Wellness insights', icon: ICONS.activity, href: PATIENT_ROUTES.dashboard },
]

const carePlans = [
  { name: 'Cardiac Recovery Plan', progress: 74, physician: 'Dr. Sophia Reed', eta: '3 weeks left', tasks: '4 outstanding tasks' },
  { name: 'Diabetes Support Plan', progress: 61, physician: 'Dr. Amara Okafor', eta: '5 weeks left', tasks: '2 outstanding tasks' },
]

const medications = [
  { name: 'Atorvastatin', dosage: '20 mg', frequency: 'Once daily', remaining: '14 doses left', progress: 82, due: 'Tonight · 8:00 PM', status: 'On track' },
  { name: 'Omega-3 Softgels', dosage: '1000 mg', frequency: 'Twice daily', remaining: '6 doses left', progress: 68, due: 'Morning · 8:00 AM', status: 'Reminder set' },
]

const labData = [
  { title: 'Latest Results', value: 'Lipid panel', status: 'Normal range', detail: 'Uploaded 2 hrs ago' },
  { title: 'Pending Tests', value: 'CBC and Thyroid', status: 'Scheduled tomorrow', detail: 'Fast-track collection' },
  { title: 'Completed Tests', value: 'HbA1c', status: 'Improved trend', detail: 'Shared with care team' },
]

const referrals = [
  { name: 'Cardiology Review', status: 'Pending review', detail: 'Specialist booking requested' },
  { name: 'Nutrition Consult', status: 'Booked', detail: 'Next slot · Tomorrow 10:30 AM' },
  { name: 'Sleep Specialist', status: 'Completed', detail: 'Follow-up letter available' },
]

const messageThreads = [
  { sender: 'Dr. Reed', preview: 'Your blood pressure trend looks stable this week.', unread: true, time: '2m ago' },
  { sender: 'Care Team', preview: 'Your lab appointment has been confirmed.', unread: false, time: '1h ago' },
  { sender: 'Support', preview: 'Your prescription refill is ready for pickup.', unread: true, time: 'Today' },
]

const docs = [
  { name: 'Prescriptions', count: '3 active files' },
  { name: 'Consultation Notes', count: '2 recent summaries' },
  { name: 'Lab Reports', count: '4 downloadable reports' },
  { name: 'Referral Letters', count: '1 specialist letter' },
]

const wellnessCards = [
  { title: 'Water Intake', value: '2.1L', sub: 'Target 2.5L' },
  { title: 'Sleep', value: '7.3h', sub: 'Steady recovery' },
  { title: 'Exercise', value: '42 min', sub: 'Light activity' },
  { title: 'Mood', value: 'Balanced', sub: 'Steady outlook' },
]

const metrics = [
  { label: 'Weight', value: '72.4 kg', trend: '+0.2 kg', color: '#20B5DF' },
  { label: 'Blood Pressure', value: '122/78', trend: 'Stable', color: '#348CEA' },
  { label: 'Blood Sugar', value: '98 mg/dL', trend: 'In range', color: '#0F9E77' },
  { label: 'Heart Rate', value: '72 bpm', trend: 'Calm', color: '#A5E0DA' },
]

const timelineItems = [
  { title: 'Consultation Completed', sub: 'Dr. Sophia Reed · Cardiology', time: 'Today · 10:20 AM' },
  { title: 'Lab Result Received', sub: 'Lipid panel report is now available', time: 'Yesterday · 6:45 PM' },
  { title: 'Medical Record Uploaded', sub: 'Blood pressure trend added to profile', time: 'Aug 1 · 1:15 PM' },
  { title: 'Prescription Updated', sub: 'Atorvastatin dosage adjusted', time: 'Jul 31 · 9:30 AM' },
  { title: 'Recent Appointment', sub: 'Routine follow-up completed', time: 'Jul 29 · 4:00 PM' },
]

const notifications = [
  { title: 'Upcoming Appointment Reminder', body: 'You have a virtual follow-up with Dr. Reed in 2 hours.', time: 'Now' },
  { title: 'Prescription Ready', body: 'Your refill is ready for pickup.', time: '35m ago' },
  { title: 'New Message', body: 'Your care team sent pre-consultation instructions.', time: '1h ago' },
  { title: 'Doctor Follow-up', body: 'Please share your hydration logs for this week.', time: 'Yesterday' },
  { title: 'Payment Confirmation', body: 'Consultation fee payment was successful.', time: 'Yesterday' },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function SectionCard({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.84)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.84)',
        boxShadow: Sh.card,
        padding: '20px',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.028em', color: T.navy }}>{title}</h2>
          {sub && <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function SkeletonRow() {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {[1, 2, 3].map((k) => (
        <div key={k} style={{ height: '42px', borderRadius: '12px', background: 'linear-gradient(90deg, rgba(4,53,77,0.06) 0%, rgba(32,181,223,0.12) 50%, rgba(4,53,77,0.06) 100%)', backgroundSize: '220% 100%', animation: 'qarevo-shimmer 1.35s infinite linear' }} />
      ))}
    </div>
  )
}

function SummaryTile({ item }: { item: SummaryCard }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: '1px solid rgba(4,53,77,0.08)',
        borderRadius: '15px',
        padding: '15px 14px',
        background: hovered ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.76)',
        boxShadow: hovered ? '0 10px 24px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.92)' : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(4,53,77,0.06)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
      aria-label={item.label}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: item.tint, border: '1px solid rgba(4,53,77,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue }}>
          <Ico p={item.icon} size={15} sw={1.75} />
        </div>
        <Ico p={ICONS.arrowSm} size={14} sw={1.7} color={hovered ? '#348CEA' : T.slate2} />
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: T.slate2, textTransform: 'uppercase', marginBottom: '5px' }}>{item.label}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.018em', color: T.navy, marginBottom: '3px' }}>{item.value}</div>
      <div style={{ fontSize: '12.5px', color: T.slate, lineHeight: 1.45 }}>{item.sub}</div>
    </Link>
  )
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={action.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textDecoration: 'none',
        border: '1px solid rgba(4,53,77,0.09)',
        borderRadius: '14px',
        background: hovered ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.8)',
        boxShadow: hovered ? '0 12px 24px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.94)' : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 10px rgba(4,53,77,0.06)',
        padding: '14px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        transition: 'all 0.18s ease',
      }}
      aria-label={action.label}
    >
      <span style={{ width: '36px', height: '36px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hovered ? 'rgba(32,181,223,0.18)' : 'rgba(165,224,218,0.28)', border: '1px solid rgba(4,53,77,0.08)', color: hovered ? '#348CEA' : T.blue, transition: 'all 0.18s ease' }}>
        <Ico p={action.icon} size={16} sw={1.7} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>{action.label}</span>
        <span style={{ display: 'block', fontSize: '12px', color: T.slate2 }}>{action.sub}</span>
      </span>
      <Ico p={ICONS.arrowSm} size={14} sw={1.75} color={hovered ? '#348CEA' : T.slate2} />
    </Link>
  )
}

function topButtonBase(): CSSProperties {
  return {
    width: '38px',
    height: '38px',
    borderRadius: '11px',
    border: '1px solid rgba(4,53,77,0.11)',
    background: 'rgba(255,255,255,0.84)',
    color: T.slate,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}

export default function PatientDashboardPage() {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<PatientDashboardSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [loadingRightRail, setLoadingRightRail] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [carePlanStatus, setCarePlanStatus] = useState('Loading')
  const [greeting, setGreeting] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const displayPatientName = patientName || 'Patient'
  const patientInitials = getInitials(displayPatientName)

  const handleLogout = () => {
    localStorage.removeItem('qarevo_access_token')
    localStorage.removeItem('qarevo_refresh_token')
    localStorage.removeItem('qarevo_token_type')
    localStorage.removeItem('qarevo_expires_in')
    localStorage.removeItem('qarevo_user_id')
    localStorage.removeItem('qarevo_provider_id')
    localStorage.removeItem('qarevo_role')
    setShowLogoutModal(false)
    router.push('/auth/sign-in')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setGreeting(getGreeting()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const token = readAccessToken()
    if (!token) {
      router.replace('/auth/sign-in')
      return
    }

    const fetchDashboardProfile = async () => {
      try {
        const userId = localStorage.getItem('qarevo_user_id')
        const data = await getPatientDashboard(userId)
        if (data.patient_name) {
          setPatientName(data.patient_name)
        }
        const plans = data.care_plans ?? data.carePlans ?? []
        const activePlan = plans.find((plan) => (plan.status ?? '').toLowerCase() === 'active') ?? plans[0]
        setCarePlanStatus(activePlan?.status || (plans.length ? 'Active' : 'Not started'))
      } catch (error) {
        console.error('Failed to fetch dashboard profile:', error)
        setCarePlanStatus('Unavailable')
      }
    }

    fetchDashboardProfile()
  }, [router])

  useEffect(() => {
    const t = window.setTimeout(() => setLoadingRightRail(false), 850)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const query = search.trim()
    let cancelled = false

    const timer = window.setTimeout(async () => {
      if (query.length < 2) {
        setSearchResults([])
        setSearchError('')
        setSearching(false)
        return
      }

      setSearching(true)
      setSearchError('')

      try {
        const data = await searchPatientDashboard(query)
        if (!cancelled) {
          setSearchResults(data.results)
          setSearchOpen(true)
        }
      } catch (error) {
        console.error('Dashboard search failed:', error)
        if (!cancelled) {
          setSearchResults([])
          setSearchError('Search is unavailable right now.')
          setSearchOpen(true)
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  const handleSearchResult = (href: string) => {
    setSearchOpen(false)
    router.push(href)
  }

  const categoryLabel = (category: PatientDashboardSearchResult['category']) => {
    if (category === 'doctors') return 'Doctor'
    if (category === 'records') return 'Record'
    return 'Prescription'
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        .pd-shell { display: grid; grid-template-columns: 260px minmax(0, 1fr) 320px; gap: 18px; max-width: 1440px; margin: 0 auto; padding: 18px; }
        .pd-left, .pd-main, .pd-right { min-width: 0; }
        .pd-sidebar { position: sticky; top: 18px; max-height: calc(100vh - 36px); overflow: auto; }
        .pd-head-row { display: flex; gap: 12px; align-items: center; }
        .pd-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .pd-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-appointment-grid { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; gap: 16px; align-items: center; }
        .pd-record-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-notice-dot { width: 8px; height: 8px; border-radius: 50%; background: #20B5DF; box-shadow: 0 0 0 0 rgba(32,181,223,0.5); animation: qarevo-pulse 2s infinite; }

        @keyframes qarevo-pulse {
          0% { box-shadow: 0 0 0 0 rgba(32,181,223,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(32,181,223,0); }
          100% { box-shadow: 0 0 0 0 rgba(32,181,223,0); }
        }

        @keyframes qarevo-shimmer {
          0% { background-position: 220% 0; }
          100% { background-position: -220% 0; }
        }

        @media (max-width: 1200px) {
          .pd-shell { grid-template-columns: 240px minmax(0, 1fr); }
          .pd-right { display: none; }
          .pd-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pd-actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 920px) {
          .pd-shell { grid-template-columns: 1fr; padding: 0 14px 14px; padding-top: 14px; }
          .pd-left { display: none; }
          .pd-main { order: 1; }
          .pd-head-row { flex-wrap: wrap; }
          .pd-search { width: 100% !important; }
        }

        @media (max-width: 680px) {
          .pd-summary-grid { grid-template-columns: 1fr; }
          .pd-actions-grid { grid-template-columns: 1fr; }
          .pd-appointment-grid { grid-template-columns: 1fr; }
          .pd-record-grid { grid-template-columns: 1fr; }
          .pd-hero-actions { flex-direction: column; }
        }
      `}</style>

      <div aria-hidden='true' style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.1) 1px, transparent 1.2px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)' }} />

      <div className='pd-shell'>
        <aside className='pd-left'>
          <div className='pd-sidebar' style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '16px' }}>
            <div style={{ marginBottom: '18px' }}>
              <Link href='/' aria-label='Qarevo Health home' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                <AuthenticatedLogo priority />
              </Link>
            </div>

            <section aria-label='Patient summary' style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', border: '1px solid rgba(4,53,77,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.navy, fontWeight: 700 }}>{patientInitials}</div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{displayPatientName}</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2 }}>Care Plan: {carePlanStatus}</p>
                </div>
              </div>
            </section>

            <nav aria-label='Patient navigation'>
              <div className='pd-mobile-nav'>
                {sideNavItems.map((item) => {
                  const isActive = isPatientNavActive(pathname, item.href)
                  return (
                    <button
                      key={item.label}
                      type='button'
                      onClick={() => {
                        router.push(item.href)
                      }}
                      style={{
                        width: '100%',
                        minWidth: 'fit-content',
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: '11px',
                        background: isActive ? 'rgba(32,181,223,0.14)' : 'transparent',
                        color: isActive ? T.blue : T.slate,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        transition: 'all 0.15s ease',
                        fontSize: '13px',
                        fontWeight: isActive ? 700 : 500,
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Ico p={item.icon} size={15} sw={1.7} color={isActive ? T.blue : T.slate2} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </nav>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
              <Link href='/support' style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', textDecoration: 'none', color: T.slate, fontSize: '13px', fontWeight: 500 }}>
                <Ico p={ICONS.help} size={15} sw={1.7} color={T.slate2} />
                Help & Support
              </Link>
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', border: 'none', background: 'transparent', color: '#348CEA', fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                <Ico p={ICONS.arrowSm} size={15} sw={1.8} color='#348CEA' />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <section className='pd-main' aria-label='Patient dashboard home'>
          <header style={{ ...Glass.nav, position: 'relative', zIndex: 90, overflow: 'visible', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.82)', padding: '14px 14px 12px', marginBottom: '14px' }}>
            <div className='pd-head-row' style={{ justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>
                  {greeting}{patientName ? `, ${patientName}` : ''} <span aria-hidden='true'>👋</span>
                </h1>
                <p style={{ margin: '5px 0 0', fontSize: '13px', color: T.slate }}>How are you feeling today?</p>
              </div>
              <div className='pd-head-row'>
                <label className='pd-search' htmlFor='dashboard-search' style={{ width: '300px', position: 'relative', zIndex: 120, display: 'block' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: search ? '#348CEA' : T.slate2, pointerEvents: 'none' }}>
                    <Ico p={ICONS.search} size={15} sw={1.8} />
                  </span>
                  <input
                    id='dashboard-search'
                    type='search'
                    placeholder='Search doctors, records, prescriptions...'
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setSearchOpen(true)
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSearchOpen(false)
                      if (e.key === 'Enter' && searchResults[0]) handleSearchResult(searchResults[0].href)
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '11px', border: `1px solid ${search ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'}`, padding: '0 12px 0 38px', fontSize: '13px', color: T.navy, background: 'rgba(255,255,255,0.84)', boxShadow: search ? '0 0 0 3px rgba(32,181,223,0.1)' : 'none', transition: 'all 0.16s ease' }}
                    aria-label='Global search'
                    autoComplete='off'
                  />
                  {searchOpen && search.trim().length >= 2 && (
                    <div
                      role='listbox'
                      aria-label='Dashboard search results'
                      style={{
                        position: 'absolute',
                        top: '46px',
                        left: 0,
                        right: 0,
                        zIndex: 200,
                        maxHeight: '360px',
                        overflow: 'auto',
                        borderRadius: '14px',
                        border: '1px solid rgba(4,53,77,0.12)',
                        background: 'rgba(255,255,255,0.98)',
                        boxShadow: '0 18px 36px rgba(4,53,77,0.16), inset 0 1px 0 rgba(255,255,255,0.96)',
                        padding: '8px',
                      }}
                    >
                      {searching && (
                        <div style={{ padding: '12px', fontSize: '12px', color: T.slate }}>
                          Searching...
                        </div>
                      )}
                      {!searching && searchError && (
                        <div style={{ padding: '12px', fontSize: '12px', color: '#B42318' }}>
                          {searchError}
                        </div>
                      )}
                      {!searching && !searchError && searchResults.length === 0 && (
                        <div style={{ padding: '12px', fontSize: '12px', color: T.slate }}>
                          No matching doctors, records, or prescriptions.
                        </div>
                      )}
                      {!searching && !searchError && searchResults.map((result) => (
                        <button
                          key={`${result.category}-${result.id}`}
                          type='button'
                          role='option'
                          aria-selected={false}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSearchResult(result.href)}
                          style={{
                            width: '100%',
                            border: 'none',
                            borderRadius: '11px',
                            background: 'transparent',
                            padding: '10px',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            gap: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: T.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</span>
                            <span style={{ display: 'block', marginTop: '2px', fontSize: '11.5px', color: T.slate2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.subtitle}{result.description ? ` - ${result.description}` : ''}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: '#348CEA', fontSize: '10.5px', fontWeight: 800 }}>
                            {categoryLabel(result.category)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <HoverBtn
                  ariaLabel='Open help and support'
                  title='Help and support'
                  onClick={() => router.push(PATIENT_ROUTES.support)}
                  base={topButtonBase()}
                  on={{ background: 'rgba(32,181,223,0.12)', color: '#348CEA', transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(4,53,77,0.1)' }}
                >
                  <Ico p={ICONS.help} size={16} sw={1.8} />
                </HoverBtn>
                <HoverBtn
                  ariaLabel='Open messages'
                  title='Messages'
                  onClick={() => router.push(PATIENT_ROUTES.messages)}
                  base={topButtonBase()}
                  on={{ background: 'rgba(32,181,223,0.12)', color: '#348CEA', transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(4,53,77,0.1)' }}
                >
                  <Ico p={ICONS.message} size={16} sw={1.8} />
                </HoverBtn>
                <button type='button' aria-label='Open profile settings' onClick={() => router.push(PATIENT_ROUTES.settings)} style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid rgba(4,53,77,0.11)', background: 'linear-gradient(135deg, rgba(32,181,223,0.2), rgba(52,140,234,0.3))', color: T.navy, fontWeight: 700, cursor: 'pointer' }}>{patientInitials}</button>
              </div>
            </div>
          </header>

          <section style={{ ...Glass.aiCard, borderRadius: '22px', padding: '22px', marginBottom: '14px', boxShadow: Sh.float }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: '620px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#348CEA' }}>Your Care Journey</p>
                <h2 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '29px', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.035em', color: T.navy }}>
                  Welcome back, {displayPatientName}. Your health plan is on track.
                </h2>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: T.slate }}>
                  You have one appointment today and a follow-up recommendation to continue care with a specialist. Continue to physician discovery to find the best fit for your next consultation.
                </p>
              </div>

              <div style={{ minWidth: '250px', flex: 1 }}>
                <div style={{ borderRadius: '16px', padding: '14px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 24px rgba(4,53,77,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.slate2 }}>Current Health Status</p>
                    <span style={{ ...Glass.chip, padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: '#0F9E77', fontWeight: 700 }}>Stable</span>
                  </div>
                  <div style={{ height: '9px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', marginBottom: '8px', overflow: 'hidden' }}>
                    <div style={{ width: '76%', height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)', boxShadow: '0 0 12px rgba(32,181,223,0.45)' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>Care adherence and vitals tracking are above your weekly target.</p>
                </div>
              </div>
            </div>

            <div className='pd-hero-actions' style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <HoverBtn
                onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
                base={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #20B5DF 0%, #348CEA 100%)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  boxShadow: '0 5px 16px rgba(32,181,223,0.34), inset 0 1px 0 rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
                on={{
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 22px rgba(52,140,234,0.34), inset 0 1px 0 rgba(255,255,255,0.22)',
                }}
              >
                <Ico p={ICONS.steth} size={15} sw={1.8} color='#fff' />
                Find a Doctor
              </HoverBtn>

              <HoverBtn
                onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
                base={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(4,53,77,0.14)',
                  background: 'rgba(255,255,255,0.86)',
                  color: '#348CEA',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(4,53,77,0.08)',
                  cursor: 'pointer',
                }}
                on={{
                  background: 'rgba(255,255,255,0.98)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(4,53,77,0.1)',
                }}
              >
                <Ico p={ICONS.calendar} size={15} sw={1.8} color='#348CEA' />
                Book Consultation
              </HoverBtn>
            </div>
          </section>

          <SectionCard title='Health Summary' sub='A quick snapshot of your care status.'>
            <div className='pd-summary-grid'>
              {summaryCards.map((item) => <SummaryTile key={item.label} item={item} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Quick Actions' sub='Fast access to your most-used healthcare services.'>
            <div className='pd-actions-grid'>
              {quickActions.map((action) => <QuickActionTile key={action.label} action={action} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Today’s Health Snapshot' sub='A live read of your care journey, focus areas, and next steps.'>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
              {[
                { label: 'Upcoming Appointments', value: '2', sub: '1 today · 1 tomorrow' },
                { label: 'Active Prescriptions', value: '3', sub: '2 reminder enabled' },
                { label: 'Pending Lab Tests', value: '2', sub: 'Collection booked' },
                { label: 'Unread Messages', value: '3', sub: 'New from care team' },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', padding: '14px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard
            title='Upcoming Appointments'
            sub='Your next scheduled consultations and follow-up care.'
            action={<span style={{ ...Glass.chip, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: T.blue, fontWeight: 700 }}><span className='pd-notice-dot' /> Starts in 2h 14m</span>}
          >
            <div className='pd-appointment-grid' style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.09)', background: 'rgba(255,255,255,0.86)', padding: '14px' }}>
              <Image src='https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=160&h=160&fit=crop' alt='Dr. Sophia Reed' width={96} height={96} style={{ width: '96px', height: '96px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.12)', boxShadow: '0 8px 18px rgba(4,53,77,0.16)' }} />
              <div>
                <h3 style={{ margin: '0 0 5px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Dr. Sophia Reed</h3>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.slate2 }}>Cardiology · 12 years experience · Virtual consultation</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Date:</strong> Aug 03, 2026</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Time:</strong> 4:30 PM</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Type:</strong> Follow-up</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Countdown:</strong> 2h 14m</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <HoverBtn base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: 'none', background: '#20B5DF', color: '#fff', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 12px rgba(32,181,223,0.3)', cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Join Consultation</HoverBtn>
                <HoverBtn base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: '1px solid rgba(4,53,77,0.14)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}>View Details</HoverBtn>
              </div>
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Active Care Plans' sub='Ongoing treatment paths and milestones.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {carePlans.map((plan) => (
                <div key={plan.name} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{plan.name}</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{plan.physician} · {plan.eta}</p>
                    </div>
                    <div style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: T.blue }}>{plan.progress}% complete</div>
                  </div>
                  <div style={{ marginTop: '12px', height: '8px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${plan.progress}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)' }} />
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: T.slate }}>{plan.tasks}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Medications' sub='The medications supporting your active care plan.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {medications.map((item) => (
                <div key={item.name} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.name}</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{item.dosage} · {item.frequency} · {item.remaining}</p>
                    </div>
                    <div style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: T.green }}>{item.status}</div>
                  </div>
                  <div style={{ marginTop: '12px', height: '8px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #A5E0DA 100%)' }} />
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>Due {item.due}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <HoverBtn base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.92)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>View Details</HoverBtn>
                      <HoverBtn base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: 'none', background: 'linear-gradient(135deg, #20B5DF 0%, #348CEA 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Mark as Taken</HoverBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Lab Results & Diagnostics' sub='Latest lab information shared with your care team.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {labData.map((item) => (
                <div key={item.title} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{item.value} · {item.status}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>{item.detail}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <HoverBtn base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.92)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>View Reports</HoverBtn>
                    <HoverBtn base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: 'none', background: 'linear-gradient(135deg, #20B5DF 0%, #348CEA 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Download</HoverBtn>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Referrals & Specialist Care' sub='Track ongoing specialist recommendations and bookings.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {referrals.map((item) => (
                <div key={item.name} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.name}</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{item.detail}</p>
                    </div>
                    <div style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: T.blue }}>{item.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Health Metrics' sub='Historical trends and your recent wellness signals.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {metrics.map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.trend}</div>
                  </div>
                  <div style={{ marginTop: '8px', height: '7px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: '72%', height: '100%', borderRadius: 'inherit', background: `linear-gradient(90deg, ${item.color} 0%, rgba(255,255,255,0.9) 100%)` }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Messages' sub='Recent conversations from your care team and support channels.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {messageThreads.map((message) => (
                <div key={message.sender} style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: message.unread ? '#20B5DF' : 'rgba(4,53,77,0.2)' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{message.sender}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>{message.preview}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: T.slate2 }}>{message.time}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Medical Documents' sub='Quick access to the records that support your ongoing care.'>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {docs.map((doc) => (
                <div key={doc.name} style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 800, color: T.navy }}>{doc.name}</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{doc.count}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Health Timeline' sub='A visual story of your care journey from onboarding to recovery.'>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
              {timelineItems.map((item, index) => (
                <li key={item.title} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: '10px', alignItems: 'start' }}>
                  <span aria-hidden='true' style={{ width: '18px', display: 'grid', placeItems: 'center', marginTop: '1px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: index === 0 ? '#20B5DF' : 'rgba(4,53,77,0.22)', boxShadow: index === 0 ? '0 0 0 4px rgba(32,181,223,0.12)' : 'none' }} />
                  </span>
                  <div style={{ border: '1px solid rgba(4,53,77,0.08)', borderRadius: '12px', background: 'rgba(255,255,255,0.82)', padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}>{item.sub}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Personal Wellness' sub='Daily habits that shape your long-term health.'>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {wellnessCards.map((item) => (
                <div key={item.title} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='AI Health Insights' sub='Informational recommendations based on your recent activity and care history.'>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)' }}>
              <AIItem icon={ICONS.info} title='Medication Adherence' body='You are staying on track with your daily medication schedule and are 8% above your weekly goal.' action='Review plan' divider glass />
              <AIItem icon={ICONS.heart} title='Health Trends' body='Your blood pressure and recovery pattern suggest a stable recovery trend this week.' action='View insights' divider glass />
              <AIItem icon={ICONS.calendar} title='Suggested Checkups' body='A preventive follow-up with your primary care physician is recommended in the next 10 days.' action='Book checkup' glass />
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Recommended Physicians' sub='Continue your care journey by discovering the right specialist.' action={<Link href='/patient/find-doctor' style={{ fontSize: '12.5px', color: '#348CEA', fontWeight: 600, textDecoration: 'none' }}>Open discovery →</Link>}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(320px, 1fr)', gap: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
                {[
                  { name: 'Dr. Daniel Mensah', specialty: 'Internal Medicine', verification: '2026.08', tags: ['Preventive Care', 'Chronic Care'], imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=220&h=220&fit=crop', rating: '4.9', exp: '14 yrs', avail: 'Today · 6:00 PM' },
                  { name: 'Dr. Amara Okafor', specialty: 'Endocrinology', verification: '2026.07', tags: ['Diabetes', 'Hormonal Care'], imageUrl: 'https://images.unsplash.com/photo-1594824475317-4f260b6993f3?w=220&h=220&fit=crop', rating: '4.8', exp: '11 yrs', avail: 'Tomorrow · 10:00 AM' },
                  { name: 'Dr. Elena Costa', specialty: 'Family Medicine', verification: '2026.08', tags: ['Primary Care', 'Nutrition'], imageUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=220&h=220&fit=crop', rating: '4.9', exp: '9 yrs', avail: 'Today · 8:15 PM' },
                ].map((doc) => (
                  <div key={doc.name} style={{ display: 'grid', gap: '8px' }}>
                    <DoctorCard name={doc.name} specialty={doc.specialty} verification={doc.verification} tags={doc.tags} imageUrl={doc.imageUrl} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '0 6px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>⭐ {doc.rating} · {doc.exp} · {doc.avail}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href='/patient/physicians/sophia-reed?from=dashboard&intent=view' style={{ fontSize: '12px', color: T.navy, textDecoration: 'none', fontWeight: 600 }}>View Profile</Link>
                        <Link href='/patient/physicians/sophia-reed?from=dashboard&intent=book' style={{ fontSize: '12px', color: '#348CEA', textDecoration: 'none', fontWeight: 700 }}>Book</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </section>

        <aside className='pd-right'>
          <div style={{ position: 'sticky', top: '18px', display: 'grid', gap: '14px' }}>
            <SectionCard title='Today’s Schedule' sub='The key moments and commitments for the day.'>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { title: 'Medication reminder', body: 'Atorvastatin due at 8:00 PM', time: 'Today · 8:00 PM' },
                  { title: 'Consultation prep', body: 'Review notes before your virtual follow-up', time: 'Today · 3:30 PM' },
                  { title: 'Lab collection', body: 'CBC and thyroid samples confirmed', time: 'Tomorrow' },
                ].map((item) => (
                  <div key={item.title} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '10px 11px' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate, lineHeight: 1.45 }}>{item.body}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.time}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title='Notifications' sub='Recent updates from your care team.'>
              {loadingRightRail ? (
                <SkeletonRow />
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {notifications.map((item) => (
                    <button key={item.title} type='button' style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', borderRadius: '12px', padding: '10px 11px', cursor: 'pointer' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate, lineHeight: 1.45 }}>{item.body}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.time}</p>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title='Care Progress' sub='How your current plan is tracking.'>
              <div style={{ borderRadius: '14px', padding: '14px', background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(165,224,218,0.22) 100%)', border: '1px solid rgba(4,53,77,0.1)' }}>
                <div style={{ marginBottom: '8px', height: '8px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: '76%', height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>Your treatment plan is progressing steadily and you are above your weekly adherence target.</p>
              </div>
            </SectionCard>

            <SectionCard title='Quick Notes' sub='Personal reminders for your care routine.'>
              <div style={{ borderRadius: '14px', padding: '12px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 700 }}>Bring your BP log and hydration tracker to your next appointment.</p>
              </div>
            </SectionCard>

            <SectionCard title='Emergency Contact' sub='Support is always available when you need it.'>
              <div style={{ borderRadius: '14px', padding: '14px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: T.navy }}>Care Team Hotline</p>
                <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>Available 24/7 for urgent support and guidance.</p>
              </div>
            </SectionCard>

            <SectionCard title='Primary Actions' sub='Jump directly into the services you use most.'>
              <div style={{ display: 'grid', gap: '8px' }}>
                <Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '42px', borderRadius: '11px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.28)' }}>Book New Appointment</Link>
                <Link href={PATIENT_ROUTES.messages} style={{ textDecoration: 'none', minHeight: '42px', borderRadius: '11px', background: 'rgba(255,255,255,0.9)', color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(4,53,77,0.12)' }}>Contact Care Team</Link>
                <Link href={PATIENT_ROUTES.medicalRecords} style={{ textDecoration: 'none', minHeight: '42px', borderRadius: '11px', background: 'rgba(255,255,255,0.9)', color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(4,53,77,0.12)' }}>View Medical Records</Link>
              </div>
            </SectionCard>
          </div>
        </aside>
      </div>

      {showLogoutModal && (
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      )}
    </main>
  )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { clearAuthTokens, getPatientDashboard, getPatientHealthInfo, isAuthError, markPatientMedicationTaken, readAccessToken, searchPatientDashboard, searchPatientDoctors } from '@/lib/api'
import type { PatientDashboardResponse, PatientDashboardSearchResult, PatientDoctor } from '@/lib/api'
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

type CarePlanCard = {
  name: string
  progress: number
  physician: string
  eta: string
  tasks: string
}

type MedicationCard = {
  name: string
  dosage: string
  frequency: string
  remaining: string
  progress: number
  due: string
  status: string
}

type LabDatum = {
  title: string
  value: string
  status: string
  detail: string
}

type ReferralCard = {
  name: string
  status: string
  detail: string
}

type MessageThread = {
  sender: string
  preview: string
  unread: boolean
  time: string
  href: string
}

type DocumentCard = {
  name: string
  count: string
  href: string
}

type WellnessCard = {
  title: string
  value: string
  sub: string
}

type MetricCard = {
  label: string
  value: string
  trend: string
  color: string
}

type TimelineCard = {
  title: string
  sub: string
  time: string
}

type NotificationCard = {
  title: string
  body: string
  time: string
}

type AIInsightCard = {
  title: string
  body: string
  action?: string
  href?: string
  icon: string | readonly string[]
}

const sideNavItems: NavItem[] = [
  ...PATIENT_SIDEBAR_ITEMS,
]

// Hardcoded fallback arrays removed - use API data or show empty states

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










const bookingSpecialties = [
  'Cardiology',
  'Dermatology',
  'General Practice',
  'Pediatrics',
  'Psychiatry',
  'Orthopedics',
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

const iconLookup = ICONS as Record<string, string | readonly string[]>
const iconAliases: Record<string, string> = {
  ema: 'message',
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[] : []
}

function dashboardArray(payload: PatientDashboardResponse | null, snakeKey: string, camelKey?: string) {
  if (!payload) return []
  return asArray(payload[snakeKey] ?? (camelKey ? payload[camelKey] : undefined))
}

function dashboardHasKey(payload: PatientDashboardResponse | null, snakeKey: string, camelKey?: string) {
  if (!payload) return false
  return Object.prototype.hasOwnProperty.call(payload, snakeKey) || Boolean(camelKey && Object.prototype.hasOwnProperty.call(payload, camelKey))
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function resolveIcon(value: unknown, fallback: string | readonly string[]) {
  const raw = text(value)
  const key = raw ? iconAliases[raw] ?? raw : ''
  return key && iconLookup[key] ? iconLookup[key] : fallback
}

function doctorContactHref(sender: string) {
  const normalized = sender.toLowerCase()
  if (normalized.includes('reed')) return `${PATIENT_ROUTES.messages}?contactId=dr-reed`
  if (normalized.includes('care')) return `${PATIENT_ROUTES.messages}?contactId=care-team`
  if (normalized.includes('support')) return `${PATIENT_ROUTES.messages}?contactId=support-billing`
  return PATIENT_ROUTES.messages
}

function documentHref(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes('prescription')) return PATIENT_ROUTES.prescriptions
  if (normalized.includes('lab')) return PATIENT_ROUTES.labRequests
  return PATIENT_ROUTES.medicalRecords
}

function insightIcon(value: unknown) {
  const type = text(value).toLowerCase()
  if (type.includes('medication')) return ICONS.heart
  if (type.includes('appointment') || type.includes('checkup')) return ICONS.calendar
  if (type.includes('trend') || type.includes('metric')) return ICONS.activity
  return ICONS.info
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
      <header className='pd-section-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        <div className='pd-section-copy'>
          <h2 className='pd-section-title' style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.028em', color: T.navy }}>{title}</h2>
          {sub && <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>{sub}</p>}
        </div>
        {action ? <div className='pd-section-action'>{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.16)', background: 'rgba(255,255,255,0.62)', padding: '18px', color: T.slate, fontSize: '13px', lineHeight: 1.55, display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{children}</span>
      {action}
    </div>
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
  const [dashboardData, setDashboardData] = useState<PatientDashboardResponse | null>(null)
  const [recommendedDoctors, setRecommendedDoctors] = useState<PatientDoctor[] | null>(null)
  const [recentDoctors, setRecentDoctors] = useState<PatientDoctor[] | null>(null)
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [specialtyMenuOpen, setSpecialtyMenuOpen] = useState(false)
  const [healthInfo, setHealthInfo] = useState<{ blood_pressure?: string; weight?: string; height?: string; blood_type?: string }>({})
  const [greeting, setGreeting] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const specialtyMenuRef = useRef<HTMLDivElement>(null)
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

  const handleBookNextAvailable = async () => {
    try {
      const token = readAccessToken()
      if (!token) {
        router.push('/auth/sign-in')
        return
      }

      const response = await fetch('/api/v1/patient/doctors/next-available?consultation_type=video', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const doctorId = text(data?.doctor?.id)
        const recommendedSlot = text(data?.booking?.recommendedSlot ?? data?.doctor?.nextAvailable)

        if (!doctorId || !recommendedSlot || recommendedSlot.toLowerCase() === 'not available') {
          router.push(PATIENT_ROUTES.findDoctor)
          return
        }

        router.push(`/patient/physicians/${doctorId}?from=dashboard&intent=book&slot=${encodeURIComponent(recommendedSlot)}`)
      } else {
        console.error('Failed to fetch next available doctor')
        router.push(PATIENT_ROUTES.findDoctor)
      }
    } catch (error) {
      console.error('Error booking next available:', error)
      router.push(PATIENT_ROUTES.findDoctor)
    }
  }

  const handleBookBySpecialty = (specialty: string) => {
    if (!specialty) return
    setSelectedSpecialty(specialty)
    setSpecialtyMenuOpen(false)
    router.push(`${PATIENT_ROUTES.findDoctor}?specialty=${encodeURIComponent(specialty)}`)
  }

  useEffect(() => {
    if (!specialtyMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && specialtyMenuRef.current?.contains(target)) return
      setSpecialtyMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSpecialtyMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [specialtyMenuOpen])

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
        setDashboardData(data)
        if (data.patient_name) {
          setPatientName(data.patient_name)
        }
        const plans = data.care_plans ?? data.carePlans ?? []
        const activePlan = plans.find((plan) => (plan.status ?? '').toLowerCase() === 'active') ?? plans[0]
        setCarePlanStatus(activePlan?.status || (plans.length ? 'Active' : 'Not started'))
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to fetch dashboard profile:', error)
        setCarePlanStatus('Unavailable')
      }
    }

    const fetchHealthInfo = async () => {
      try {
        const data = await getPatientHealthInfo()
        setHealthInfo(data)
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to fetch health info:', error)
      }
    }

    fetchDashboardProfile()
    fetchHealthInfo()
  }, [router])

  useEffect(() => {
    let cancelled = false

    const fetchRecommendedDoctors = async () => {
      try {
        const params = new URLSearchParams({ sort: 'highest-rated' })
        const data = await searchPatientDoctors(params)
        if (!cancelled) {
          setRecommendedDoctors(data.doctors.slice(0, 3))
        }
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.push('/patient/login')
        }
      }
    }

    const fetchRecentDoctors = async () => {
      try {
        const token = readAccessToken()
        if (!token) return

        const response = await fetch('/api/v1/patient/doctors/recent', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (!cancelled) {
            setRecentDoctors(data.recent_doctors || [])
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent doctors:', error)
      }
    }

    fetchRecommendedDoctors()
    fetchRecentDoctors()
    return () => {
      cancelled = true
    }
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
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
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
  }, [router, search])

  const handleSearchResult = (href: string) => {
    setSearchOpen(false)
    router.push(href)
  }

  const handleMarkMedicationTaken = async (medicationName: string) => {
    try {
      const data = await markPatientMedicationTaken(medicationName)
      setDashboardData(data)
    } catch (error) {
      if (isAuthError(error)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      console.error('Failed to mark medication as taken:', error)
      router.push(`${PATIENT_ROUTES.prescriptions}?medication=${encodeURIComponent(medicationName)}&action=mark-taken`)
    }
  }

  const categoryLabel = (category: PatientDashboardSearchResult['category']) => {
    if (category === 'doctors') return 'Doctor'
    if (category === 'records') return 'Record'
    return 'Prescription'
  }

  const displaySummaryCards = useMemo<SummaryCard[]>(() => {
    const source = dashboardArray(dashboardData, 'summary_cards', 'summaryCards')
    if (!source.length && !dashboardHasKey(dashboardData, 'summary_cards', 'summaryCards')) return []
    return source.map((item) => {
      return {
        label: text(item.label, 'Summary item'),
        value: text(item.value, '-'),
        sub: text(item.sub ?? item.hint ?? item.status, ''),
        icon: resolveIcon(item.icon, ICONS.info),
        tint: text(item.tint, 'rgba(32,181,223,0.14)'),
        href: text(item.href, PATIENT_ROUTES.dashboard),
      }
    })
  }, [dashboardData])

  const displayQuickActions = useMemo<QuickAction[]>(() => {
    const source = dashboardArray(dashboardData, 'quick_actions', 'quickActions')
    if (!source.length && !dashboardHasKey(dashboardData, 'quick_actions', 'quickActions')) return quickActions
    return source.map((item, index) => {
      const fallback = quickActions[index % quickActions.length]
      return {
        label: text(item.label, fallback.label),
        sub: text(item.sub ?? item.hint, fallback.sub),
        icon: resolveIcon(item.icon, fallback.icon),
        href: text(item.href, fallback.href),
      }
    })
  }, [dashboardData])

  const displayCarePlans = useMemo<CarePlanCard[]>(() => {
    const source = dashboardArray(dashboardData, 'care_plans', 'carePlans')
    if (!source.length && !dashboardHasKey(dashboardData, 'care_plans', 'carePlans')) return []
    return source.map((item) => {
      const fallback = { eta: 'In progress', tasks: 'No tasks yet' }
      const planName = text(item.name ?? item.title, 'Care plan')
      const status = text(item.status)
      return {
        name: planName,
        progress: numberValue(item.progress, 0),
        physician: text(item.physician ?? item.provider ?? item.doctor, 'Care team'),
        eta: text(item.eta ?? item.duration ?? item.timeRemaining, status || fallback.eta),
        tasks: text(item.tasks ?? item.taskSummary ?? item.hint, status ? `Status: ${status}` : fallback.tasks),
      }
    })
  }, [dashboardData])

  const displayMedications = useMemo<MedicationCard[]>(() => {
    const source = dashboardArray(dashboardData, 'medications')
    if (!source.length && !dashboardHasKey(dashboardData, 'medications')) return []
    return source.map((item) => {
      const fallback = { dosage: '', frequency: '', remaining: '', due: '' }
      return {
        name: text(item.name, 'Medication'),
        dosage: text(item.dosage ?? item.dose ?? item.strength, fallback.dosage),
        frequency: text(item.frequency ?? item.schedule, fallback.frequency),
        remaining: text(item.remaining ?? item.duration, fallback.remaining),
        progress: numberValue(item.progress, 0),
        due: text(item.due ?? item.nextDue ?? item.schedule, fallback.due),
        status: text(item.status ?? item.refill, 'Active'),
      }
    })
  }, [dashboardData])

  const displayLabData = useMemo<LabDatum[]>(() => {
    const source = dashboardArray(dashboardData, 'lab_data', 'labData')
    if (!source.length && !dashboardHasKey(dashboardData, 'lab_data', 'labData')) return []
    return source.map((item) => {
      const fallback = { value: 'Lab test', detail: '' }
      return {
        title: text(item.title ?? item.name, 'Lab update'),
        value: text(item.value ?? item.name ?? item.category, fallback.value),
        status: text(item.status, 'Pending'),
        detail: text(item.detail ?? item.date ?? item.completionDate, fallback.detail),
      }
    })
  }, [dashboardData])

  const displayReferrals = useMemo<ReferralCard[]>(() => {
    const source = dashboardArray(dashboardData, 'referrals')
    if (!source.length && !dashboardHasKey(dashboardData, 'referrals')) return []
    return source.map((item) => {
      const fallback = { detail: '' }
      return {
        name: text(item.name ?? item.title, 'Referral'),
        status: text(item.status, 'Pending'),
        detail: text(item.detail ?? item.specialty ?? item.reason, fallback.detail),
      }
    })
  }, [dashboardData])

  const displayMessageThreads = useMemo<MessageThread[]>(() => {
    const source = dashboardArray(dashboardData, 'message_threads', 'messageThreads')
    if (!source.length && !dashboardHasKey(dashboardData, 'message_threads', 'messageThreads')) return []
    return source.map((item) => {
      const fallback = { preview: '', unread: false, time: '' }
      const sender = text(item.sender ?? item.name ?? item.contactName, 'Care team')
      return {
        sender,
        preview: text(item.preview ?? item.lastMessage ?? item.body, fallback.preview),
        unread: Boolean(item.unread ?? item.isUnread ?? fallback.unread),
        time: text(item.time ?? item.lastMessageTime, fallback.time),
        href: text(item.href, doctorContactHref(sender)),
      }
    })
  }, [dashboardData])

  const displayDocs = useMemo<DocumentCard[]>(() => {
    const source = dashboardArray(dashboardData, 'docs', 'documents')
    if (!source.length && !dashboardHasKey(dashboardData, 'docs', 'documents')) return []
    return source.map((item) => {
      const fallback = { count: '0 files' }
      const name = text(item.name ?? item.title, 'Document')
      return {
        name,
        count: text(item.count ?? item.meta ?? [item.type, item.size].filter(Boolean).join(' - '), fallback.count),
        href: text(item.href, documentHref(name)),
      }
    })
  }, [dashboardData])

  const displayWellnessCards = useMemo<WellnessCard[]>(() => {
    const source = dashboardArray(dashboardData, 'wellness_cards', 'wellnessCards')
    if (!source.length && !dashboardHasKey(dashboardData, 'wellness_cards', 'wellnessCards')) return []
    return source.map((item) => {
      const fallback = { value: '', sub: '' }
      return {
        title: text(item.title ?? item.label, 'Wellness'),
        value: text(item.value, fallback.value),
        sub: text(item.sub ?? item.hint, fallback.sub),
      }
    })
  }, [dashboardData])

  const displayMetrics = useMemo<MetricCard[]>(() => {
    // Use health info from profile instead of dashboard historical data
    if (healthInfo.blood_pressure) {
      const bp = healthInfo.blood_pressure
      // Calculate trend based on blood pressure (simplified logic)
      const systolic = parseInt(bp.split('/')[0]) || 120
      const trend = systolic < 120 ? 'Normal' : systolic < 140 ? 'Elevated' : 'High'
      const color = systolic < 120 ? '#10B981' : systolic < 140 ? '#F59E0B' : '#EF4444'

      return [
        {
          label: 'Blood Pressure',
          value: `${bp} mmHg`,
          trend: trend,
          color: color,
        }
      ]
    }

    // Fallback to dashboard data if no health info
    const source = dashboardArray(dashboardData, 'metrics')
    if (!source.length && !dashboardHasKey(dashboardData, 'metrics')) return []
    return source.map((item) => {
      const fallback = { value: '', trend: '', color: '#20B5DF' }
      return {
        label: text(item.label, 'Metric'),
        value: text(item.value, fallback.value),
        trend: text(item.trend, fallback.trend),
        color: text(item.color, fallback.color),
      }
    })
  }, [dashboardData, healthInfo])

  const displayTimelineItems = useMemo<TimelineCard[]>(() => {
    const source = dashboardArray(dashboardData, 'timeline_items', 'timelineItems')
    if (!source.length && !dashboardHasKey(dashboardData, 'timeline_items', 'timelineItems')) return []
    return source.map((item) => {
      const fallback = { sub: '', time: '' }
      return {
        title: text(item.title ?? item.event, 'Care update'),
        sub: text(item.sub ?? item.body ?? item.provider, fallback.sub),
        time: text(item.time ?? item.date, fallback.time),
      }
    })
  }, [dashboardData])

  const displayNotifications = useMemo<NotificationCard[]>(() => {
    const source = dashboardArray(dashboardData, 'notifications')
    if (!source.length && !dashboardHasKey(dashboardData, 'notifications')) return []
    return source.map((item) => {
      const fallback = { body: '', time: '' }
      return {
        title: text(item.title, 'Notification'),
        body: text(item.body ?? item.preview, fallback.body),
        time: text(item.time, fallback.time),
      }
    })
  }, [dashboardData])

  const displayAIInsights = useMemo<AIInsightCard[]>(() => {
    const source = dashboardArray(dashboardData, 'ai_insights', 'aiInsights')
    if (!source.length && !dashboardHasKey(dashboardData, 'ai_insights', 'aiInsights')) {
      return [
        { icon: ICONS.info, title: 'Medication Adherence', body: 'Review your medication plan and reminders.', action: 'Review plan', href: PATIENT_ROUTES.prescriptions },
        { icon: ICONS.heart, title: 'Health Trends', body: 'View follow-up insights from your recent care activity.', action: 'View insights', href: '/patient/follow-up' },
        { icon: ICONS.calendar, title: 'Suggested Checkups', body: 'Find an available physician when you are ready for a checkup.', action: 'Book checkup', href: PATIENT_ROUTES.findDoctor },
      ]
    }
    return source.map((item) => ({
      title: text(item.title, 'Insight'),
      body: text(item.body ?? item.description, ''),
      action: text(item.action ?? item.action_label ?? item.actionLabel, ''),
      href: text(item.href, '') || undefined,
      icon: resolveIcon(item.icon, insightIcon(item.type ?? item.insight_type ?? item.insightType)),
    }))
  }, [dashboardData])

  const snapshotCards = useMemo(() => {
    const source = dashboardArray(dashboardData, 'today_snapshot', 'todaySnapshot')
    if (source.length) {
      return source.map((item) => ({
        label: text(item.label),
        value: text(item.value),
        sub: text(item.sub ?? item.hint),
      })).filter((item) => item.label)
    }
    const findCard = (needle: string) => displaySummaryCards.find((item) => item.label.toLowerCase().includes(needle))
    const appointment = findCard('appointment')
    const prescriptions = findCard('prescription')
    const labs = displayLabData.filter((item) => !item.status.toLowerCase().includes('available'))
    const messages = findCard('message')
    return [
      { label: 'Upcoming Appointments', value: appointment?.value ?? '0', sub: appointment?.sub ?? 'No upcoming appointments' },
      { label: 'Active Prescriptions', value: prescriptions?.value ?? String(displayMedications.length), sub: prescriptions?.sub ?? 'Medication plan available' },
      { label: 'Pending Lab Tests', value: String(labs.length || displayLabData.length), sub: labs[0]?.status ?? 'No pending tests' },
      { label: 'Unread Messages', value: messages?.value ?? String(displayMessageThreads.filter((item) => item.unread).length), sub: messages?.sub ?? 'Care team updates' },
    ]
  }, [dashboardData, displayLabData, displayMedications.length, displayMessageThreads, displaySummaryCards])

  const currentAppointment = displaySummaryCards.find((item) => item.label.toLowerCase().includes('appointment'))
  const primaryPhysician = displaySummaryCards.find((item) => item.label.toLowerCase().includes('physician'))
  const hasUpcomingAppointment = currentAppointment ? Number.parseInt(currentAppointment.value, 10) > 0 : false
  const hasCareActivity = hasUpcomingAppointment || displayCarePlans.length > 0 || displayMedications.length > 0 || displayLabData.length > 0 || displayMessageThreads.length > 0
  const heroBody = hasCareActivity
    ? 'Your dashboard is pulling from your care activity, clinical records, messages, and booking history.'
    : 'Your dashboard will populate as you book appointments, message your care team, receive prescriptions, and complete clinical intake.'
  const careProgress = displayCarePlans.length
    ? Math.round(displayCarePlans.reduce((total, plan) => total + plan.progress, 0) / displayCarePlans.length)
    : 0
  const todayScheduleItems = [
    ...(hasUpcomingAppointment && currentAppointment && primaryPhysician ? [{ title: 'Upcoming appointment', body: `${primaryPhysician.value} · ${primaryPhysician.sub}`, time: currentAppointment.sub }] : []),
    ...displayMedications.slice(0, 1).map((item) => ({ title: 'Medication reminder', body: `${item.name} · ${item.dosage}`, time: `Due ${item.due}` })),
    ...displayLabData.slice(0, 1).map((item) => ({ title: 'Lab update', body: `${item.value} · ${item.status}`, time: item.detail })),
  ].slice(0, 3)

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        .pd-shell { display: grid; grid-template-columns: 260px minmax(0, 1fr) 320px; gap: 18px; max-width: 1440px; margin: 0 auto; padding: 18px; }
        .pd-left, .pd-main, .pd-right { min-width: 0; }
        .pd-sidebar { position: sticky; top: 18px; max-height: calc(100vh - 36px); overflow: auto; }
        .pd-head-row { display: flex; gap: 12px; align-items: center; }
        .pd-dashboard-header-row { display: grid; grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.15fr); gap: 16px; align-items: center; }
        .pd-greeting-block { min-width: 0; }
        .pd-greeting-title { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; line-height: 1.14; font-weight: 800; color: ${T.navy}; }
        .pd-greeting-kicker, .pd-greeting-name { display: block; }
        .pd-greeting-name { overflow-wrap: anywhere; }
        .pd-section-header, .pd-section-copy { min-width: 0; }
        .pd-section-title { font-size: 18px !important; line-height: 1.2 !important; letter-spacing: 0 !important; }
        .pd-section-action { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: flex-end; }
        .pd-section-action a { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border-radius: 11px; padding: 0 10px; background: rgba(255,255,255,0.8); border: 1px solid rgba(4,53,77,0.09); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9); line-height: 1.2; white-space: nowrap; }
        .pd-toolbar { display: grid; grid-template-columns: minmax(170px, 1fr) 38px 38px 42px; justify-content: flex-end; min-width: 0; width: 100%; max-width: 560px; margin-left: auto; }
        .pd-profile-avatar { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; aspect-ratio: 1 / 1; border-radius: 50% !important; display: inline-grid !important; place-items: center !important; line-height: 1 !important; padding: 0 !important; overflow: hidden; flex: 0 0 auto; }
        .pd-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .pd-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-hero-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: center; width: 100%; min-width: 0; }
        .pd-hero-actions > * { min-width: 0; }
        .pd-primary-cta, .pd-secondary-cta, .pd-specialty-trigger { width: 100%; justify-content: center !important; min-width: 0; }
        .pd-specialty-wrap { min-width: 0; width: 100%; }
        .pd-specialty-trigger span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pd-specialty-menu { position: absolute; left: 0; top: calc(100% + 8px); z-index: 320; width: 230px; border-radius: 14px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.98); box-shadow: 0 18px 34px rgba(4,53,77,0.14), inset 0 1px 0 rgba(255,255,255,0.96); padding: 7px; }
        .pd-specialty-option { width: 100%; min-height: 36px; border: none; border-radius: 10px; background: transparent; color: ${T.navy}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 10px; font-size: 12.5px; font-weight: 700; text-align: left; transition: all 0.15s ease; }
        .pd-specialty-option:hover, .pd-specialty-option:focus-visible { background: rgba(32,181,223,0.12); color: #348CEA; outline: none; }
        .pd-appointment-grid { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; gap: 16px; align-items: center; }
        .pd-record-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-snapshot-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .pd-snapshot-card { min-width: 0; border-radius: 16px; padding: 14px; background: rgba(255,255,255,0.84); border: 1px solid rgba(4,53,77,0.08); }
        .pd-snapshot-label, .pd-snapshot-sub { overflow-wrap: anywhere; hyphens: auto; }
        .pd-doctor-carousel { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(min(320px, 100%), 1fr); gap: 12px; overflow-x: auto; padding-bottom: 2px; }
        .pd-doctor-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 6px; min-width: 0; }
        .pd-doctor-meta { margin: 0; min-width: 0; font-size: 12px; color: ${T.slate2}; overflow-wrap: anywhere; line-height: 1.45; }
        .pd-doctor-actions { display: flex; gap: 8px; flex: 0 0 auto; }
        .pd-doctor-action-link { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; border-radius: 10px; padding: 0 10px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.82); box-shadow: inset 0 1px 0 rgba(255,255,255,0.92); text-decoration: none; font-size: 12px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
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
          .pd-dashboard-header-row { grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.1fr); }
          .pd-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pd-actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 920px) {
          .pd-shell { grid-template-columns: 1fr; padding: 0 14px 14px; padding-top: 14px; }
          .pd-left { display: none; }
          .pd-main { order: 1; }
          .pd-head-row { flex-wrap: wrap; }
          .pd-dashboard-header-row { grid-template-columns: 1fr; align-items: stretch; }
          .pd-toolbar { grid-template-columns: minmax(0, 1fr); justify-content: stretch; max-width: none; margin-left: 0; }
          .pd-toolbar > button { display: none !important; }
          .pd-search { width: 100% !important; }
          .pd-snapshot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 680px) {
          .pd-greeting-title { font-size: 22px; }
          .pd-toolbar { grid-template-columns: minmax(0, 1fr); gap: 8px; }
          .pd-summary-grid { grid-template-columns: 1fr; }
          .pd-actions-grid { grid-template-columns: 1fr; }
          .pd-appointment-grid { grid-template-columns: 1fr; }
          .pd-record-grid { grid-template-columns: 1fr; }
          .pd-hero-actions { grid-template-columns: 1fr; }
          .pd-primary-cta { grid-column: 1 / -1; width: 100%; justify-content: center !important; }
          .pd-secondary-cta, .pd-specialty-trigger { width: 100%; justify-content: center !important; min-height: 44px !important; white-space: nowrap; }
          .pd-specialty-menu { width: min(230px, calc(100vw - 56px)); }
          .pd-snapshot-grid { grid-template-columns: 1fr; }
          .pd-doctor-carousel { grid-auto-flow: row; grid-template-columns: 1fr; overflow-x: visible; }
          .pd-section-header { display: grid !important; grid-template-columns: 1fr; gap: 10px !important; }
          .pd-section-title { font-size: 19px !important; }
          .pd-section-action { justify-content: stretch; width: 100%; }
          .pd-section-action a { width: 100%; min-height: 38px; }
          .pd-doctor-footer { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 0; }
          .pd-doctor-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
          .pd-doctor-actions:has(.pd-doctor-action-link:only-child) { grid-template-columns: 1fr; }
          .pd-doctor-action-link { min-height: 38px; width: 100%; }
        }
        @media (max-width: 430px) {
          .pd-toolbar { grid-template-columns: minmax(0, 1fr); }
          .pd-shell { padding-left: 12px; padding-right: 12px; }
          .pd-main section { padding: 18px !important; }
          .pd-greeting-title { font-size: 21px; line-height: 1.16; }
          .pd-section-title { font-size: 18px !important; }
          .pd-section-action a { justify-content: space-between; padding: 0 12px; }
          .pd-doctor-actions { grid-template-columns: 1fr; }
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
            <div className='pd-dashboard-header-row'>
              <div className='pd-greeting-block'>
                <h1 className='pd-greeting-title'>
                  <span className='pd-greeting-kicker'>{greeting}</span>
                  <span className='pd-greeting-name'>{patientName || 'Patient'} <span aria-hidden='true'>👋</span></span>
                </h1>
                <p style={{ margin: '5px 0 0', fontSize: '13px', color: T.slate }}>How are you feeling today?</p>
              </div>
              <div className='pd-head-row pd-toolbar'>
                <label className='pd-search' htmlFor='dashboard-search' style={{ width: '100%', position: 'relative', zIndex: 120, display: 'block', minWidth: 0 }}>
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
                <button type='button' className='pd-profile-avatar' aria-label='Open profile settings' onClick={() => router.push(PATIENT_ROUTES.settings)} style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1px solid rgba(4,53,77,0.11)', background: 'linear-gradient(135deg, rgba(32,181,223,0.2), rgba(52,140,234,0.3))', color: T.navy, fontWeight: 700, cursor: 'pointer' }}>{patientInitials}</button>
              </div>
            </div>
          </header>

          <section style={{ ...Glass.aiCard, position: 'relative', zIndex: specialtyMenuOpen ? 260 : 1, overflow: 'visible', borderRadius: '22px', padding: '22px', marginBottom: '14px', boxShadow: Sh.float }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: '620px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#348CEA' }}>Your Care Journey</p>
                <h2 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '29px', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.035em', color: T.navy }}>
                  Welcome back, {displayPatientName}. {hasCareActivity ? 'Your health plan is on track.' : 'Let’s start your care journey.'}
                </h2>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: T.slate }}>
                  {heroBody}
                </p>
              </div>

              <div style={{ minWidth: '250px', flex: 1 }}>
                <div style={{ borderRadius: '16px', padding: '14px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 24px rgba(4,53,77,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.slate2 }}>Current Health Status</p>
                    <span style={{ ...Glass.chip, padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: hasCareActivity ? '#0F9E77' : T.slate, fontWeight: 700 }}>{hasCareActivity ? 'Active' : 'New'}</span>
                  </div>
                  <div style={{ height: '9px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', marginBottom: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${hasCareActivity ? Math.max(careProgress, 24) : 8}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)', boxShadow: '0 0 12px rgba(32,181,223,0.45)' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{hasCareActivity ? 'Care activity is being tracked from your appointments and records.' : 'No care activity has been recorded yet.'}</p>
                </div>
              </div>
            </div>

            <div className='pd-hero-actions' style={{ marginTop: '16px' }}>
              <HoverBtn
                className='pd-primary-cta'
                onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
                base={{
                  minHeight: '38px',
                  padding: '0 14px',
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
                className='pd-secondary-cta'
                onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
                base={{
                  minHeight: '38px',
                  padding: '0 14px',
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

              <HoverBtn
                className='pd-secondary-cta'
                onClick={handleBookNextAvailable}
                base={{
                  minHeight: '38px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(32,181,223,0.34)',
                  background: 'linear-gradient(135deg, rgba(32,181,223,0.12) 0%, rgba(52,140,234,0.12) 100%)',
                  color: '#348CEA',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(52,140,234,0.15)',
                  cursor: 'pointer',
                }}
                on={{
                  background: 'linear-gradient(135deg, rgba(32,181,223,0.18) 0%, rgba(52,140,234,0.18) 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(52,140,234,0.25)',
                }}
              >
                <Ico p={ICONS.lightning} size={15} sw={1.8} color='#348CEA' />
                Book Next Available
              </HoverBtn>

              <div ref={specialtyMenuRef} className='pd-specialty-wrap' style={{ position: 'relative' }}>
                <HoverBtn
                  className='pd-specialty-trigger'
                  ariaLabel='Book by specialty'
                  title='Book by specialty'
                  onClick={() => setSpecialtyMenuOpen((open) => !open)}
                  base={{
                    minHeight: '38px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(4,53,77,0.14)',
                    background: 'rgba(255,255,255,0.86)',
                    color: T.navy,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(4,53,77,0.08)',
                    cursor: 'pointer',
                  }}
                  on={{
                    background: 'rgba(255,255,255,0.98)',
                    color: '#348CEA',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 20px rgba(4,53,77,0.1)',
                  }}
                >
                  <span>{selectedSpecialty || 'Book by Specialty'}</span>
                  <Ico p={ICONS.chevronDown} size={12} sw={1.8} color='currentColor' />
                </HoverBtn>
                {specialtyMenuOpen && (
                  <div className='pd-specialty-menu' role='menu' aria-label='Book by specialty options'>
                    {bookingSpecialties.map((specialty) => (
                      <button
                        key={specialty}
                        type='button'
                        role='menuitem'
                        className='pd-specialty-option'
                        onClick={() => handleBookBySpecialty(specialty)}
                      >
                        <span>{specialty}</span>
                        {selectedSpecialty === specialty && <Ico p={ICONS.check} size={13} sw={1.9} color='currentColor' />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <SectionCard title='Health Summary' sub='A quick snapshot of your care status.'>
            <div className='pd-summary-grid'>
              {displaySummaryCards.map((item) => <SummaryTile key={item.label} item={item} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Quick Actions' sub='Fast access to your most-used healthcare services.'>
            <div className='pd-actions-grid'>
              {displayQuickActions.map((action) => <QuickActionTile key={action.label} action={action} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Today’s Health Snapshot' sub='A live read of your care journey, focus areas, and next steps.'>
            <div className='pd-snapshot-grid'>
              {snapshotCards.map((item) => (
                <div key={item.label} className='pd-snapshot-card'>
                  <p className='pd-snapshot-label' style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                  <p className='pd-snapshot-sub' style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard
            title='Upcoming Appointments'
            sub='Your next scheduled consultations and follow-up care.'
            action={hasUpcomingAppointment ? <span style={{ ...Glass.chip, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: T.blue, fontWeight: 700 }}><span className='pd-notice-dot' /> Scheduled</span> : undefined}
          >
            {hasUpcomingAppointment && primaryPhysician && currentAppointment ? (
              <div className='pd-appointment-grid' style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.09)', background: 'rgba(255,255,255,0.86)', padding: '14px' }}>
                <Image src='https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=160&h=160&fit=crop' alt={primaryPhysician.value || 'Physician'} width={96} height={96} style={{ width: '96px', height: '96px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(4,53,77,0.12)', boxShadow: '0 8px 18px rgba(4,53,77,0.16)' }} />
                <div>
                  <h3 style={{ margin: '0 0 5px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{primaryPhysician.value || 'Physician'}</h3>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.slate2 }}>{primaryPhysician.sub || 'Specialty'} · Virtual consultation</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Date:</strong> {currentAppointment.sub?.split(' at ')[0] || 'Scheduled'}</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Time:</strong> {currentAppointment.sub?.split(' at ')[1] || currentAppointment.sub || 'TBD'}</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Type:</strong> Consultation</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Status:</strong> Booked</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <HoverBtn onClick={() => router.push('/patient/video-consultation/waiting-room')} base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: 'none', background: '#20B5DF', color: '#fff', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 12px rgba(32,181,223,0.3)', cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Join Consultation</HoverBtn>
                  <HoverBtn onClick={() => router.push(PATIENT_ROUTES.appointmentDetails)} base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: '1px solid rgba(4,53,77,0.14)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}>View Details</HoverBtn>
                </div>
              </div>
            ) : (
              <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>Find a Doctor</Link>}>
                No appointments are scheduled yet.
              </EmptyState>
            )}
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Active Care Plans' sub='Ongoing treatment paths and milestones.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayCarePlans.length === 0 && (
                <EmptyState>No active care plans yet. They will appear here after a consultation or clinical workflow assignment.</EmptyState>
              )}
              {displayCarePlans.map((plan) => (
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
              {displayMedications.length === 0 && (
                <EmptyState>No medications are active yet.</EmptyState>
              )}
              {displayMedications.map((item) => (
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
                      <HoverBtn onClick={() => router.push(`${PATIENT_ROUTES.prescriptions}?medication=${encodeURIComponent(item.name)}`)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.92)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>View Details</HoverBtn>
                      <HoverBtn onClick={() => handleMarkMedicationTaken(item.name)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: 'none', background: 'linear-gradient(135deg, #20B5DF 0%, #348CEA 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Mark as Taken</HoverBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Lab Results & Diagnostics' sub='Latest lab information shared with your care team.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayLabData.length === 0 && (
                <EmptyState>No lab requests or results are available yet.</EmptyState>
              )}
              {displayLabData.map((item) => (
                <div key={item.title} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{item.value} · {item.status}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>{item.detail}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <HoverBtn onClick={() => router.push(PATIENT_ROUTES.labRequests)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.92)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>View Reports</HoverBtn>
                    <HoverBtn onClick={() => router.push(PATIENT_ROUTES.medicalRecords)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: 'none', background: 'linear-gradient(135deg, #20B5DF 0%, #348CEA 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Download</HoverBtn>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Referrals & Specialist Care' sub='Track ongoing specialist recommendations and bookings.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayReferrals.length === 0 && (
                <EmptyState>No referrals have been created yet.</EmptyState>
              )}
              {displayReferrals.map((item) => (
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
              {displayMetrics.length === 0 && (
                <EmptyState>No health metrics have been added yet.</EmptyState>
              )}
              {displayMetrics.map((item) => {
                const bp = healthInfo.blood_pressure
                const systolic = bp ? parseInt(bp.split('/')[0]) || 120 : 120
                const progress = Math.min((systolic / 180) * 100, 100)

                return (
                  <div key={item.label} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.trend}</div>
                    </div>
                    <div style={{ marginTop: '8px', height: '7px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', borderRadius: 'inherit', background: `linear-gradient(90deg, ${item.color} 0%, rgba(255,255,255,0.9) 100%)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Messages' sub='Recent conversations from your care team and support channels.'>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayMessageThreads.length === 0 && (
                <EmptyState action={<Link href={PATIENT_ROUTES.messages} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>Open Messages</Link>}>
                  No conversations yet.
                </EmptyState>
              )}
              {displayMessageThreads.map((message) => (
                <Link key={message.sender} href={message.href} style={{ textDecoration: 'none', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: message.unread ? '#20B5DF' : 'rgba(4,53,77,0.2)' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{message.sender}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>{message.preview}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: T.slate2 }}>{message.time}</div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Medical Documents' sub='Quick access to the records that support your ongoing care.'>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {displayDocs.length === 0 && (
                <EmptyState>No medical documents are available yet.</EmptyState>
              )}
              {displayDocs.map((doc) => (
                <Link key={doc.name} href={doc.href} style={{ textDecoration: 'none', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '12px' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 800, color: T.navy }}>{doc.name}</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{doc.count}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Health Timeline' sub='A visual story of your care journey from onboarding to recovery.'>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
              {displayTimelineItems.length === 0 && (
                <EmptyState>Your care timeline will start after your first appointment, document, or clinical update.</EmptyState>
              )}
              {displayTimelineItems.map((item, index) => (
                <li key={`${item.title}-${item.sub}-${item.time}-${index}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: '10px', alignItems: 'start' }}>
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

          <SectionCard title='Health Information' sub='Your vital signs and medical details from your profile.' action={<Link href='/patient/settings' style={{ fontSize: '12.5px', color: '#348CEA', fontWeight: 600, textDecoration: 'none' }}>Update in Settings →</Link>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: 'Blood Pressure', value: healthInfo.blood_pressure || 'Not set' },
                { label: 'Weight', value: healthInfo.weight ? `${healthInfo.weight} kg` : 'Not set' },
                { label: 'Height', value: healthInfo.height ? `${healthInfo.height} cm` : 'Not set' },
                { label: 'Blood Type', value: healthInfo.blood_type || 'Not set' },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '14px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Personal Wellness' sub='Daily habits that shape your long-term health.'>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {displayWellnessCards.length === 0 && (
                <EmptyState>No wellness check-ins have been recorded yet.</EmptyState>
              )}
              {displayWellnessCards.map((item) => (
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
              {displayAIInsights.length === 0 && (
                <EmptyState>No AI insights yet. They will appear after clinical intake or care activity is processed.</EmptyState>
              )}
              {displayAIInsights.map((item, index) => (
                <AIItem
                  key={`${item.title}-${index}`}
                  icon={item.icon}
                  title={item.title}
                  body={item.body}
                  action={item.action}
                  href={item.href}
                  divider={index < displayAIInsights.length - 1}
                  glass
                />
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Quick Re-Booking' sub='Book with doctors you have seen before for faster care.' action={<Link href='/patient/find-doctor' style={{ fontSize: '12.5px', color: '#348CEA', fontWeight: 700, textDecoration: 'none' }}>Find new doctor →</Link>}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className='pd-doctor-carousel'>
                {(recentDoctors ?? []).length === 0 && (
                  <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>Find a Doctor</Link>}>
                    No recent bookings yet. Book your first consultation to see quick re-booking options here.
                  </EmptyState>
                )}
                {(recentDoctors ?? []).map((doc) => (
                  <div key={doc.id} style={{ display: 'grid', gap: '8px' }}>
                    <DoctorCard name={doc.name} specialty={doc.specialty} verification={doc.verification} tags={doc.tags} imageUrl={doc.imageUrl} />
                    <div className='pd-doctor-footer'>
                      <p className='pd-doctor-meta'>⭐ {doc.reviews > 0 ? doc.rating.toFixed(1) : 'No ratings'} · {doc.experienceYears} yrs · {doc.nextAvailable}</p>
                      <div className='pd-doctor-actions'>
                        <Link className='pd-doctor-action-link' href={`/patient/physicians/${doc.id}?from=dashboard&intent=book`} style={{ color: '#348CEA' }}>Book Now</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title='Recommended Physicians' sub='Continue your care journey by discovering the right specialist.' action={<Link href='/patient/find-doctor' style={{ fontSize: '12.5px', color: '#348CEA', fontWeight: 700, textDecoration: 'none' }}>Open discovery →</Link>}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className='pd-doctor-carousel'>
                {(recommendedDoctors ?? []).length === 0 && (
                  <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>Open Discovery</Link>}>
                    No verified physicians are available from the API yet.
                  </EmptyState>
                )}
                {(recommendedDoctors ?? []).map((doc) => (
                  <div key={doc.name} style={{ display: 'grid', gap: '8px' }}>
                    <DoctorCard name={doc.name} specialty={doc.specialty} verification={doc.verification} tags={doc.tags} imageUrl={doc.imageUrl} />
                    <div className='pd-doctor-footer'>
                      <p className='pd-doctor-meta'>⭐ {doc.reviews > 0 ? doc.rating.toFixed(1) : 'No ratings'} · {doc.experienceYears} yrs · {doc.nextAvailable}</p>
                      <div className='pd-doctor-actions'>
                        <Link className='pd-doctor-action-link' href={`/patient/physicians/${doc.id}?from=dashboard&intent=view`} style={{ color: T.navy }}>View Profile</Link>
                        <Link className='pd-doctor-action-link' href={`/patient/physicians/${doc.id}?from=dashboard&intent=book`} style={{ color: '#348CEA' }}>Book</Link>
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
              {todayScheduleItems.length ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {todayScheduleItems.map((item) => (
                    <div key={`${item.title}-${item.time}`} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', padding: '10px 11px' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate, lineHeight: 1.45 }}>{item.body}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>No schedule items yet.</EmptyState>
              )}
            </SectionCard>

            <SectionCard title='Notifications' sub='Recent updates from your care team.'>
              {loadingRightRail ? (
                <SkeletonRow />
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {displayNotifications.map((item, index) => (
                    <button key={`${item.title}-${item.body}-${item.time}-${index}`} type='button' style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.82)', borderRadius: '12px', padding: '10px 11px', cursor: 'pointer' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate, lineHeight: 1.45 }}>{item.body}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.time}</p>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title='Care Progress' sub='How your current plan is tracking.'>
              {displayCarePlans.length ? (
                <div style={{ borderRadius: '14px', padding: '14px', background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(165,224,218,0.22) 100%)', border: '1px solid rgba(4,53,77,0.1)' }}>
                  <div style={{ marginBottom: '8px', height: '8px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${careProgress}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>Your active care plans are {careProgress}% complete on average.</p>
                </div>
              ) : (
                <EmptyState>No care plan progress yet.</EmptyState>
              )}
            </SectionCard>

            <SectionCard title='Quick Notes' sub='Personal reminders for your care routine.'>
              <div style={{ borderRadius: '14px', padding: '12px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 700 }}>{displayNotifications[0]?.body || 'No quick notes yet.'}</p>
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
                <Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.28)' }}>Book New Appointment</Link>
                <Link href={PATIENT_ROUTES.messages} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: 'rgba(255,255,255,0.9)', color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(4,53,77,0.12)' }}>Contact Care Team</Link>
                <Link href={PATIENT_ROUTES.medicalRecords} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: 'rgba(255,255,255,0.9)', color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(4,53,77,0.12)' }}>View Medical Records</Link>
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

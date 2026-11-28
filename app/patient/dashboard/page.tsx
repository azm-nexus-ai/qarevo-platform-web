'use client'
import { useLocale, useTranslations } from 'next-intl'
import { nextSlotText } from '@/lib/doctor-slot'
import { readPortalIdentity } from '@/lib/portal-scope'
import ProfileImage from '@/components/patient/ProfileImage'
import PatientNotifications from '@/components/notifications/PatientNotifications'
import PatientMedicationCards from '@/components/clinical/PatientMedicationCards'
import { careInstruction, instructionList } from '@/lib/clinical-instructions'

import Link from 'next/link'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { apiGet, logoutCurrentUser, clearPortalSession, getPatientDashboard, getPatientHealthInfo, isAuthError, readSessionMarker, searchPatientDashboard, searchPatientDoctors } from '@/lib/api'
import type { PatientDashboardResponse, PatientDashboardSearchResult, PatientDoctor } from '@/lib/api'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import DoctorCard from '@/components/cards/DoctorCard'
import AIItem from '@/components/cards/AIItem'
import LogoutModal from '@/components/ui/LogoutModal'
import { physicianPath } from '@/lib/physician-slug'
import { NavLabel } from '@/components/ui/NavLabel'

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
  progress: number | null
  physician: string
  eta: string
  tasks: string
  reviewNeeded: boolean
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

// Fallback when the dashboard has no stored actions; labels come from ACTION_KEYS.
const quickActions: QuickAction[] = [
  { label: 'Find free appointments', sub: '', icon: ICONS.calendar, href: PATIENT_ROUTES.findDoctor },
  { label: 'Appointments', sub: '', icon: ICONS.calendar, href: PATIENT_ROUTES.appointments },
  { label: 'Medication and care plan', sub: '', icon: ICONS.heart, href: PATIENT_ROUTES.prescriptions },
  { label: 'Lab orders', sub: '', icon: ICONS.cpu, href: PATIENT_ROUTES.labRequests },
  { label: 'Health record', sub: '', icon: ICONS.shield, href: PATIENT_ROUTES.medicalRecords },
  { label: 'Messages', sub: '', icon: ICONS.message, href: PATIENT_ROUTES.messages },
  { label: 'Bills and payments', sub: '', icon: ICONS.info, href: PATIENT_ROUTES.billing },
  { label: 'Help', sub: '', icon: ICONS.user, href: '/patient/help' },
]










const bookingSpecialties = [
  'Cardiology',
  'Dermatology',
  'General Practice',
  'Pediatrics',
  'Psychiatry',
  'Orthopedics',
]

function getGreeting(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours()
  if (hour < 12) return 'greetingMorning'
  if (hour < 18) return 'greetingAfternoon'
  return 'greetingEvening'
}

const TIMELINE_KEYS: Record<string, string> = {
  episode_created: 'episodeCreated', intake_submitted: 'intakeSubmitted', medical_record_uploaded: 'recordUploaded',
  appointment_booked: 'appointmentBooked', message_received: 'messageReceived', lab_result_uploaded: 'labResultUploaded',
  lab_result_received: 'labResultReceived', lab_visit_recorded: 'labVisitRecorded', work_certificate_issued: 'workCertificateIssued',
  doctor_assigned: 'doctorAssigned', episode_closed: 'episodeClosed', episode_transitioned: 'episodeUpdated',
}

/** Quick actions are labelled by where they lead, in the patient's language. Stored
 *  dashboard rows carry English text written at sign-up, so it is not shown. */
const ACTION_KEYS: Record<string, [string, string]> = {
  '/patient/find-doctor': ['actionFindAppointments', 'actionFindAppointmentsSub'],
  '/patient/prescriptions': ['actionMedication', 'actionMedicationSub'],
  '/patient/prescription-care-plan': ['actionMedication', 'actionMedicationSub'],
  '/patient/lab-requests': ['actionLabOrders', 'actionLabOrdersSub'],
  '/patient/medical-records': ['actionRecords', 'actionRecordsSub'],
  '/patient/messages': ['actionMessages', 'actionMessagesSub'],
  '/patient/referrals': ['actionReferrals', 'actionReferralsSub'],
  '/patient/billing': ['actionBilling', 'actionBillingSub'],
  '/patient/appointments': ['actionAppointments', 'actionAppointmentsSub'],
  '/patient/help': ['actionHelp', 'actionHelpSub'],
}

/** Portal areas the dashboard search can open directly, in addition to doctors, records and prescriptions. */
const SEARCH_DESTINATIONS: { href: string; key: string }[] = [
  { href: '/patient/find-doctor', key: 'findAppointments' }, { href: '/patient/appointments', key: 'appointments' },
  { href: '/patient/billing', key: 'billing' }, { href: '/patient/medical-records', key: 'records' },
  { href: '/patient/prescription-care-plan', key: 'medication' }, { href: '/patient/lab-requests', key: 'labOrders' },
  { href: '/patient/referrals', key: 'referrals' }, { href: '/patient/messages', key: 'messages' },
  { href: '/patient/notifications', key: 'notifications' }, { href: '/patient/settings', key: 'settings' },
  { href: '/patient/help', key: 'help' },
]
/** Lower case without accents, so "Ärztin" matches "arztin" and "Rechnung" matches "rechnungen". */
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

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

function resolveIcon(value: unknown, fallback: string | readonly string[]) {
  const raw = text(value)
  const key = raw ? iconAliases[raw] ?? raw : ''
  return key && iconLookup[key] ? iconLookup[key] : fallback
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

const SECTION_CARD_STYLE: React.CSSProperties = {
  background: "var(--surface-glass)",
  backdropFilter: 'blur(22px) saturate(175%)',
  WebkitBackdropFilter: 'blur(22px) saturate(175%)',
  borderRadius: '20px',
  border: "1px solid var(--border)",
  boxShadow: Sh.card,
  padding: '20px',
}

/**
 * A dashboard card. Essential cards are always open. Secondary cards pass
 * `collapsible`: they show their title and a one-line status, and open on
 * request. `defaultOpen` opens one when it has something to show; the key
 * remounts it when that changes, so arriving content opens it once without
 * overriding a choice made later.
 */
function SectionCard({ title, sub, action, children, collapsible = false, defaultOpen = true, status }: {
  title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode
  collapsible?: boolean; defaultOpen?: boolean; status?: string
}) {
  const heading = (
    <div className='pd-section-copy'>
      <h2 className='portal-h2 pd-section-title'>{title}</h2>
      {sub && <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>{sub}</p>}
    </div>
  )
  if (collapsible) {
    return (
      <section className='pd-collapsible' style={{ ...SECTION_CARD_STYLE, padding: 0 }}>
        <details key={defaultOpen ? 'open' : 'closed'} open={defaultOpen}>
          <summary className='pd-section-header pd-collapsible-summary'>
            {heading}
            <span className='pd-collapsible-meta'>{status && <span className='pd-collapsible-status'>{status}</span>}<span aria-hidden='true' className='pd-chevron'>▾</span></span>
          </summary>
          <div className='pd-collapsible-body'>
            {action ? <div className='pd-section-action' style={{ marginBottom: '12px' }}>{action}</div> : null}
            {children}
          </div>
        </details>
      </section>
    )
  }
  return (
    <section style={SECTION_CARD_STYLE}>
      <header className='pd-section-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        {heading}
        {action ? <div className='pd-section-action'>{action}</div> : null}
      </header>
      {children}
    </section>
  )
}


function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ borderRadius: '16px', border: "1px dashed var(--border)", background: "var(--surface-glass)", padding: '18px', color: T.slate, fontSize: '13px', lineHeight: 1.55, display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{children}</span>
      {action}
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
        border: "1px solid var(--border)",
        borderRadius: '15px',
        padding: '15px 14px',
        background: hovered ? "var(--surface-glass)" : "var(--surface-glass)",
        boxShadow: hovered ? '0 10px 24px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.92)' : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(4,53,77,0.06)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
      aria-label={item.label}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: item.tint, border: "1px solid var(--border)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.link }}>
          <Ico p={item.icon} size={15} sw={1.75} />
        </div>
        <Ico p={ICONS.arrowSm} size={14} sw={1.7} color={hovered ? '#348CEA' : T.slate2} />
      </div>
      <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: '0.06em', color: T.slate2, textTransform: 'uppercase', marginBottom: '5px' }}>{item.label}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.018em', color: T.navy, marginBottom: '3px' }}>{item.value}</div>
      <div style={{ fontSize: "13px", color: T.slate, lineHeight: 1.45 }}>{item.sub}</div>
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
        border: "1px solid var(--border)",
        borderRadius: '14px',
        background: hovered ? "var(--surface-glass)" : "var(--surface-glass)",
        boxShadow: hovered ? '0 12px 24px rgba(4,53,77,0.12), inset 0 1px 0 rgba(255,255,255,0.94)' : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 10px rgba(4,53,77,0.06)',
        padding: '14px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        transition: 'all 0.18s ease',
      }}
      aria-label={action.label}
    >
      <span style={{ width: '36px', height: '36px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hovered ? 'rgba(32,181,223,0.18)' : 'rgba(165,224,218,0.28)', border: "1px solid var(--border)", color: hovered ? "var(--link)" : T.link, transition: 'all 0.18s ease' }}>
        <Ico p={action.icon} size={16} sw={1.7} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>{action.label}</span>
        <span style={{ display: 'block', fontSize: "13px", color: T.slate2 }}>{action.sub}</span>
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
    border: "1px solid var(--border)",
    background: "var(--surface-glass)",
    color: T.slate,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}

export default function PatientDashboardPage() {
  const t = useTranslations('patientDashboard'), locale = useLocale()
  // Specialty values go to the doctor search unchanged; only their labels are translated.
  const specialtyLabel = (value: string) => t(`extra.spec${value.replace(/[^A-Za-z]/g, '')}`)
  const countLabel = (count: number, noun: 'plan' | 'result' | 'referral' | 'measurement' | 'event' | 'doctor') => t(`extra.count${noun[0].toUpperCase()}${noun.slice(1)}`, { count })
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<PatientDashboardSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState(false)
  const [healthError, setHealthError] = useState(false)
  const [reload, setReload] = useState(0)
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [doctorsError, setDoctorsError] = useState(false)
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
  const displayPatientName = patientName || t('extra.patient')

  const handleLogout = async () => {
    try { await logoutCurrentUser() }
    catch { console.warn('Server logout could not be confirmed.') }
    finally { setShowLogoutModal(false); router.replace('/auth/sign-in') }
  }

  const handleBookNextAvailable = async () => {
    try {
      const token = readSessionMarker()
      if (!token) {
        router.push('/auth/sign-in')
        return
      }

      const data = await apiGet<{ doctor?: { id?: string; name?: string; nextAvailable?: string }; booking?: { recommendedSlot?: string } }>('/api/v1/patient/doctors/next-available?consultation_type=video')
      const doctorId = text(data?.doctor?.id)
      const recommendedSlot = text(data?.booking?.recommendedSlot ?? data?.doctor?.nextAvailable)
      if (!doctorId || !recommendedSlot || recommendedSlot.toLowerCase() === 'not available') {
        router.push(PATIENT_ROUTES.findDoctor)
        return
      }
      router.push(physicianPath(doctorId, text(data?.doctor?.name), new URLSearchParams({ from: 'dashboard', intent: 'book', slot: recommendedSlot })))
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
    const token = readSessionMarker()
    if (!token) {
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false
    setDashboardLoading(true)
    setDashboardError(false)
    setHealthError(false)
    const fetchDashboardProfile = async () => {
      try {
        const data = await getPatientDashboard(readPortalIdentity('patient')?.user_id)
        if (cancelled) return
        setDashboardData(data)
        setPatientName(data.patient_name || '')
        const plans = instructionList(data.care_plans ?? data.carePlans ?? []).items.map(careInstruction)
        const activePlan = plans.find(plan => plan.status?.trim().toLowerCase() === 'active') ?? plans[0]
        // One wording everywhere: no plan means "none recorded" (as on the plan page),
        // never "not started" here and "active" elsewhere.
        setCarePlanStatus(activePlan?.status?.trim() ? `status:${activePlan.status.trim()}` : plans.length ? 'unknown' : 'none')
      } catch (error) {
        if (cancelled) return
        if (isAuthError(error)) {
          clearPortalSession()
          router.replace('/auth/sign-in')
          return
        }
        setDashboardError(true)
        setCarePlanStatus('Unavailable')
      } finally {
        if (!cancelled) setDashboardLoading(false)
      }
    }
    const fetchHealthInfo = async () => {
      try {
        const data = await getPatientHealthInfo()
        if (!cancelled) setHealthInfo(data)
      } catch {
        if (!cancelled) setHealthError(true)
      }
    }
    void fetchDashboardProfile()
    void fetchHealthInfo()
    return () => { cancelled = true }
  }, [router, reload])

  useEffect(() => {
    let cancelled = false

    const fetchRecommendedDoctors = async () => {
      setDoctorsLoading(true)
      setDoctorsError(false)
      try {
        const params = new URLSearchParams({ sort: 'highest-rated' })
        const data = await searchPatientDoctors(params)
        if (!cancelled) {
          setRecommendedDoctors(data.doctors.slice(0, 3))
        }
      } catch (error) {
        if (isAuthError(error)) {
          clearPortalSession()
          router.push('/auth/sign-in')
        }
        if (!cancelled) setDoctorsError(true)
      } finally {
        if (!cancelled) setDoctorsLoading(false)
      }
    }

    const fetchRecentDoctors = async () => {
      try {
        const token = readSessionMarker()
        if (!token) return

        const data = await apiGet<{ recent_doctors?: PatientDoctor[] }>('/api/v1/patient/doctors/recent')
        if (!cancelled) setRecentDoctors(data.recent_doctors || [])
      } catch (error) {
        console.error('Failed to fetch recent doctors:', error)
      }
    }

    fetchRecommendedDoctors()
    fetchRecentDoctors()
    return () => {
      cancelled = true
    }
  }, [router, reload])

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
          clearPortalSession()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Dashboard search failed:', error)
        if (!cancelled) {
          setSearchResults([])
          setSearchError(t('extra.searchUnavailable'))
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
  }, [router, search, t])

  const handleSearchResult = (href: string) => {
    setSearchOpen(false)
    router.push(href)
  }

  // Matching areas of the portal come first: "Rechnung" opens billing even when no doctor or record matches.
  const pageHits = useMemo(() => {
    const query = searchable(search.trim())
    if (query.length < 2) return []
    return SEARCH_DESTINATIONS.filter(({ key }) => searchable(`${t(`searchArea.${key}.title`)} ${t(`searchArea.${key}.keywords`)}`).includes(query))
  }, [search, t])

  const categoryLabel = (category: PatientDashboardSearchResult['category']) => {
    if (category === 'doctors') return t('extra.resultDoctor')
    if (category === 'records') return t('extra.resultRecord')
    return t('extra.resultPrescription')
  }

  const displaySummaryCards = useMemo<SummaryCard[]>(() => {
    const source = dashboardArray(dashboardData, 'summary_cards', 'summaryCards')
    if (!source.length && !dashboardHasKey(dashboardData, 'summary_cards', 'summaryCards')) return []
    return source.map((item) => {
      return {
        label: text(item.label, t('extra.summaryItem')),
        value: text(item.value, '-'),
        sub: text(item.sub ?? item.hint ?? item.status, ''),
        icon: resolveIcon(item.icon, ICONS.info),
        tint: text(item.tint, 'rgba(32,181,223,0.14)'),
        href: text(item.href, PATIENT_ROUTES.dashboard),
      }
    })
  }, [dashboardData, t])

  const displayQuickActions = useMemo<QuickAction[]>(() => {
    const source = dashboardArray(dashboardData, 'quick_actions', 'quickActions')
    const labelled = (action: QuickAction) => { const keys = ACTION_KEYS[action.href.split(/[?#]/)[0]]; return keys ? { ...action, label: t(keys[0]), sub: t(keys[1]) } : action }
    if (!source.length && !dashboardHasKey(dashboardData, 'quick_actions', 'quickActions')) return quickActions.map(labelled)
    return source.map((item, index) => {
      const fallback = quickActions[index % quickActions.length]
      const href = text(item.href, fallback.href)
      const keys = ACTION_KEYS[href.split(/[?#]/)[0]]
      return {
        label: keys ? t(keys[0]) : text(item.label, fallback.label),
        sub: keys ? t(keys[1]) : text(item.sub ?? item.hint, fallback.sub),
        icon: resolveIcon(item.icon, fallback.icon),
        href: text(item.href, fallback.href),
      }
    })
  }, [dashboardData, t])

  const displayCarePlans = useMemo<CarePlanCard[]>(() => {
    const source = dashboardArray(dashboardData, 'care_plans', 'carePlans')
    if (!source.length && !dashboardHasKey(dashboardData, 'care_plans', 'carePlans')) return []
    return source.map((item) => {
      const plan = careInstruction(item)
      return {
        name: plan.title?.trim() || t('extra.planTitleMissing'), progress: plan.progress,
        physician: text(item.physician ?? item.provider ?? item.doctor, t('extra.clinicianMissing')),
        eta: plan.status?.trim() ? t('extra.statusLine', { status: plan.status }) : t('extra.clinicalStatusMissing'),
        tasks: plan.description?.trim() || t('extra.planDetailsMissing'), reviewNeeded: plan.quality.reviewNeeded,
      }
    })
  }, [dashboardData, t])

  const medicationCount = dashboardArray(dashboardData, 'medications').length

  const displayLabData = useMemo<LabDatum[]>(() => {
    const source = dashboardArray(dashboardData, 'lab_data', 'labData')
    if (!source.length && !dashboardHasKey(dashboardData, 'lab_data', 'labData')) return []
    return source.map((item) => {
      const fallback = { value: t('extra.labTest'), detail: '' }
      return {
        title: text(item.title ?? item.name, t('extra.labUpdate')),
        value: text(item.value ?? item.name ?? item.category, fallback.value),
        status: text(item.status, 'Pending'),
        detail: text(item.detail ?? item.date ?? item.completionDate, fallback.detail),
      }
    })
  }, [dashboardData, t])

  const displayReferrals = useMemo<ReferralCard[]>(() => {
    const source = dashboardArray(dashboardData, 'referrals')
    if (!source.length && !dashboardHasKey(dashboardData, 'referrals')) return []
    return source.map((item) => {
      const fallback = { detail: '' }
      return {
        name: text(item.name ?? item.title, t('extra.referral')),
        status: text(item.status, 'Pending'),
        detail: text(item.detail ?? item.specialty ?? item.reason, fallback.detail),
      }
    })
  }, [dashboardData, t])

  const displayMessageThreads = useMemo<MessageThread[]>(() => {
    const source = dashboardArray(dashboardData, 'message_threads', 'messageThreads')
    if (!source.length && !dashboardHasKey(dashboardData, 'message_threads', 'messageThreads')) return []
    return source.map((item) => {
      const fallback = { preview: '', unread: false, time: '' }
      const sender = text(item.sender ?? item.name ?? item.contactName, t('extra.careTeam'))
      return {
        sender,
        preview: text(item.preview ?? item.lastMessage ?? item.body, fallback.preview),
        unread: Boolean(item.unread ?? item.isUnread ?? fallback.unread),
        time: text(item.time ?? item.lastMessageTime, fallback.time),
        href: text(item.href, PATIENT_ROUTES.messages),
      }
    })
  }, [dashboardData, t])

  const displayDocs = useMemo<DocumentCard[]>(() => {
    const source = dashboardArray(dashboardData, 'docs', 'documents')
    if (!source.length && !dashboardHasKey(dashboardData, 'docs', 'documents')) return []
    return source.map((item) => {
      const fallback = { count: t('extra.noFiles') }
      const name = text(item.name ?? item.title, t('extra.document'))
      return {
        name,
        count: text(item.count ?? item.meta ?? [item.type, item.size].filter(Boolean).join(' - '), fallback.count),
        href: text(item.href, documentHref(name)),
      }
    })
  }, [dashboardData, t])

  const displayWellnessCards = useMemo<WellnessCard[]>(() => {
    const source = dashboardArray(dashboardData, 'wellness_cards', 'wellnessCards')
    if (!source.length && !dashboardHasKey(dashboardData, 'wellness_cards', 'wellnessCards')) return []
    return source.map((item) => {
      const fallback = { value: '', sub: '' }
      return {
        title: text(item.title ?? item.label, t('extra.wellness')),
        value: text(item.value, fallback.value),
        sub: text(item.sub ?? item.hint, fallback.sub),
      }
    })
  }, [dashboardData, t])

  const displayMetrics = useMemo<MetricCard[]>(() => {
    // Use health info from profile instead of dashboard historical data
    if (healthInfo.blood_pressure) {
      const bp = healthInfo.blood_pressure
      return [{ label: t('extra.bloodPressure'), value: `${bp} mmHg`, trend: t('extra.recordedMeasurement'), color: "var(--link)" }]
    }

    // Fallback to dashboard data if no health info
    const source = dashboardArray(dashboardData, 'metrics')
    if (!source.length && !dashboardHasKey(dashboardData, 'metrics')) return []
    return source.map((item) => {
      const fallback = { value: '', trend: '', color: "var(--link)" }
      return {
        label: text(item.label, t('extra.metric')),
        value: text(item.value, fallback.value),
        trend: text(item.trend, fallback.trend),
        color: text(item.color, fallback.color),
      }
    })
  }, [dashboardData, healthInfo, t])

  const displayTimelineItems = useMemo<TimelineCard[]>(() => {
    const source = dashboardArray(dashboardData, 'timeline_items', 'timelineItems')
    if (!source.length && !dashboardHasKey(dashboardData, 'timeline_items', 'timelineItems')) return []
    return source.map((item) => {
      const fallback = { sub: '', time: '' }
      // Known events read in the patient's language: what happened and whether
      // anything is needed. Unknown types keep their stored title.
      const known = TIMELINE_KEYS[text(item.event_type, '').replace('.', '_')]
      const sub = text(item.sub ?? item.body ?? item.provider, fallback.sub)
      return {
        title: known ? t(`timeline.${known}`) : text(item.title ?? item.event, t('timeline.careUpdate')),
        sub: known && t.has(`timeline.${known}Body`) ? t(`timeline.${known}Body`) : /^[A-Z][a-z]+(\.[A-Z][a-z]+)+$/.test(sub) ? '' : sub,
        time: text(item.time ?? item.date, fallback.time),
      }
    })
  }, [dashboardData, t])

  const displayAIInsights = useMemo<AIInsightCard[]>(() => {
    const source = dashboardArray(dashboardData, 'ai_insights', 'aiInsights')
    if (!source.length) return []
    return source.map((item) => ({
      title: text(item.title, t('extra.insight')),
      body: text(item.body ?? item.description, ''),
      action: text(item.action ?? item.action_label ?? item.actionLabel, ''),
      href: text(item.href, '') || undefined,
      icon: resolveIcon(item.icon, insightIcon(item.type ?? item.insight_type ?? item.insightType)),
    }))
  }, [dashboardData, t])

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
      { label: t('extra.tileAppointments'), value: appointment?.value ?? '0', sub: appointment?.sub ?? t('extra.noUpcoming') },
      { label: t('extra.tilePrescriptions'), value: prescriptions?.value ?? String(medicationCount), sub: prescriptions?.sub ?? (medicationCount ? t('extra.recordedMedications') : t('extra.noMedications')) },
      { label: t('extra.tileLabs'), value: String(labs.length || displayLabData.length), sub: labs[0]?.status ?? t('extra.noPendingTests') },
      { label: t('extra.tileMessages'), value: messages?.value ?? String(displayMessageThreads.filter((item) => item.unread).length), sub: messages?.sub ?? t('extra.careTeamUpdates') },
    ]
  }, [dashboardData, displayLabData, medicationCount, displayMessageThreads, displaySummaryCards, t])

  const currentAppointment = displaySummaryCards.find((item) => item.label.toLowerCase().includes('appointment'))
  const primaryPhysician = displaySummaryCards.find((item) => item.label.toLowerCase().includes('physician'))
  const hasUpcomingAppointment = currentAppointment ? Number.parseInt(currentAppointment.value, 10) > 0 : false
  const hasCareActivity = hasUpcomingAppointment || displayCarePlans.length > 0 || medicationCount > 0 || displayLabData.length > 0 || displayMessageThreads.length > 0
  const heroBody = hasCareActivity
    ? t('extra.introReturning')
    : t('extra.introNew')
  const recordedPlanProgress = displayCarePlans.flatMap(plan => plan.progress === null ? [] : [plan.progress])
  const careProgress = recordedPlanProgress.length ? Math.round(recordedPlanProgress.reduce((total, value) => total + value, 0) / recordedPlanProgress.length) : null
  const todayScheduleItems = [
    ...(hasUpcomingAppointment && currentAppointment && primaryPhysician ? [{ title: t('extra.upcomingAppointment'), body: `${primaryPhysician.value} · ${primaryPhysician.sub}`, time: currentAppointment.sub }] : []),
    ...displayLabData.slice(0, 1).map((item) => ({ title: t('extra.labUpdate'), body: `${item.value} · ${item.status}`, time: item.detail })),
  ].slice(0, 3)

  return (
    <main className='patient-dashboard' style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        .pd-shell { display: grid; grid-template-columns: 260px minmax(0, 1fr) 320px; gap: 18px; max-width: 1440px; margin: 0 auto; padding: 18px; }
        .pd-left, .pd-main, .pd-right { min-width: 0; }

        .pd-head-row { display: flex; gap: 12px; align-items: center; }
        .pd-dashboard-header-row { display: grid; grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.15fr); gap: 16px; align-items: center; }
        .pd-greeting-block { min-width: 0; }
        .pd-greeting-title { margin: 0; font-family: var(--font-body); font-size: 24px; line-height: 1.14; font-weight: 800; color: ${T.navy}; }
        .pd-greeting-kicker, .pd-greeting-name { display: block; }
        .pd-greeting-name { overflow-wrap: anywhere; }
        .pd-section-header, .pd-section-copy { min-width: 0; }
        .pd-collapsible-summary { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 20px; cursor: pointer; list-style: none; border-radius: 20px; min-height: 48px; }
        .pd-collapsible-summary::-webkit-details-marker { display: none; }
        .pd-collapsible-summary:focus-visible { outline: 3px solid var(--action-primary); outline-offset: -3px; }
        .pd-collapsible-meta { display: inline-flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .pd-collapsible-status { font-size: 13px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        .pd-chevron { display: inline-block; font-size: 14px; color: var(--text-secondary); transition: transform .18s ease; }
        .pd-collapsible details[open] .pd-chevron { transform: rotate(180deg); }
        .pd-collapsible-body { padding: 0 20px 20px; }
        @media (prefers-reduced-motion: reduce) { .pd-chevron { transition: none; } }
        .pd-section-action { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: flex-end; }
        .pd-section-action a { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border-radius: 11px; padding: 0 10px; background: var(--surface); border: 1px solid var(--border); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9); line-height: 1.2; white-space: nowrap; }
        .pd-toolbar { display: grid; grid-template-columns: minmax(170px, 1fr) 38px 38px 42px; justify-content: flex-end; min-width: 0; width: 100%; max-width: 560px; margin-left: auto; }
        .pd-profile-avatar { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; aspect-ratio: 1 / 1; border-radius: 50% !important; display: inline-grid !important; place-items: center !important; line-height: 1 !important; padding: 0 !important; overflow: hidden; flex: 0 0 auto; }
        .pd-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .pd-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-hero-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: center; width: 100%; min-width: 0; }
        .pd-hero-actions > * { min-width: 0; }
        .pd-primary-cta, .pd-secondary-cta, .pd-specialty-trigger { width: 100%; justify-content: center !important; min-width: 0; }
        .pd-specialty-wrap { min-width: 0; width: 100%; }
        .pd-specialty-trigger span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pd-specialty-menu { position: absolute; left: 0; top: calc(100% + 8px); z-index: 320; width: 230px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); box-shadow: 0 18px 34px rgba(4,53,77,0.14), inset 0 1px 0 rgba(255,255,255,0.96); padding: 7px; }
        .pd-specialty-option { width: 100%; min-height: 36px; border: none; border-radius: 10px; background: transparent; color: ${T.navy}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 10px; font-size: 12.5px; font-weight: 700; text-align: left; transition: all 0.15s ease; }
        .pd-specialty-option:hover, .pd-specialty-option:focus-visible { background: rgba(32,181,223,0.12); color: #348CEA; outline: none; }
        .pd-appointment-grid { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; gap: 16px; align-items: center; }
        .pd-record-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pd-snapshot-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .pd-snapshot-card { min-width: 0; border-radius: 16px; padding: 14px; background: var(--surface); border: 1px solid var(--border); }
        .pd-snapshot-label, .pd-snapshot-sub { overflow-wrap: anywhere; hyphens: auto; }
        .pd-doctor-carousel { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(min(320px, 100%), 1fr); gap: 12px; overflow-x: auto; padding-bottom: 2px; }
        .pd-doctor-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 6px; min-width: 0; }
        .pd-doctor-meta { margin: 0; min-width: 0; font-size: 12px; color: ${T.slate2}; overflow-wrap: anywhere; line-height: 1.45; }
        .pd-doctor-actions { display: flex; gap: 8px; flex: 0 0 auto; }
        .pd-doctor-action-link { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; border-radius: 10px; padding: 0 10px; border: 1px solid var(--border); background: var(--surface); box-shadow: inset 0 1px 0 rgba(255,255,255,0.92); text-decoration: none; font-size: 12px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
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
          .pd-section-action a { justify-content: space-between; padding: 0 12px; }
          .pd-doctor-actions { grid-template-columns: 1fr; }
        }
      `}</style>

      <div aria-hidden='true' style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.1) 1px, transparent 1.2px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)' }} />

      <div className='pd-shell'>
        <aside id='patient-primary-sidebar' className='pd-left'>
          <div className='pd-sidebar portal-sidebar-content' style={{ background: "var(--surface-glass)", backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', borderRadius: '22px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '16px' }}>
            <section aria-label={t('patientSummary')} style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', border: "1px solid var(--border)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.navy, fontWeight: 700 }}><ProfileImage name={displayPatientName}/></div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{displayPatientName}</p>
                  <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{carePlanStatus === 'none' ? t('carePlanNone') : carePlanStatus === 'unknown' ? t('carePlanUnknown') : carePlanStatus.startsWith('status:') ? t('carePlanStatus', { status: carePlanStatus.slice(7) }) : carePlanStatus === 'Unavailable' ? t('extra.carePlanUnavailable') : t('carePlanLoading')}</p>
                </div>
              </div>
            </section>

            <nav aria-label={t('patientNavigation')}>
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
                        color: isActive ? T.link : T.slate,
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
                      <NavLabel portal='patient' label={item.label} />
                    </button>
                  )
                })}
              </div>
            </nav>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', border: 'none', background: 'transparent', color: "var(--link)", fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                <Ico p={ICONS.arrowSm} size={15} sw={1.8} color='#348CEA' />
                {t('logout')}
              </button>
            </div>
          </div>
        </aside>

        <section className='pd-main' aria-label={t('patientDashboardHome')}>
          <header style={{ ...Glass.nav, position: 'relative', zIndex: 90, overflow: 'visible', borderRadius: '20px', border: "1px solid var(--border)", padding: '14px 14px 12px', marginBottom: '14px' }}>
            <div className='pd-dashboard-header-row'>
              <div className='pd-greeting-block'>
                <h1 className='pd-greeting-title'>
                  <span className='pd-greeting-kicker'>{greeting ? t(greeting) : ''}</span>
                  <span className='pd-greeting-name'>{patientName || t('extra.patient')} <span aria-hidden='true'>👋</span></span>
                </h1>
                <p style={{ margin: '5px 0 0', fontSize: '13px', color: T.slate }}>{t('howAreYouFeelingToday')}</p>
              </div>
              <div className='pd-head-row pd-toolbar'>
                <label className='pd-search' htmlFor='dashboard-search' style={{ width: '100%', position: 'relative', zIndex: 120, display: 'block', minWidth: 0 }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: search ? "var(--link)" : T.slate2, pointerEvents: 'none' }}>
                    <Ico p={ICONS.search} size={15} sw={1.8} />
                  </span>
                  <input
                    id='dashboard-search'
                    type='search'
                    placeholder={t('searchDoctorsRecordsPrescriptions')}
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
                    style={{ width: '100%', height: '38px', borderRadius: '11px', border: `1px solid ${search ? 'rgba(32,181,223,0.45)' : "var(--border)"}`, padding: '0 12px 0 38px', fontSize: '13px', color: T.navy, background: "var(--surface-glass)", boxShadow: search ? '0 0 0 3px rgba(32,181,223,0.1)' : 'none', transition: 'all 0.16s ease' }}
                    aria-label={t('globalSearch')}
                    autoComplete='off'
                  />
                  {searchOpen && search.trim().length >= 2 && (
                    <div
                      role='listbox'
                      aria-label={t('dashboardSearchResults')}
                      style={{
                        position: 'absolute',
                        top: '46px',
                        left: 0,
                        right: 0,
                        zIndex: 200,
                        maxHeight: '360px',
                        overflow: 'auto',
                        borderRadius: '14px',
                        border: "1px solid var(--border)",
                        background: "var(--surface-glass)",
                        boxShadow: '0 18px 36px rgba(4,53,77,0.16), inset 0 1px 0 rgba(255,255,255,0.96)',
                        padding: '8px',
                      }}
                    >
                      {searching && (
                        <div style={{ padding: '12px', fontSize: "13px", color: T.slate }}>
                          {t('searching')}
                        </div>
                      )}
                      {!searching && searchError && (
                        <div style={{ padding: '12px', fontSize: "13px", color: '#B42318' }}>
                          {searchError}
                        </div>
                      )}
                      {pageHits.map(({ href, key }) => (
                        <button
                          key={`area-${key}`}
                          type='button'
                          role='option'
                          aria-selected={false}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSearchResult(href)}
                          style={{ width: '100%', border: 'none', borderRadius: '11px', background: 'transparent', padding: '10px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: "13px", fontWeight: 800, color: T.navy }}>{t(`searchArea.${key}.title`)}</span>
                            <span style={{ display: 'block', marginTop: '2px', fontSize: "13px", color: T.slate2 }}>{t(`searchArea.${key}.sub`)}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: "var(--link)", fontSize: "13px", fontWeight: 700 }}>
                            {t('searchArea.category')}
                          </span>
                        </button>
                      ))}
                      {!searching && !searchError && searchResults.length === 0 && pageHits.length === 0 && (
                        <div style={{ padding: '12px', fontSize: "13px", color: T.slate }}>
                          {t('noMatchingDoctorsRecordsOr')}
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
                            <span style={{ display: 'block', fontSize: "13px", fontWeight: 800, color: T.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</span>
                            <span style={{ display: 'block', marginTop: '2px', fontSize: "13px", color: T.slate2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.subtitle}{result.description ? ` - ${result.description}` : ''}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: "var(--link)", fontSize: "13px", fontWeight: 800 }}>
                            {categoryLabel(result.category)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <HoverBtn
                  ariaLabel={t('extra.openHelp')}
                  title={t('helpAndSupport')}
                  onClick={() => router.push(PATIENT_ROUTES.support)}
                  base={topButtonBase()}
                  on={{ background: 'rgba(32,181,223,0.12)', color: "var(--link)", transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(4,53,77,0.1)' }}
                >
                  <Ico p={ICONS.help} size={16} sw={1.8} />
                </HoverBtn>
                <HoverBtn
                  ariaLabel={t('extra.openMessages')}
                  title={t('messages')}
                  onClick={() => router.push(PATIENT_ROUTES.messages)}
                  base={topButtonBase()}
                  on={{ background: 'rgba(32,181,223,0.12)', color: "var(--link)", transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(4,53,77,0.1)' }}
                >
                  <Ico p={ICONS.message} size={16} sw={1.8} />
                </HoverBtn>
                <button type='button' className='pd-profile-avatar' aria-label={t('openProfileSettings')} onClick={() => router.push(PATIENT_ROUTES.settings)} style={{ width: '42px', height: '42px', borderRadius: '50%', border: "1px solid var(--border)", background: 'linear-gradient(135deg, rgba(32,181,223,0.2), rgba(52,140,234,0.3))', color: T.navy, fontWeight: 700, cursor: 'pointer' }}><ProfileImage name={displayPatientName}/></button>
              </div>
            </div>
          </header>
          {dashboardLoading ? <section role='status' aria-live='polite' style={{ padding: 32, background: "var(--surface)", borderRadius: 20 }}>{t('loadingYourDashboard')}</section> : dashboardError ? <section role='alert' style={{ padding: 32, background: "var(--surface)", borderRadius: 20 }}><h2>{t('weCouldnTLoadYour')}</h2><p>{t('yourRecordsHaveNotBeen')}</p><button onClick={() => setReload(value => value + 1)}>{t('tryAgain')}</button></section> : <>


          <section style={{ ...Glass.aiCard, position: 'relative', zIndex: specialtyMenuOpen ? 260 : 1, overflow: 'visible', borderRadius: '22px', padding: '22px', marginBottom: '14px', boxShadow: Sh.float }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: '620px' }}>
                <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: "var(--link)" }}>{t('yourCareJourney')}</p>
                <h2 className='portal-h2'>
                  {t('welcomeBack', { name: displayPatientName })} {hasCareActivity ? t('overviewReady') : t('startByFindingAppointment')}
                </h2>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: T.slate }}>
                  {heroBody}
                </p>
              </div>

              <div style={{ minWidth: '250px', flex: 1 }}>
                <div style={{ borderRadius: '16px', padding: '14px', background: "var(--surface-glass)", border: "1px solid var(--border)", boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 24px rgba(4,53,77,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.slate2 }}>{t('careActivity')}</p>
                    <span style={{ ...Glass.chip, padding: '4px 10px', borderRadius: '999px', fontSize: "13px", color: hasCareActivity ? '#0F9E77' : T.slate, fontWeight: 700 }}>{hasCareActivity ? t('activityActive') : t('activityNew')}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{hasCareActivity ? t('activityTracked') : t('activityNone')}</p>
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
                  background: 'linear-gradient(135deg, #20B5DF 0%, var(--primary-end) 100%)',
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
                {t('findADoctor')}
              </HoverBtn>

              <HoverBtn
                className='pd-secondary-cta'
                onClick={() => router.push(PATIENT_ROUTES.findDoctor)}
                base={{
                  minHeight: '38px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: "1px solid var(--border)",
                  background: "var(--surface-glass)",
                  color: "var(--link)",
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
                  background: "var(--surface-glass)",
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(4,53,77,0.1)',
                }}
              >
                <Ico p={ICONS.calendar} size={15} sw={1.8} color='#348CEA' />
                {t('bookConsultation')}
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
                  color: "var(--link)",
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
                {t('bookNextAvailable')}
              </HoverBtn>

              <div ref={specialtyMenuRef} className='pd-specialty-wrap' style={{ position: 'relative' }}>
                <HoverBtn
                  className='pd-specialty-trigger'
                  ariaLabel={t('extra.bookBySpecialtyLabel')}
                  title={t('bookBySpecialty')}
                  onClick={() => setSpecialtyMenuOpen((open) => !open)}
                  base={{
                    minHeight: '38px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: "1px solid var(--border)",
                    background: "var(--surface-glass)",
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
                    background: "var(--surface-glass)",
                    color: "var(--link)",
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 20px rgba(4,53,77,0.1)',
                  }}
                >
                  <span>{selectedSpecialty ? specialtyLabel(selectedSpecialty) : t('bookBySpecialty')}</span>
                  <Ico p={ICONS.chevronDown} size={12} sw={1.8} color='currentColor' />
                </HoverBtn>
                {specialtyMenuOpen && (
                  <div className='pd-specialty-menu' role='menu' aria-label={t('bookBySpecialtyOptions')}>
                    {bookingSpecialties.map((specialty) => (
                      <button
                        key={specialty}
                        type='button'
                        role='menuitem'
                        className='pd-specialty-option'
                        onClick={() => handleBookBySpecialty(specialty)}
                      >
                        <span>{specialtyLabel(specialty)}</span>
                        {selectedSpecialty === specialty && <Ico p={ICONS.check} size={13} sw={1.9} color='currentColor' />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <SectionCard title={t('healthSummary')} sub={t('extra.subHealthSummary')}>
            <div className='pd-summary-grid'>
              {displaySummaryCards.map((item) => <SummaryTile key={item.label} item={item} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title={t('quickActions')} sub={t('extra.subQuickActions')}>
            <div className='pd-actions-grid'>
              {displayQuickActions.map((action) => <QuickActionTile key={action.label} action={action} />)}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={false} title={t('todaySHealthSnapshot')} sub={t('extra.subSnapshot')}>
            <div className='pd-snapshot-grid'>
              {snapshotCards.map((item) => (
                <div key={item.label} className='pd-snapshot-card'>
                  <p className='pd-snapshot-label' style={{ margin: '0 0 6px', fontSize: "13px", letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                  <p className='pd-snapshot-sub' style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard
            title={t('upcomingAppointments')}
            sub={t('extra.subAppointments')}
            action={hasUpcomingAppointment ? <span style={{ ...Glass.chip, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: "13px", color: T.link, fontWeight: 700 }}><span className='pd-notice-dot' /> {t('scheduled')}</span> : undefined}
          >
            {hasUpcomingAppointment && primaryPhysician && currentAppointment ? (
              <div className='pd-appointment-grid' style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px' }}>
                <ProfileAvatar name={primaryPhysician.value} kind='doctor' size={96} />
                <div>
                  <h3 className='portal-h3'>{primaryPhysician.value || t('extra.physician')}</h3>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.slate2 }}>{primaryPhysician.sub || t('extra.specialty')} · {t('extra.virtual')}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('date')}</strong> {currentAppointment.sub?.split(' at ')[0] || t('extra.scheduled')}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('time')}</strong> {currentAppointment.sub?.split(' at ')[1] || currentAppointment.sub || t('extra.tbd')}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('type')}</strong> {t('consultation')}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('status')}</strong> {t('booked')}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <HoverBtn onClick={() => router.push('/patient/video-consultation/waiting-room')} base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: 'none', background: '#20B5DF', color: '#fff', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 12px rgba(32,181,223,0.3)', cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>{t('joinConsultation')}</HoverBtn>
                  <HoverBtn onClick={() => router.push(PATIENT_ROUTES.appointmentDetails)} base={{ minHeight: '42px', borderRadius: '11px', padding: '0 14px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer' }} on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}>{t('viewDetails')}</HoverBtn>
                </div>
              </div>
            ) : (
              <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: "13px", fontWeight: 700 }}>{t('findADoctor')}</Link>}>
                {t('noAppointmentsAreScheduledYet')}
              </EmptyState>
            )}
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={displayCarePlans.length > 0} status={countLabel(displayCarePlans.length, 'plan')} title={t('carePlans')} sub={t('extra.subCarePlans')}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayCarePlans.length === 0 && (
                <EmptyState>{t('noActiveCarePlansYet')}</EmptyState>
              )}
              {displayCarePlans.map((plan, index) => (
                <div key={`${plan.name}:${index}`} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <h3 className='portal-h3'>{plan.name}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{plan.physician} · {plan.eta}</p>
                    </div>
                    <div style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: "13px", fontWeight: 700, color: T.link }}>{plan.progress === null ? t('extra.progressMissing') : t('extra.progressRecorded', { progress: plan.progress })}</div>
                  </div>
                  {plan.progress !== null && <div style={{ marginTop: '12px', height: '8px', borderRadius: '999px', background: "var(--surface-hover)", overflow: 'hidden' }}>
                    <div style={{ width: `${plan.progress}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, var(--primary-end) 100%)' }} />
                  </div>}
                  <p style={{ margin: '8px 0 0', fontSize: "13px", color: T.slate }}>{plan.tasks}</p>
                  {plan.reviewNeeded && <p className='mt-2 text-sm leading-7 text-secondary'>{t('clinicianReviewNeededForSome')}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title={t('medications')} sub={t('extra.subMedications')}>
            <PatientMedicationCards records={dashboardData?.medications ?? []} onUpdated={setDashboardData} />
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={displayLabData.length > 0} status={countLabel(displayLabData.length, 'result')} title={t('labResultsDiagnostics')} sub={t('extra.subLabs')}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayLabData.length === 0 && (
                <EmptyState>{t('noLabRequestsOrResults')}</EmptyState>
              )}
              {displayLabData.map((item) => (
                <div key={item.title} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 className='portal-h3'>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{item.value} · {item.status}</p>
                    <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate2 }}>{item.detail}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <HoverBtn onClick={() => router.push(PATIENT_ROUTES.labRequests)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>{t('viewReports')}</HoverBtn>
                    <HoverBtn onClick={() => router.push(PATIENT_ROUTES.medicalRecords)} base={{ minHeight: '36px', borderRadius: '10px', padding: '0 12px', border: 'none', background: 'linear-gradient(135deg, #20B5DF 0%, var(--primary-end) 100%)', color: '#fff', fontSize: "13px", fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>{t('download')}</HoverBtn>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={displayReferrals.length > 0} status={countLabel(displayReferrals.length, 'referral')} title={t('referralsSpecialistCare')} sub={t('extra.subReferrals')}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayReferrals.length === 0 && (
                <EmptyState>{t('noReferralsHaveBeenCreated')}</EmptyState>
              )}
              {displayReferrals.map((item) => (
                <div key={item.name} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <h3 className='portal-h3'>{item.name}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{item.detail}</p>
                    </div>
                    <div style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: "13px", fontWeight: 700, color: T.link }}>{item.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={displayMetrics.length > 0} status={countLabel(displayMetrics.length, 'measurement')} title={t('healthMetrics')} sub={t('extra.subMetrics')}>
            {healthError && <p role='alert'>{t('healthMeasurementsCouldNotBe')} <button onClick={() => setReload(value => value + 1)}>{t('tryAgain')}</button></p>}
            <div style={{ display: 'grid', gap: '10px' }}>
              {!healthError && displayMetrics.length === 0 && (
                <EmptyState>{t('noHealthMetricsHaveBeen')}</EmptyState>
              )}
              {displayMetrics.map((item) => {

                return (
                  <div key={item.label} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: item.color }}>{item.trend}</div>
                    </div>

                  </div>
                )
              })}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title={t('messages')} sub={t('extra.subMessages')}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {displayMessageThreads.length === 0 && (
                <EmptyState action={<Link href={PATIENT_ROUTES.messages} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: "13px", fontWeight: 700 }}>{t('openMessages')}</Link>}>
                  {t('noConversationsYet')}
                </EmptyState>
              )}
              {displayMessageThreads.map((message) => (
                <Link key={message.sender} href={message.href} style={{ textDecoration: 'none', borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '12px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: message.unread ? '#20B5DF' : "var(--surface-hover)" }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{message.sender}</p>
                      <p style={{ margin: '2px 0 0', fontSize: "13px", color: T.slate }}>{message.preview}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", color: T.slate2 }}>{message.time}</div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title={t('medicalDocuments')} sub={t('extra.subDocuments')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {displayDocs.length === 0 && (
                <EmptyState>{t('noMedicalDocumentsAreAvailable')}</EmptyState>
              )}
              {displayDocs.map((doc) => (
                <Link key={doc.name} href={doc.href} style={{ textDecoration: 'none', borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '12px' }}>
                  <h3 className='portal-h3'>{doc.name}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{doc.count}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={displayTimelineItems.length > 0} status={countLabel(displayTimelineItems.length, 'event')} title={t('healthTimeline')} sub={t('extra.subTimeline')}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
              {displayTimelineItems.length === 0 && (
                <EmptyState>{t('yourCareTimelineWillStart')}</EmptyState>
              )}
              {displayTimelineItems.map((item, index) => (
                <li key={`${item.title}-${item.sub}-${item.time}-${index}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: '10px', alignItems: 'start' }}>
                  <span aria-hidden='true' style={{ width: '18px', display: 'grid', placeItems: 'center', marginTop: '1px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: index === 0 ? '#20B5DF' : "var(--surface-hover)", boxShadow: index === 0 ? '0 0 0 4px rgba(32,181,223,0.12)' : 'none' }} />
                  </span>
                  <div style={{ border: "1px solid var(--border)", borderRadius: '12px', background: "var(--surface-glass)", padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}>{item.sub}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{item.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={false} title={t('healthInformation')} sub={t('extra.subHealthInfo')} action={<Link href='/patient/settings' style={{ fontSize: "13px", color: "var(--link)", fontWeight: 600, textDecoration: 'none' }}>{t('updateInSettings')}</Link>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: t('extra.bloodPressure'), value: healthInfo.blood_pressure || t('extra.notSet') },
                { label: t('extra.weight'), value: healthInfo.weight ? `${healthInfo.weight} kg` : t('extra.notSet') },
                { label: t('extra.height'), value: healthInfo.height ? `${healthInfo.height} cm` : t('extra.notSet') },
                { label: t('extra.bloodType'), value: healthInfo.blood_type || t('extra.notSet') },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: "13px", letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={false} title={t('personalWellness')} sub={t('extra.subWellness')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {displayWellnessCards.length === 0 && (
                <EmptyState>{t('noWellnessCheckInsHave')}</EmptyState>
              )}
              {displayWellnessCards.map((item) => (
                <div key={item.title} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '14px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: "13px", letterSpacing: '0.06em', textTransform: 'uppercase', color: T.slate2 }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: T.navy }}>{item.value}</p>
                  <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard collapsible defaultOpen={false} title={t('optionalAiAssistance')} sub={t('extra.subAi')}>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: "1px solid var(--border)", background: "var(--surface-glass)" }}>
              {displayAIInsights.length === 0 && (
                <EmptyState>{text(dashboardData?.ai_insights_message, t('extra.aiNote'))}</EmptyState>
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

          <SectionCard collapsible defaultOpen={(recentDoctors ?? []).length > 0} status={countLabel((recentDoctors ?? []).length, 'doctor')} title={t('quickReBooking')} sub={t('extra.subRebook')} action={<Link href='/patient/find-doctor' style={{ fontSize: "13px", color: "var(--link)", fontWeight: 700, textDecoration: 'none' }}>{t('findNewDoctor')}</Link>}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className='pd-doctor-carousel'>
                {(recentDoctors ?? []).length === 0 && (
                  <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: "13px", fontWeight: 700 }}>{t('findADoctor')}</Link>}>
                    {t('noRecentBookingsYetBook')}
                  </EmptyState>
                )}
                {(recentDoctors ?? []).map((doc) => (
                  <div key={doc.id} style={{ display: 'grid', gap: '8px' }}>
                    <DoctorCard name={doc.name} specialty={doc.specialty} verification={doc.verification} tags={doc.tags} imageUrl={doc.imageUrl} />
                    <div className='pd-doctor-footer'>
                      <p className='pd-doctor-meta'>⭐ {doc.reviews > 0 ? doc.rating.toFixed(1) : t('extra.noRatings')} · {t('extra.years', { years: doc.experienceYears })} · {nextSlotText(doc, locale, t('extra.noSlotSoon'))}</p>
                      <div className='pd-doctor-actions'>
                        <Link className='pd-doctor-action-link' href={physicianPath(doc.id, doc.name, 'from=dashboard&intent=book')} style={{ color: "var(--link)" }}>{t('bookNow')}</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <div style={{ height: '14px' }} />

          <SectionCard title={t('findAPhysician')} sub={t('extra.subFindPhysician')} action={<Link href='/patient/find-doctor' style={{ fontSize: "13px", color: "var(--link)", fontWeight: 700, textDecoration: 'none' }}>{t('openDiscovery')}</Link>}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className='pd-doctor-carousel'>
                {doctorsLoading ? <p role='status'>{t('loadingPhysicians')}</p> : doctorsError ? <p role='alert'>{t('physiciansCouldNotBeLoaded')} <button onClick={() => setReload(value => value + 1)}>{t('tryAgain')}</button></p> : (recommendedDoctors ?? []).length === 0 && (
                  <EmptyState action={<Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '10px', padding: '0 12px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', fontSize: "13px", fontWeight: 700 }}>{t('openDiscovery2')}</Link>}>
                    {t('noVerifiedPhysiciansAreAvailable')}
                  </EmptyState>
                )}
                {(recommendedDoctors ?? []).map((doc) => (
                  <div key={doc.name} style={{ display: 'grid', gap: '8px' }}>
                    <DoctorCard name={doc.name} specialty={doc.specialty} verification={doc.verification} tags={doc.tags} imageUrl={doc.imageUrl} />
                    <div className='pd-doctor-footer'>
                      <p className='pd-doctor-meta'>⭐ {doc.reviews > 0 ? doc.rating.toFixed(1) : t('extra.noRatings')} · {t('extra.years', { years: doc.experienceYears })} · {nextSlotText(doc, locale, t('extra.noSlotSoon'))}</p>
                      <div className='pd-doctor-actions'>
                        <Link className='pd-doctor-action-link' href={physicianPath(doc.id, doc.name, 'from=dashboard&intent=view')} style={{ color: T.navy }}>{t('viewProfile')}</Link>
                        <Link className='pd-doctor-action-link' href={physicianPath(doc.id, doc.name, 'from=dashboard&intent=book')} style={{ color: "var(--link)" }}>{t('book')}</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          </>}
        </section>

        {!dashboardLoading && !dashboardError && <aside id='patient-secondary-sidebar' className='pd-right'>
          <div className='portal-sidebar-content portal-sidebar-stack'>
            <SectionCard collapsible defaultOpen={todayScheduleItems.length > 0} status={todayScheduleItems.length ? t('extra.todayCount', { count: todayScheduleItems.length }) : t('extra.nothingToday')} title={t('todaySSchedule')} sub={t('extra.subToday')}>
              {todayScheduleItems.length ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {todayScheduleItems.map((item) => (
                    <div key={`${item.title}-${item.time}`} style={{ borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '10px 11px' }}>
                      <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate, lineHeight: 1.45 }}>{item.body}</p>
                      <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{item.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>{t('noScheduleItemsYet')}</EmptyState>
              )}
            </SectionCard>

            <SectionCard title={t('notifications')} sub={t('extra.subNotifications')}>
              <PatientNotifications compact />
            </SectionCard>

            <SectionCard collapsible defaultOpen={false} title={t('careProgress')} sub={t('extra.subProgress')}>
              {careProgress !== null ? (
                <div style={{ borderRadius: '14px', padding: '14px', background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(165,224,218,0.22) 100%)', border: "1px solid var(--border)" }}>
                  <div style={{ marginBottom: '8px', height: '8px', borderRadius: '999px', background: "var(--surface-hover)", overflow: 'hidden' }}>
                    <div style={{ width: `${careProgress}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #20B5DF 0%, var(--primary-end) 100%)' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>Recorded progress averages {careProgress}% across {recordedPlanProgress.length} plan(s). No progress is inferred for other plans.</p>
                </div>
              ) : (
                <EmptyState>{t('noCarePlanProgressYet')}</EmptyState>
              )}
            </SectionCard>

            <SectionCard collapsible defaultOpen={false} title={t('contactYourCareTeam')} sub={t('extra.subContact')}>
              <div style={{ borderRadius: '14px', padding: '14px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{t('messages')}</p>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{t('responsesDependOnYourCare')}</p>
              </div>
            </SectionCard>

            <SectionCard collapsible defaultOpen={false} title={t('primaryActions')} sub={t('extra.subPrimary')}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <Link href={PATIENT_ROUTES.findDoctor} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: '#20B5DF', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.28)' }}>{t('bookNewAppointment')}</Link>
                <Link href={PATIENT_ROUTES.messages} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: "var(--surface-glass)", color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: "1px solid var(--border)" }}>{t('contactCareTeam')}</Link>
                <Link href={PATIENT_ROUTES.medicalRecords} style={{ textDecoration: 'none', minHeight: '36px', borderRadius: '11px', background: "var(--surface-glass)", color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '13px', fontWeight: 700, border: "1px solid var(--border)" }}>{t('viewMedicalRecords')}</Link>
              </div>
            </SectionCard>
          </div>
        </aside>}
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

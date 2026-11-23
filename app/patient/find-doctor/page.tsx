'use client'

import { useTranslations } from 'next-intl'
import { buildBookingQueryParams, CONSULTATION_PRICING_PENDING } from '@/lib/booking'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { getOnboardingRedirectPath, readAuthFlowState } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import {
  LANGUAGE_OPTIONS,
  QUICK_SPECIALTIES,
} from '@/constants/physicians'
import Ico from '@/components/ui/Ico'
import DoctorCard from '@/components/cards/DoctorCard'
import { doctorVerification } from '@/lib/doctor-verification'
import HoverBtn from '@/components/buttons/HoverBtn'
import TrustCard from '@/components/cards/TrustCard'
import { bookingFunding } from '@/lib/booking-funding'
import { searchPatientDoctors, getPatientSettings, getRecommendedDoctors, isAuthError, clearPortalSession, type PatientSettings, type PatientDoctor } from '@/lib/api'
import ProfileImage from '@/components/patient/ProfileImage'
import { physicianPath } from '@/lib/physician-slug'
import { NavLabel } from '@/components/ui/NavLabel'
import { useLabels } from '@/i18n/labels'

function getQuickBookServiceType(
  consultationType: string,
  doctorConsultationTypes: string[]
): string {
  if (consultationType !== 'any') {
    return consultationType
  }
  if (doctorConsultationTypes.includes('video')) {
    return 'video'
  }
  return doctorConsultationTypes[0] || 'video'
}

function buildProfileHref(
  physician: PatientDoctor,
  intent: 'view' | 'book',
  bookingParams: { toString: () => string },
  state: {
    q: string
    specialty: string
    availability: string
    gender: string
    language: string
    experience: string
    consultationType: string
    insurance: string
    rating: string
    price: string
    distance: string
    sort: string
  },
) {
  const preferredService =
    state.consultationType !== 'any'
      ? state.consultationType
      : physician.consultationTypes.includes('video')
      ? 'video'
      : physician.consultationTypes[0]

  const params = new URLSearchParams({
    q: state.q,
    sp: state.specialty,
    av: state.availability,
    g: state.gender,
    l: state.language,
    exp: state.experience,
    ct: state.consultationType,
    ins: state.insurance,
    r: state.rating,
    p: state.price,
    d: state.distance,
    s: state.sort,
    intent,
    from: 'find-doctor',
    svc: preferredService,
  })

  for (const [key, value] of buildBookingQueryParams(bookingParams, null, preferredService)) params.set(key, value)
  params.set('from', 'find-doctor')
  return physicianPath(physician.id, physician.name, params)
}

function buildBookingHref(
  physician: PatientDoctor,
  bookingParams: { toString: () => string },
  state: {
    consultationType: string
    insurance: string
  },
) {
  const serviceType = getQuickBookServiceType(state.consultationType, physician.consultationTypes)
  const params = buildBookingQueryParams(bookingParams, physician, serviceType)
  params.set('from', 'find-doctor')

  return `/patient/consultation-booking/date-time?${params.toString()}`
}


function FindDoctorPageContent() {
  const t = useTranslations('patientFindDoctor')
  const bookingParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const labels = useLabels()
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const [specialty, setSpecialty] = useState<(typeof QUICK_SPECIALTIES)[number]>('All')
  const [availability, setAvailability] = useState<'any' | 'today' | 'tomorrow' | 'this-week'>('any')
  const [gender, setGender] = useState<'any' | 'female' | 'male'>('any')
  const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]>('Any')
  const [experience, setExperience] = useState<'any' | '0-5' | '6-10' | '11+'>('any')
  const [consultationType, setConsultationType] = useState<'any' | 'video' | 'physical'>(() => {
    const service = bookingParams.get('service') ?? bookingParams.get('service_type')
    return service === 'video' || service === 'physical' ? service : 'any'
  })
  // The saved coverage decides bookability (the API re-checks at booking); the
  // old free-text insurer filter matched foreign insurers and is retired.
  const insurance = 'Any'
  const [rating, setRating] = useState<'any' | '4.0' | '4.5' | '4.8'>('any')
  const [price, setPrice] = useState<'any' | 'under-130' | '130-180' | '180+'>('any')
  const [distance, setDistance] = useState<'any' | 'under-5' | 'under-10' | 'under-25'>('any')
  const [sortBy, setSortBy] = useState<'highest-rated' | 'nearest' | 'most-experienced' | 'available-today'>('highest-rated')

  const [physicians, setPhysicians] = useState<PatientDoctor[]>([])
  const [totalDoctors, setTotalDoctors] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAllSpecialties, setShowAllSpecialties] = useState(false)
  const [showFiltersMobile, setShowFiltersMobile] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [userSettings, setUserSettings] = useState<PatientSettings | null>(null)
  const [recommendedDoctors, setRecommendedDoctors] = useState<PatientDoctor[]>([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)
  const pageSize = 8

  const searchSuggestions = useMemo(() => {
    if (!q.trim()) return []
    const needle = q.toLowerCase()
    return physicians
      .filter((p) => {
        const hay = `${p.name} ${p.specialty} ${p.hospital} ${(p.conditions || []).join(' ')}`.toLowerCase()
        return hay.includes(needle)
      })
      .slice(0, 5)
      .map((p) => `${p.name} - ${p.specialty}`)
  }, [physicians, q])

  const filteredPhysicians = physicians
  const coverage = userSettings ? bookingFunding(userSettings.insurance).route : 'SELF_PAY'
  const coverageKey = ({ GKV: 'Gkv', PKV: 'Pkv', SELF_PAY: 'SelfPay' } as const)[coverage]
  // Each criterion that narrows the result, so an empty result can say why and
  // let the patient widen one criterion without starting again.
  const activeFilters = [
    q.trim() && { key: 'q', label: t('filterQuery', { query: q.trim() }), clear: () => { setQ(''); setPage(1) } },
    specialty !== 'All' && { key: 'specialty', label: labels.specialty(specialty), clear: () => { setSpecialty('All'); setPage(1) } },
    availability !== 'any' && { key: 'availability', label: t(availability === 'today' ? 'availableToday' : availability === 'tomorrow' ? 'availableTomorrow' : 'thisWeek'), clear: () => { setAvailability('any'); setPage(1) } },
    consultationType !== 'any' && { key: 'type', label: t(consultationType === 'video' ? 'videoConsultation' : 'physicalVisit'), clear: () => { setConsultationType('any'); setPage(1) } },
    gender !== 'any' && { key: 'gender', label: t(gender), clear: () => { setGender('any'); setPage(1) } },
    language !== 'Any' && { key: 'language', label: labels.language(language), clear: () => { setLanguage('Any'); setPage(1) } },
    experience !== 'any' && { key: 'experience', label: t('experienceFilter', { range: experience }), clear: () => { setExperience('any'); setPage(1) } },
    rating !== 'any' && { key: 'rating', label: t('ratingFilter', { rating }), clear: () => { setRating('any'); setPage(1) } },
    price !== 'any' && { key: 'price', label: t(price === 'under-130' ? 'under130' : price === '130-180' ? 'price130to180' : 'priceOver180'), clear: () => { setPrice('any'); setPage(1) } },
    distance !== 'any' && { key: 'distance', label: t(distance === 'under-5' ? 'under5Km' : distance === 'under-10' ? 'under10Km' : 'under25Km'), clear: () => { setDistance('any'); setPage(1) } },
  ].filter((item): item is { key: string; label: string; clear: () => void } => Boolean(item))

  useEffect(() => {
    const authFlowState = readAuthFlowState()
    if (authFlowState?.isAuthenticated && !authFlowState.onboardingCompleted) {
      router.replace(getOnboardingRedirectPath(authFlowState))
    }
  }, [router])

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const data = await getPatientSettings()
        setUserSettings(data)
      } catch (error) {
        if (isAuthError(error)) {
          clearPortalSession()
          window.location.href = '/auth/sign-in'
          return
        }
        console.error('Failed to load user settings:', error)
      }
    }
    loadUserSettings()
  }, [])

  useEffect(() => {
    const loadRecommendedDoctors = async () => {
      try {
        setRecommendedLoading(true)
        const response = await getRecommendedDoctors()
        setRecommendedDoctors(response.doctors || [])
      } catch (error) {
        if (isAuthError(error)) {
          clearPortalSession()
          window.location.href = '/auth/sign-in'
          return
        }
        console.error('Failed to load recommended doctors:', error)
        setRecommendedDoctors([])
      } finally {
        setRecommendedLoading(false)
      }
    }
    loadRecommendedDoctors()
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (specialty !== 'All') params.set('specialty', specialty)
      if (availability !== 'any') params.set('availability', availability)
      if (gender !== 'any') params.set('gender', gender)
      if (language !== 'Any') params.set('language', language)
      if (experience !== 'any') params.set('experience', experience)
      if (consultationType !== 'any') params.set('consultation_type', consultationType)
      if (rating !== 'any') params.set('rating', rating)
      if (price !== 'any') params.set('price', price)
      if (distance !== 'any') params.set('distance', distance)
      params.set('sort', sortBy)
      // Hide doctors who can't treat this coverage (the API enforces it again at booking).
      if (userSettings) params.set('coverage', bookingFunding(userSettings.insurance).route)
      params.set('page', String(page))
      params.set('page_size', String(pageSize))

      try {
        const response = await searchPatientDoctors(params)
        if (!cancelled) {
          setPhysicians(response.doctors.length ? response.doctors : [])
          setTotalDoctors(response.filtered_count ?? response.total)
          setHasNextPage(Boolean(response.has_next))
          setHasPreviousPage(Boolean(response.has_previous))
          setLoadError('')
        }
      } catch (error) {
        console.error('Failed to load doctors', error)
        if (isAuthError(error)) {
          clearPortalSession()
          window.location.href = '/auth/sign-in'
          return
        }
        if (!cancelled) {
          setHasNextPage(false)
          setHasPreviousPage(false)
          setLoadError('failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, specialty, availability, gender, language, experience, consultationType, rating, price, distance, sortBy, page, reload, userSettings])

  function toggleFavorite(id: string) {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function applySearch(v: string) {
    const trimmed = v.trim()
    setQ(trimmed)
    setPage(1)
    if (!trimmed) return
    setRecentSearches((prev) => [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 5))
  }

  function resetFilters() {
    setQ('')
    setSpecialty('All')
    setAvailability('any')
    setGender('any')
    setLanguage('Any')
    setExperience('any')
    setConsultationType('any')
    setRating('any')
    setPrice('any')
    setDistance('any')
    setSortBy('highest-rated')
    setPage(1)
  }

  const navItems = PATIENT_SIDEBAR_ITEMS

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        .fd-shell { display: grid; grid-template-columns: 260px minmax(0, 1fr) 290px; gap: 18px; max-width: 1480px; margin: 0 auto; padding: 18px; }
        .fd-left, .fd-main, .fd-right { min-width: 0; }

        .fd-content { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 14px; }
        .fd-results { display: grid; gap: 12px; }
        .fd-specialties { display: flex; gap: 8px; flex-wrap: wrap; }
        .fd-head-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; }

        @keyframes fd-shimmer {
          0% { background-position: 220% 0; }
          100% { background-position: -220% 0; }
        }

        @media (max-width: 1280px) {
          .fd-shell { grid-template-columns: 240px minmax(0, 1fr); }
          .fd-right { display: none; }
        }

        @media (max-width: 1024px) {
          .fd-content { grid-template-columns: 1fr; }
          .fd-filter-panel { display: none; }
          .fd-filter-panel.fd-open { display: block; }
        }

        @media (max-width: 920px) {
          .fd-shell { grid-template-columns: 1fr; padding: 0 14px 14px; padding-top: 14px; }
          .fd-left { display: none; }
          .fd-main { order: 1; }
          .fd-head-row { flex-direction: column; align-items: stretch; }
          .fd-search { width: 100% !important; }
        }
      `}</style>

      <div aria-hidden='true' style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.1) 1px, transparent 1.2px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)' }} />

      <div className='fd-shell'>
        <aside id='patient-primary-sidebar' className='fd-left'>
          <div className='fd-sidebar portal-sidebar-content' style={{ background: "var(--surface-glass)", backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', borderRadius: '22px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '16px' }}>
            <section aria-label={t('patientSummary')} style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', border: "1px solid var(--border)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.navy, fontWeight: 700 }}>
                  <ProfileImage name={userSettings ? [userSettings.first_name, userSettings.last_name].filter(Boolean).join(' ') : ''} />
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>
                    {userSettings ? [userSettings.first_name, userSettings.last_name].filter(Boolean).join(' ') : t('loadingName')}
                  </p>
                </div>
              </div>
            </section>

            <nav aria-label={t('patientNavigation')}>
              <div className='fd-nav-list'>
                {navItems.map((item) => {
                  const isActive = isPatientNavActive(pathname, item.href)
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                    style={{
                      width: '100%',
                      minWidth: 'fit-content',
                      textDecoration: 'none',
                      borderRadius: '11px',
                      background: isActive ? 'rgba(32,181,223,0.14)' : 'transparent',
                      color: isActive ? T.link : T.slate,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      transition: 'all 0.15s ease',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                    }}
                    >
                      <Ico p={item.icon} size={15} sw={1.7} color={isActive ? T.blue : T.slate2} />
                      <NavLabel portal='patient' label={item.label} />
                    </Link>
                  )
                })}
              </div>
            </nav>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
              <Link href={PATIENT_ROUTES.logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', textDecoration: 'none', color: "var(--link)", fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={15} sw={1.8} color='#348CEA' />
                {t('logout')}
              </Link>
            </div>
          </div>
        </aside>

        <section className='fd-main' aria-label={t('findADoctor')}>
          <header style={{ ...Glass.nav, borderRadius: '20px', border: "1px solid var(--border)", padding: '14px 14px 12px', marginBottom: '14px' }}>
            <div className='fd-head-row'>
              <div>
                <h1 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '25px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{t('findTheRightDoctor')}</h1>
                <p style={{ margin: '5px 0 0', fontSize: '13px', color: T.slate }}>{t('searchThousandsOfVerifiedHealthcare')}</p>
              </div>
              <button
                type='button'
                onClick={() => setShowFiltersMobile((prev) => !prev)}
                style={{ minHeight: '38px', padding: '0 12px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}
              >
                {showFiltersMobile ? t('hideFilters') : t('showFilters')}
              </button>
            </div>
          </header>

          <section style={{ ...Glass.aiCard, borderRadius: '20px', padding: '16px', marginBottom: '14px', boxShadow: Sh.card }}>
            <label htmlFor='doctor-global-search' style={{ display: 'block', marginBottom: '8px', fontSize: "13px", color: T.slate2, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('globalSearch')}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: q ? "var(--link)" : T.slate2 }}>
                <Ico p={ICONS.search} size={16} sw={1.8} />
              </span>
              <input
                id='doctor-global-search'
                type='search'
                value={q}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch(q)
                }}
                placeholder={t('searchByDoctorNameSpecialty')}
                style={{ width: '100%', minHeight: '52px', borderRadius: '14px', border: `1px solid ${q ? 'rgba(32,181,223,0.45)' : "var(--border)"}`, background: "var(--surface-glass)", color: T.navy, fontSize: '14px', padding: '0 14px 0 44px', textOverflow: 'ellipsis', boxShadow: q ? '0 0 0 4px rgba(32,181,223,0.1)' : 'none', transition: 'all 0.16s ease' }}
              />
            </div>

            {searchFocused && (
              <div style={{ marginTop: '10px', borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-glass)", boxShadow: '0 10px 24px rgba(4,53,77,0.12)', padding: '10px' }}>
                <p style={{ margin: '0 0 6px', fontSize: "13px", color: T.slate2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('recentSearches')}</p>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {(searchSuggestions.length > 0 ? searchSuggestions : recentSearches).map((item) => (
                    <button
                      key={item}
                      type='button'
                      onMouseDown={() => applySearch(item)}
                      style={{ textAlign: 'left', border: 'none', background: 'transparent', color: T.slate, fontSize: '13px', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.slate2, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('quickSpecialties')}</p>
              <button
                type='button'
                onClick={() => setShowAllSpecialties((prev) => !prev)}
                style={{ border: 'none', background: 'transparent', color: "var(--link)", fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}
              >
                {showAllSpecialties ? t('showLess') : t('viewAll')}
              </button>
            </div>
            <div className='fd-specialties'>
              {(showAllSpecialties ? QUICK_SPECIALTIES : QUICK_SPECIALTIES.slice(0, 8)).map((item) => {
                const active = item === specialty
                return (
                  <button
                    key={item}
                    type='button'
                    onClick={() => {
                      setSpecialty(item)
                      setPage(1)
                    }}
                    style={{
                      border: active ? '1px solid rgba(32,181,223,0.45)' : "1px solid var(--border)",
                      background: active ? 'rgba(32,181,223,0.16)' : "var(--surface-glass)",
                      color: active ? T.link : T.slate,
                      borderRadius: '999px',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      fontSize: "13px",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {labels.specialty(item)}
                  </button>
                )
              })}
            </div>
          </section>

          <div className='fd-content'>
            <aside className={`fd-filter-panel ${showFiltersMobile ? 'fd-open' : ''}`}>
              <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 className='portal-h2'>{t('smartFilters')}</h2>
                  <button type='button' onClick={resetFilters} style={{ border: 'none', background: 'transparent', color: "var(--link)", fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}>{t('reset')}</button>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ fontSize: "13px", color: T.slate2 }}>
                    {t('availability')}
                    <select value={availability} onChange={(e) => { setAvailability(e.target.value as typeof availability); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
	                      <option value='any'>{t('any')}</option>
	                      <option value='today'>{t('availableToday')}</option>
	                      <option value='tomorrow'>{t('availableTomorrow')}</option>
	                      <option value='this-week'>{t('thisWeek')}</option>
                    </select>
                  </label>

                  <label style={{ fontSize: "13px", color: T.slate2 }}>
                    {t('consultationType')}
                    <select value={consultationType} onChange={(e) => { setConsultationType(e.target.value as typeof consultationType); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                      <option value='any'>{t('any')}</option>
                      <option value='video'>{t('videoConsultation')}</option>
                      <option value='physical'>{t('physicalVisit')}</option>
                    </select>
                  </label>

                  <button
                    type='button'
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    style={{
                      width: '100%',
                      minHeight: '36px',
                      borderRadius: '9px',
                      border: "1px solid var(--border)",
                      background: showAdvancedFilters ? 'rgba(32,181,223,0.08)' : "var(--surface-glass)",
                      color: showAdvancedFilters ? "var(--link)" : T.navy,
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px',
                    }}
                  >
                    <Ico p={showAdvancedFilters ? ICONS.arrowSm : ICONS.arrowSm} size={12} sw={1.8} color={showAdvancedFilters ? '#348CEA' : T.slate2} style={{ transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                    {showAdvancedFilters ? t('hideAdvancedFilters') : t('showAdvancedFilters')}
                  </button>

                  {showAdvancedFilters && (
                    <div style={{ display: 'grid', gap: '10px', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${T.borderFaint}` }}>
                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('gender')}
                        <select value={gender} onChange={(e) => { setGender(e.target.value as typeof gender); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='any'>{t('any')}</option>
                          <option value='female'>{t('female')}</option>
                          <option value='male'>{t('male')}</option>
                        </select>
                      </label>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('language')}
                        <select value={language} onChange={(e) => { setLanguage(e.target.value as typeof language); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          {LANGUAGE_OPTIONS.map((item) => <option key={item} value={item}>{labels.language(item)}</option>)}
                        </select>
                      </label>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('experience')}
                        <select value={experience} onChange={(e) => { setExperience(e.target.value as typeof experience); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='any'>{t('any')}</option>
                          <option value='0-5'>{t('t05Years')}</option>
                          <option value='6-10'>{t('t610Years')}</option>
                          <option value='11+'>{t('t11Years')}</option>
                        </select>
                      </label>

<p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>
                        {t('coverageShownFor', { coverage: t(`coverage${coverageKey}`) })}{' '}
                        <Link href='/patient/settings?section=insurance#insurance' style={{ color: 'var(--link)', fontWeight: 700 }}>{t('changeCoverage')}</Link>
                      </p>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('rating')}
                        <select value={rating} onChange={(e) => { setRating(e.target.value as typeof rating); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='any'>{t('any')}</option>
                          <option value='4.0'>4.0+</option>
                          <option value='4.5'>4.5+</option>
                          <option value='4.8'>4.8+</option>
                        </select>
                      </label>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('priceRange')}
                        <select value={price} onChange={(e) => { setPrice(e.target.value as typeof price); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='any'>{t('any')}</option>
                          <option value='under-130'>{t('under130')}</option>
                          <option value='130-180'>{t('price130to180')}</option>
                          <option value='180+'>{t('priceOver180')}</option>
                        </select>
                      </label>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('distance')}
                        <select value={distance} onChange={(e) => { setDistance(e.target.value as typeof distance); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='any'>{t('any')}</option>
                          <option value='under-5'>{t('under5Km')}</option>
                          <option value='under-10'>{t('under10Km')}</option>
                          <option value='under-25'>{t('under25Km')}</option>
                        </select>
                      </label>

                      <label style={{ fontSize: "13px", color: T.slate2 }}>
                        {t('sortBy')}
                        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy }}>
                          <option value='highest-rated'>{t('highestRated')}</option>
                          <option value='nearest'>{t('nearest')}</option>
                          <option value='most-experienced'>{t('mostExperienced')}</option>
                          <option value='available-today'>{t('availableToday')}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </section>
            </aside>

            <section>
              {!recommendedLoading && recommendedDoctors.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h2 className='portal-h2'>
                      <span style={{ color: "var(--link)" }}>{t('recommendedForYou')}</span>
                    </h2>
                    <span style={{ fontSize: "13px", color: T.slate2 }}>{t('basedOnYourPreferences')}</span>
                  </div>
                  <div className='fd-results' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {recommendedDoctors.slice(0, 3).map((physician) => (
                      <div key={physician.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-8px', left: '-8px', background: 'linear-gradient(135deg, var(--primary-end) 0%, #20B5DF 100%)', color: '#fff', fontSize: "13px", fontWeight: 700, padding: '4px 10px', borderRadius: '999px', boxShadow: '0 2px 8px rgba(52,140,234,0.3)' }}>
                          {t('recommended')}
                        </div>
                        <DoctorCard
                          name={physician.name}
                          specialty={labels.specialty(physician.specialty)}
                          verification={physician.verification}
                          tags={physician.tags}
                          imageUrl={physician.imageUrl}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 className='portal-h2'>{t('featuredPhysicians')}</h2>
                {!loading && !loadError && <span role='status' style={{ fontSize: "13px", color: T.slate2 }}>{t('doctorsCount', { count: totalDoctors })}</span>}
              </div>
              {loadError && (
                <div role='alert' style={{ marginBottom: '10px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface)', color: T.slate, padding: '14px 16px', fontSize: '14px', display: 'grid', gap: '8px' }}>
                  <strong style={{ color: T.navy }}>{t('loadFailedTitle')}</strong>
                  <span>{t('loadFailedBody')}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button type='button' onClick={() => setReload(value => value + 1)} disabled={loading} style={{ minHeight: 44, padding: '0 14px', borderRadius: '11px', border: 'none', background: 'var(--primary)', color: 'var(--on-primary, #fff)', fontWeight: 700, cursor: 'pointer' }}>{t('retryPhysicianSearch')}</button>
                    <Link href='/patient/help' style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: '11px', border: '1px solid var(--border)', color: T.navy, fontWeight: 700, textDecoration: 'none' }}>{t('getHelp')}</Link>
                  </span>
                </div>
              )}

              <div className='fd-results'>
                {loading ? (
                  [1, 2, 3].map((k) => (
                    <div key={k} style={{ borderRadius: '18px', border: "1px solid var(--border)", background: 'linear-gradient(90deg, rgba(4,53,77,0.06) 0%, rgba(32,181,223,0.12) 50%, rgba(4,53,77,0.06) 100%)', backgroundSize: '220% 100%', animation: 'fd-shimmer 1.2s infinite linear', minHeight: '208px' }} />
                  ))
                ) : loadError ? null : filteredPhysicians.length === 0 ? (
                  <article style={{ borderRadius: '20px', border: "1px solid var(--border)", background: "var(--surface-glass)", boxShadow: Sh.card, padding: '26px', textAlign: 'center' }}>
                    <div style={{ width: '68px', height: '68px', borderRadius: '18px', margin: '0 auto 12px', background: 'rgba(165,224,218,0.35)', border: "1px solid var(--border)", color: "var(--link)", display: 'grid', placeItems: 'center' }}>
                      <Ico p={ICONS.search} size={30} sw={1.6} />
                    </div>
                    <h3 className='portal-h3'>{activeFilters.length ? t('noMatchesTitle') : t('noneBookableTitle')}</h3>
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>
                      {activeFilters.length ? t('noMatchesBody') : t('noneBookableBody', { coverage: t(`coverage${coverageKey}`) })}
                    </p>
                    {activeFilters.length > 0 && (
                      <ul aria-label={t('activeFilters')} style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {activeFilters.map(filter => (
                          <li key={filter.key}>
                            <button type='button' onClick={filter.clear} aria-label={t('removeFilter', { label: filter.label })} style={{ minHeight: 36, padding: '0 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                              {filter.label} ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <HoverBtn
                      base={{
                        minHeight: '42px',
                        padding: '0 14px',
                        borderRadius: '11px',
                        border: 'none',
                        background: '#20B5DF',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(32,181,223,0.3)',
                      }}
                      on={{ background: '#348CEA', transform: 'translateY(-1px)' }}
                      onClick={activeFilters.length ? resetFilters : () => router.push('/patient/settings?section=insurance#insurance')}
                    >
                      {activeFilters.length ? t('resetFilters') : t('changeCoverage')}
                    </HoverBtn>
                  </article>
                ) : (
                  filteredPhysicians.map((doctor) => (
                    <article key={doctor.id} style={{ background: "var(--surface-glass)", borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
	                        <span style={{ ...Glass.chip, color: doctorVerification(doctor.verification).verified ? T.link : T.slate, fontSize: "13px", fontWeight: 700, padding: '4px 9px', borderRadius: '999px' }}>{doctorVerification(doctor.verification).label}</span>
                        <button
                          type='button'
                          onClick={() => toggleFavorite(doctor.id)}
                          aria-label={t('toggleFavorite', { name: doctor.name })} aria-pressed={Boolean(favorites[doctor.id])}
                          style={{ width: '32px', height: '32px', borderRadius: '10px', border: "1px solid var(--border)", background: favorites[doctor.id] ? 'rgba(32,181,223,0.16)' : "var(--surface-glass)", color: favorites[doctor.id] ? "var(--link)" : T.slate2, cursor: 'pointer', transition: 'all 0.16s ease' }}
                        >
                          <Ico p={ICONS.heart} size={15} sw={1.8} />
                        </button>
                      </div>

                      <DoctorCard
                        name={doctor.name}
                        specialty={labels.specialty(doctor.specialty)}
                        verification={doctor.verification}
                        tags={doctor.tags}
                        imageUrl={doctor.imageUrl}
                      />

                      <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('hospital')}</strong> {doctor.hospital}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('experience2')}</strong> {t('yearsCount', { count: doctor.experienceYears })}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('rating2')}</strong> {doctor.reviews > 0 ? t('ratingValue', { rating: doctor.rating.toFixed(1), count: doctor.reviews }) : t('noRatingsYet')}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('nextSlot')}</strong> {doctor.nextAvailable}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('distance2')}</strong> {doctor.distanceKm != null ? `${doctor.distanceKm.toFixed(1)} km` : t('notAvailable')}</p>
                        {doctor.services && doctor.services.length > 0 && (
                          <p style={{ margin: 0, fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('fee')}</strong> {CONSULTATION_PRICING_PENDING}</p>
                        )}
                      </div>

                      {doctor.languages.length > 0 && (
                        <p style={{ margin: '8px 0 0', fontSize: "13px", color: T.slate2 }}>
                          {t('languagesList', { languages: doctor.languages.map(labels.language).join(', ') })}
                        </p>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate2 }}>
                        {t('costStatus')} {t(`cost${coverageKey}`)}
                      </p>

                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href={buildProfileHref(doctor, 'view', bookingParams, { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '11px', textDecoration: 'none', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                          {t('viewProfile')}
                        </Link>
                        <Link href={buildBookingHref(doctor, bookingParams, { consultationType, insurance })} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '11px', textDecoration: 'none', border: 'none', background: '#20B5DF', color: '#fff', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.3)', display: 'inline-flex', alignItems: 'center' }}>
	                          {t('bookNow')}
	                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '14px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{loadError ? t('pageOnly', { page }) : t('pageSummary', { page, shown: filteredPhysicians.length, total: totalDoctors })}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type='button'
                    disabled={!hasPreviousPage || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    style={{ minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: hasPreviousPage && !loading ? 'pointer' : 'not-allowed', opacity: hasPreviousPage && !loading ? 1 : 0.5 }}
                  >
                    {t('previous')}
                  </button>
                  <button
                    type='button'
                    disabled={!hasNextPage || loading}
                    onClick={() => setPage((current) => current + 1)}
                    style={{ minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: hasNextPage && !loading ? 'pointer' : 'not-allowed', opacity: hasNextPage && !loading ? 1 : 0.5 }}
                  >
                    {t('next')}
                  </button>
                </div>
              </div>

              <div style={{ height: '14px' }} />

              <section style={{ background: "var(--surface-glass)", borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
                <h3 className='portal-h3'>{t('trustSignals')}</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <TrustCard label={t('verifiedPhysicians')} sub={t('trustVerifiedSub')} icon={ICONS.check} accent='#20B5DF' />
                  <TrustCard label={t('licensedProfessionals')} sub={t('trustLicensedSub')} icon={ICONS.shield} accent='#348CEA' />
                  <TrustCard label={t('secureConsultations')} sub={t('trustSecureSub')} icon={ICONS.lock} accent='#04354D' />
                  <TrustCard label={t('patientReviewed')} sub={t('trustReviewedSub')} icon={ICONS.heart} accent='#20B5DF' />
                </div>
              </section>
            </section>
          </div>
        </section>

        <aside id='patient-secondary-sidebar' className='fd-right'>
          <div className='portal-sidebar-content portal-sidebar-stack'>
            <section style={{ background: "var(--surface-glass)", borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 className='portal-h3'>{t('searchInsights')}</h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>{t('useSpecialtyPlusConditionTo')}</p>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 className='portal-h3'>{t('savedDoctors')}</h3>
              <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                {Object.entries(favorites).filter(([, val]) => val).length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>{t('tapTheHeartIconOn')}</p>
                ) : (
                  physicians.filter((p) => favorites[p.id]).map((p) => (
                    <Link key={p.id} href={buildProfileHref(p, 'view', bookingParams, { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ textDecoration: 'none', border: "1px solid var(--border)", borderRadius: '11px', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.navy, fontSize: "13px", fontWeight: 600 }}>
                      {p.name}
                      <Ico p={ICONS.arrowSm} size={13} sw={1.8} color={T.slate2} />
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default function FindDoctorPage() {
  const t = useTranslations('patientFindDoctor')
  return <Suspense fallback={<p role='status' className='p-6 text-sm text-muted'>{t('loadingDoctorSelection')}</p>}><FindDoctorPageContent /></Suspense>
}

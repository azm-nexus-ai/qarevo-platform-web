'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { getOnboardingRedirectPath, readAuthFlowState } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import {
  INSURANCE_OPTIONS,
  LANGUAGE_OPTIONS,
  PHYSICIANS,
  QUICK_SPECIALTIES,
} from '@/constants/physicians'
import Ico from '@/components/ui/Ico'
import DoctorCard from '@/components/cards/DoctorCard'
import HoverBtn from '@/components/buttons/HoverBtn'
import TrustCard from '@/components/cards/TrustCard'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { searchPatientDoctors, type PatientDoctor } from '@/lib/api'

function buildProfileHref(
  physician: PatientDoctor,
  intent: 'view' | 'book',
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

  return `/patient/physicians/${physician.id}?${params.toString()}`
}

export default function FindDoctorPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const [recentSearches, setRecentSearches] = useState<string[]>([
    'cardiologist near me',
    'female endocrinologist',
    'virtual dermatology consultation',
  ])

  const [specialty, setSpecialty] = useState<(typeof QUICK_SPECIALTIES)[number]>('All')
  const [availability, setAvailability] = useState<'any' | 'today' | 'this-week'>('any')
  const [gender, setGender] = useState<'any' | 'female' | 'male'>('any')
  const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]>('Any')
  const [experience, setExperience] = useState<'any' | '0-5' | '6-10' | '11+'>('any')
  const [consultationType, setConsultationType] = useState<'any' | 'video' | 'physical'>('any')
  const [insurance, setInsurance] = useState<(typeof INSURANCE_OPTIONS)[number]>('Any')
  const [rating, setRating] = useState<'any' | '4.0' | '4.5' | '4.8'>('any')
  const [price, setPrice] = useState<'any' | 'under-130' | '130-180' | '180+'>('any')
  const [distance, setDistance] = useState<'any' | 'under-5' | 'under-10' | 'under-25'>('any')
  const [sortBy, setSortBy] = useState<'highest-rated' | 'nearest' | 'most-experienced' | 'available-today'>('highest-rated')

  const [physicians, setPhysicians] = useState<PatientDoctor[]>(PHYSICIANS)
  const [totalDoctors, setTotalDoctors] = useState(PHYSICIANS.length)
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAllSpecialties, setShowAllSpecialties] = useState(false)
  const [showFiltersMobile, setShowFiltersMobile] = useState(false)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const pageSize = 8

  const searchSuggestions = useMemo(() => {
    if (!q.trim()) return []
    const needle = q.toLowerCase()
    return physicians
      .filter((p) => {
        const hay = `${p.name} ${p.specialty} ${p.hospital} ${p.conditions.join(' ')}`.toLowerCase()
        return hay.includes(needle)
      })
      .slice(0, 5)
      .map((p) => `${p.name} - ${p.specialty}`)
  }, [physicians, q])

  const filteredPhysicians = useMemo(() => {
    return physicians
  }, [physicians])

  const recommended = useMemo(() => {
    return [...physicians]
      .sort((a, b) => b.rating - a.rating)
      .filter((p) => ['Cardiology', 'General Practice', 'Endocrinology', 'Pediatrics'].includes(p.specialty))
      .slice(0, 4)
  }, [physicians])

  useEffect(() => {
    const authFlowState = readAuthFlowState()
    if (authFlowState?.isAuthenticated && !authFlowState.onboardingCompleted) {
      router.replace(getOnboardingRedirectPath(authFlowState))
    }
  }, [router])

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
      if (insurance !== 'Any') params.set('insurance', insurance)
      if (rating !== 'any') params.set('rating', rating)
      if (price !== 'any') params.set('price', price)
      if (distance !== 'any') params.set('distance', distance)
      params.set('sort', sortBy)
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
        if (!cancelled) {
          setPhysicians(PHYSICIANS)
          setTotalDoctors(PHYSICIANS.length)
          setHasNextPage(false)
          setHasPreviousPage(false)
          setLoadError('Live doctor search is temporarily unavailable, showing saved sample results.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sortBy, page])

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
    setInsurance('Any')
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
        .fd-sidebar { position: sticky; top: 18px; max-height: calc(100vh - 36px); overflow: auto; }
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
        <aside className='fd-left'>
          <div className='fd-sidebar' style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '16px' }}>
            <div style={{ marginBottom: '18px' }}>
              <Link href='/' aria-label='Qarevo Health home' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                <AuthenticatedLogo priority />
              </Link>
            </div>

            <section aria-label='Patient summary' style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', border: '1px solid rgba(4,53,77,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.navy, fontWeight: 700 }}>J</div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>John Adewale</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2 }}>Care Plan: Active</p>
                </div>
              </div>
            </section>

            <nav aria-label='Patient navigation'>
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
                      color: isActive ? T.blue : T.slate,
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
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </nav>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
              <Link href={PATIENT_ROUTES.logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', textDecoration: 'none', color: '#348CEA', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={15} sw={1.8} color='#348CEA' />
                Logout
              </Link>
            </div>
          </div>
        </aside>

        <section className='fd-main' aria-label='Find a doctor'>
          <header style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.82)', padding: '14px 14px 12px', marginBottom: '14px' }}>
            <div className='fd-head-row'>
              <div>
                <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '25px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Find the Right Doctor</h1>
                <p style={{ margin: '5px 0 0', fontSize: '13px', color: T.slate }}>Search thousands of verified healthcare professionals across multiple specialties.</p>
              </div>
              <button
                type='button'
                onClick={() => setShowFiltersMobile((prev) => !prev)}
                style={{ minHeight: '38px', padding: '0 12px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.85)', color: T.navy, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
          </header>

          <section style={{ ...Glass.aiCard, borderRadius: '20px', padding: '16px', marginBottom: '14px', boxShadow: Sh.card }}>
            <label htmlFor='doctor-global-search' style={{ display: 'block', marginBottom: '8px', fontSize: '11.5px', color: T.slate2, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Global Search
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: q ? '#348CEA' : T.slate2 }}>
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
                placeholder='Search by doctor name, specialty, condition or hospital...'
                style={{ width: '100%', minHeight: '52px', borderRadius: '14px', border: `1px solid ${q ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.12)'}`, background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', padding: '0 130px 0 44px', boxShadow: q ? '0 0 0 4px rgba(32,181,223,0.1)' : 'none', transition: 'all 0.16s ease' }}
              />
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type='button' aria-label='Voice search placeholder' style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: 'rgba(255,255,255,0.85)', color: T.slate, cursor: 'pointer' }}>
                  <Ico p={ICONS.activity} size={14} sw={1.8} />
                </button>
                <span style={{ ...Glass.chip, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', color: '#348CEA', fontWeight: 700, letterSpacing: '0.03em' }}>AI Search</span>
              </div>
            </div>

            {searchFocused && (
              <div style={{ marginTop: '10px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.1)', background: 'rgba(255,255,255,0.9)', boxShadow: '0 10px 24px rgba(4,53,77,0.12)', padding: '10px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', color: T.slate2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent searches</p>
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
              <p style={{ margin: 0, fontSize: '12px', color: T.slate2, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Quick Specialties</p>
              <button
                type='button'
                onClick={() => setShowAllSpecialties((prev) => !prev)}
                style={{ border: 'none', background: 'transparent', color: '#348CEA', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                {showAllSpecialties ? 'Show Less' : 'View All'}
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
                      border: active ? '1px solid rgba(32,181,223,0.45)' : '1px solid rgba(4,53,77,0.12)',
                      background: active ? 'rgba(32,181,223,0.16)' : 'rgba(255,255,255,0.8)',
                      color: active ? T.blue : T.slate,
                      borderRadius: '999px',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </section>

          <div className='fd-content'>
            <aside className={`fd-filter-panel ${showFiltersMobile ? 'fd-open' : ''}`}>
              <section style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Smart Filters</h2>
                  <button type='button' onClick={resetFilters} style={{ border: 'none', background: 'transparent', color: '#348CEA', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Reset</button>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Availability
                    <select value={availability} onChange={(e) => { setAvailability(e.target.value as typeof availability); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='today'>Available Today</option>
                      <option value='this-week'>This Week</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Gender
                    <select value={gender} onChange={(e) => { setGender(e.target.value as typeof gender); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='female'>Female</option>
                      <option value='male'>Male</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Language
                    <select value={language} onChange={(e) => { setLanguage(e.target.value as typeof language); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      {LANGUAGE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Experience
                    <select value={experience} onChange={(e) => { setExperience(e.target.value as typeof experience); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='0-5'>0-5 years</option>
                      <option value='6-10'>6-10 years</option>
                      <option value='11+'>11+ years</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Consultation Type
                    <select value={consultationType} onChange={(e) => { setConsultationType(e.target.value as typeof consultationType); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='video'>Video Consultation</option>
                      <option value='physical'>Physical Visit</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Insurance Accepted
                    <select value={insurance} onChange={(e) => { setInsurance(e.target.value as typeof insurance); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      {INSURANCE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Rating
                    <select value={rating} onChange={(e) => { setRating(e.target.value as typeof rating); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='4.0'>4.0+</option>
                      <option value='4.5'>4.5+</option>
                      <option value='4.8'>4.8+</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Price Range
                    <select value={price} onChange={(e) => { setPrice(e.target.value as typeof price); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='under-130'>Under $130</option>
                      <option value='130-180'>$130 - $180</option>
                      <option value='180+'>$180+</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Distance
                    <select value={distance} onChange={(e) => { setDistance(e.target.value as typeof distance); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='any'>Any</option>
                      <option value='under-5'>Under 5 km</option>
                      <option value='under-10'>Under 10 km</option>
                      <option value='under-25'>Under 25 km</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', color: T.slate2 }}>
                    Sort By
                    <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1) }} style={{ width: '100%', marginTop: '4px', minHeight: '36px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.13)', background: '#fff', color: T.navy }}>
                      <option value='highest-rated'>Highest Rated</option>
                      <option value='nearest'>Nearest</option>
                      <option value='most-experienced'>Most Experienced</option>
                      <option value='available-today'>Available Today</option>
                    </select>
                  </label>
                </div>
              </section>
            </aside>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Featured Physicians</h2>
                <span style={{ fontSize: '12px', color: T.slate2 }}>{totalDoctors} doctors</span>
              </div>
              {loadError && (
                <div style={{ marginBottom: '10px', borderRadius: '12px', border: '1px solid rgba(217,119,6,0.22)', background: 'rgba(255,251,235,0.86)', color: T.slate, padding: '10px 12px', fontSize: '12.5px' }}>
                  {loadError}
                </div>
              )}

              <div className='fd-results'>
                {loading ? (
                  [1, 2, 3].map((k) => (
                    <div key={k} style={{ borderRadius: '18px', border: '1px solid rgba(4,53,77,0.09)', background: 'linear-gradient(90deg, rgba(4,53,77,0.06) 0%, rgba(32,181,223,0.12) 50%, rgba(4,53,77,0.06) 100%)', backgroundSize: '220% 100%', animation: 'fd-shimmer 1.2s infinite linear', minHeight: '208px' }} />
                  ))
                ) : filteredPhysicians.length === 0 ? (
                  <article style={{ borderRadius: '20px', border: '1px solid rgba(4,53,77,0.11)', background: 'rgba(255,255,255,0.88)', boxShadow: Sh.card, padding: '26px', textAlign: 'center' }}>
                    <div style={{ width: '68px', height: '68px', borderRadius: '18px', margin: '0 auto 12px', background: 'rgba(165,224,218,0.35)', border: '1px solid rgba(4,53,77,0.08)', color: '#348CEA', display: 'grid', placeItems: 'center' }}>
                      <Ico p={ICONS.search} size={30} sw={1.6} />
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '23px', letterSpacing: '-0.03em', color: T.navy }}>No physicians found.</h3>
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>Try adjusting your filters or searching another specialty.</p>
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
                      onClick={resetFilters}
                    >
                      Reset Filters
                    </HoverBtn>
                  </article>
                ) : (
                  filteredPhysicians.map((doctor) => (
                    <article key={doctor.id} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ ...Glass.chip, color: T.navy, fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '999px' }}>Verified Physician</span>
                        <button
                          type='button'
                          onClick={() => toggleFavorite(doctor.id)}
                          aria-label={`Toggle favorite for ${doctor.name}`}
                          style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: favorites[doctor.id] ? 'rgba(32,181,223,0.16)' : 'rgba(255,255,255,0.8)', color: favorites[doctor.id] ? '#348CEA' : T.slate2, cursor: 'pointer', transition: 'all 0.16s ease' }}
                        >
                          <Ico p={ICONS.heart} size={15} sw={1.8} />
                        </button>
                      </div>

                      <DoctorCard
                        name={doctor.name}
                        specialty={doctor.specialty}
                        verification={doctor.verification}
                        tags={doctor.tags}
                        imageUrl={doctor.imageUrl}
                      />

                      <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Hospital:</strong> {doctor.hospital}</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Experience:</strong> {doctor.experienceYears} years</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Rating:</strong> {doctor.rating.toFixed(1)} ({doctor.reviews} reviews)</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Consultation Fee:</strong> ${doctor.consultationFee}</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Next Slot:</strong> {doctor.nextAvailable}</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Distance:</strong> {doctor.distanceKm.toFixed(1)} km</p>
                      </div>

                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: T.slate2 }}>
                        Languages: {doctor.languages.join(', ')}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2 }}>
                        Insurance: {doctor.insurance.join(', ')}
                      </p>

                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href={buildProfileHref(doctor, 'view', { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '11px', textDecoration: 'none', border: '1px solid rgba(4,53,77,0.14)', background: 'rgba(255,255,255,0.88)', color: T.navy, fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                          View Profile
                        </Link>
                        <Link href={buildProfileHref(doctor, 'book', { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '11px', textDecoration: 'none', border: 'none', background: '#20B5DF', color: '#fff', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.3)', display: 'inline-flex', alignItems: 'center' }}>
                          Book Now
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2 }}>Page {page} · Showing {filteredPhysicians.length} of {totalDoctors}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type='button'
                    disabled={!hasPreviousPage || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    style={{ minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.88)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: hasPreviousPage && !loading ? 'pointer' : 'not-allowed', opacity: hasPreviousPage && !loading ? 1 : 0.5 }}
                  >
                    Previous
                  </button>
                  <button
                    type='button'
                    disabled={!hasNextPage || loading}
                    onClick={() => setPage((current) => current + 1)}
                    style={{ minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.88)', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: hasNextPage && !loading ? 'pointer' : 'not-allowed', opacity: hasNextPage && !loading ? 1 : 0.5 }}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div style={{ height: '14px' }} />

              <section style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '16px' }}>
                <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>Recommended For You</h3>
                <p style={{ margin: '6px 0 12px', fontSize: '13px', color: T.slate }}>Based on your health profile and previous activities.</p>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {recommended.map((doctor) => (
                    <div key={doctor.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.86)' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(165,224,218,0.34)', color: T.blue, display: 'grid', placeItems: 'center' }}>
                          <Ico p={ICONS.steth} size={15} sw={1.8} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doctor.name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>{doctor.specialty} - {doctor.rating.toFixed(1)} rating</p>
                        </div>
                      </div>
                      <Link href={buildProfileHref(doctor, 'view', { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ fontSize: '12px', textDecoration: 'none', color: '#348CEA', fontWeight: 700 }}>
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </section>

              <div style={{ height: '14px' }} />

              <section style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '16px' }}>
                <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>Trust Signals</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <TrustCard label='Verified Physicians' sub='Every doctor is identity-verified.' icon={ICONS.check} accent='#20B5DF' />
                  <TrustCard label='Licensed Professionals' sub='Credentials are clinically reviewed.' icon={ICONS.shield} accent='#348CEA' />
                  <TrustCard label='Secure Consultations' sub='Encrypted and privacy-first sessions.' icon={ICONS.lock} accent='#04354D' />
                  <TrustCard label='Patient Reviewed' sub='Transparent ratings from real patients.' icon={ICONS.heart} accent='#20B5DF' />
                  <TrustCard label='AI-Assisted Matching' sub='Recommendations are context aware.' icon={ICONS.cpu} accent='#A5E0DA' />
                </div>
              </section>
            </section>
          </div>
        </section>

        <aside className='fd-right'>
          <div style={{ position: 'sticky', top: '18px', display: 'grid', gap: '14px' }}>
            <section style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Search Insights</h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>Use specialty plus condition to improve match quality. Example: Cardiology and Hypertension.</p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Saved Doctors</h3>
              <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                {Object.entries(favorites).filter(([, val]) => val).length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>Tap the heart icon on any doctor card to save favorites.</p>
                ) : (
                  physicians.filter((p) => favorites[p.id]).map((p) => (
                    <Link key={p.id} href={buildProfileHref(p, 'view', { q, specialty, availability, gender, language, experience, consultationType, insurance, rating, price, distance, sort: sortBy })} style={{ textDecoration: 'none', border: '1px solid rgba(4,53,77,0.08)', borderRadius: '11px', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.navy, fontSize: '12.5px', fontWeight: 600 }}>
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

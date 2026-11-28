'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams } from '@/lib/booking'
import { getPatientDoctor } from '@/lib/api'
import type { PatientDoctor } from '@/lib/api'
import { ICONS } from '@/constants/icons'
import type { Physician, PhysicianProfileContent } from '@/constants/physicians'
import { nextSlotText } from '@/lib/doctor-slot'
import Ico from '@/components/ui/Ico'
import DoctorAvatar from '@/components/cards/DoctorAvatar'
import { doctorVerification } from '@/lib/doctor-verification'
import { physicianIdFromParam, physicianPath, physicianSlug } from '@/lib/physician-slug'
import PracticeLocation from '@/components/patient/PracticeLocation'

type ReviewSort = 'recent' | 'highest' | 'helpful'

// Helper functions for physician profile logic
function getEffectiveSelectedService(services: PhysicianProfileContent['services'], selectedService: string): string {
  return services.some((service) => service.type === selectedService)
    ? selectedService
    : services[0]?.type ?? 'video'
}

function getEffectiveSelectedDay(slots: PhysicianProfileContent['availabilitySlots'], selectedDay: string): string {
  return slots.some((item) => item.day === selectedDay)
    ? selectedDay
    : slots[0]?.day ?? ''
}

function getSlotsForDay(slots: PhysicianProfileContent['availabilitySlots'], day: string): string[] {
  return slots.find((item) => item.day === day)?.slots ?? []
}

function getEffectiveSelectedSlot(daySlots: string[], selectedSlot: string): string {
  return daySlots.includes(selectedSlot) ? selectedSlot : daySlots[0] ?? ''
}

function sortReviews(reviews: PhysicianProfileContent['reviews'], sort: ReviewSort): PhysicianProfileContent['reviews'] {
  const sorted = [...reviews]
  if (sort === 'highest') {
    sorted.sort((a, b) => b.rating - a.rating)
  } else if (sort === 'helpful') {
    sorted.sort((a, b) => b.helpful - a.helpful)
  }
  return sorted
}

/** Only what the physician or the API supplies is shown: no invented biography, training, career or response time. */
const DEFAULT_PROFILE: PhysicianProfileContent = {
  subSpecialties: [],
  patientsTreated: '',
  consultationsDone: '',
  responseTime: '',
  availabilityStatus: 'limited' as const,
  biography: '',
  specializations: [],
  education: [],
  experienceTimeline: [],
  services: [],
  availabilitySlots: [],
  reviews: [],
  faq: [],
  location: { address: '', directions: '', parking: '', accessibility: '' },
}

function isPhysicianProfileContent(value: unknown): value is PhysicianProfileContent {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<PhysicianProfileContent>
  return Array.isArray(profile.services) && Array.isArray(profile.availabilitySlots)
}

function toPhysician(doctor: PatientDoctor): Physician {
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    experienceYears: doctor.experienceYears,
    rating: doctor.rating,
    reviews: doctor.reviews,
    consultationFee: doctor.consultationFee,
    nextAvailable: doctor.nextAvailable,
    nextAvailableAt: doctor.nextAvailableAt,
    languages: doctor.languages,
    insurance: doctor.insurance,
    gender: doctor.gender === 'male' ? 'male' : 'female',
    consultationTypes: doctor.consultationTypes.filter((type): type is 'video' | 'physical' => type === 'video' || type === 'physical'),
    distanceKm: doctor.distanceKm,
    conditions: doctor.conditions,
    imageUrl: doctor.imageUrl ?? '',
    verification: doctor.verification,
    tags: doctor.tags,
  }
}

function toProfile(doctor: PatientDoctor): PhysicianProfileContent {
  const profile = isPhysicianProfileContent(doctor.profile) ? doctor.profile : DEFAULT_PROFILE
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    services: profile.services,
    availabilitySlots: profile.availabilitySlots,
    reviews: profile.reviews ?? [],
    faq: profile.faq ?? [],
    subSpecialties: profile.subSpecialties?.length ? profile.subSpecialties : [doctor.specialty],
    specializations: profile.specializations?.length ? profile.specializations : doctor.conditions,
    location: { ...DEFAULT_PROFILE.location, ...(profile.location || {}) },
  }
}

function toBookingHref(physician: Physician, serviceType: string, preservedParams: URLSearchParams) {
  const params = buildBookingQueryParams(preservedParams, physician, serviceType)
  params.set('from', 'profile')
  return `/patient/consultation-booking/date-time?${params.toString()}`
}

function formatPhysicianRating(physician: Pick<Physician, 'rating' | 'reviews'>, noRatings: string) {
  return physician.reviews > 0 ? `${physician.rating.toFixed(1)} ★` : noRatings
}

/** Slot days arrive as ISO dates; they are shown as a short weekday and date in the active language. */
function formatDay(day: string, german: boolean) {
  const date = new Date(`${day}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(german ? 'de-DE' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    : day
}

function loadingPhysician(id: string): Physician {
  return {
    id,
    name: '',
    specialty: '',
    hospital: '',
    experienceYears: 0,
    rating: 0,
    reviews: 0,
    consultationFee: 0,
    nextAvailable: '',
    languages: [],
    insurance: [],
    gender: 'female',
    consultationTypes: ['video'],
    distanceKm: 0,
    conditions: [],
    imageUrl: '',
    verification: 'Pending',
    tags: [],
  }
}

function PhysicianProfilePageContent() {
  const t = useTranslations('patientPhysician'), tVerification = useTranslations('doctorVerification')
  const german = useLocale().startsWith('de')
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  // A readable slug (or a bare UUID from an older link) resolves to the provider UUID.
  const physicianId = physicianIdFromParam(params.id)
  const [remoteDoctor, setRemoteDoctor] = useState<PatientDoctor | null>(null)
  const [loadingRemoteDoctor, setLoadingRemoteDoctor] = useState(true)
  const [remoteDoctorError, setRemoteDoctorError] = useState('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [expandedReviewId, setExpandedReviewId] = useState<string>('')
  const [openFaq, setOpenFaq] = useState<string>('')
  const [expandedBiography, setExpandedBiography] = useState(false)
  const [expandedEducation, setExpandedEducation] = useState(false)
  const [expandedExperience, setExpandedExperience] = useState(false)
  const preselectedService = searchParams.get('svc') ?? ''
  const preselectedSlot = searchParams.get('slot') ?? ''

  useEffect(() => {
    let cancelled = false
    if (!physicianId) {
      setRemoteDoctorError('invalidLink')
      setLoadingRemoteDoctor(false)
      return () => { cancelled = true }
    }

    getPatientDoctor(physicianId)
      .then(async (doctor) => {
        if (!cancelled) {
          const loadedProfile = toProfile(doctor)
          const initialService = loadedProfile.services.some((service) => service.type === preselectedService)
            ? preselectedService
            : loadedProfile.services[0]?.type ?? 'video'
          const firstAvailableSlot = loadedProfile.availabilitySlots[0]?.slots[0] ?? ''

          setRemoteDoctor(doctor)
          setSelectedService(initialService)
	          setSelectedDay(loadedProfile.availabilitySlots[0]?.day ?? '')
          setSelectedSlot(preselectedSlot || firstAvailableSlot)
          setExpandedReviewId(loadedProfile.reviews[0]?.id ?? '')
          setOpenFaq(loadedProfile.faq[0]?.q ?? '')

          // Keep one stable, readable address for this physician.
          const canonical = physicianSlug(doctor.id, doctor.name)
          if (params.id !== canonical) {
            // A history replace, not a router navigation: the profile is already loaded and must not refetch.
            window.history.replaceState(window.history.state, '', physicianPath(doctor.id, doctor.name, searchParams.toString()))
          }
        }
      })
      .catch((error) => {
        console.error('Failed to load physician profile:', error)
        if (!cancelled) setRemoteDoctorError('loadFailed')
      })
      .finally(() => {
        if (!cancelled) setLoadingRemoteDoctor(false)
      })

    return () => {
      cancelled = true
    }
    // The canonical replace only changes the name part; it must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicianId, preselectedService, preselectedSlot])

  const physician = remoteDoctor ? toPhysician(remoteDoctor) : loadingPhysician(physicianId ?? "")
  const profile = remoteDoctor ? toProfile(remoteDoctor) : DEFAULT_PROFILE

  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent')
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [faqLoaded, setFaqLoaded] = useState(false)

  const preservedQuery = new URLSearchParams(searchParams.toString())
  preservedQuery.delete('intent')
  preservedQuery.delete('physicianId')
  preservedQuery.delete('service')

  const backToDiscovery = `/patient/find-doctor${preservedQuery.toString() ? `?${preservedQuery.toString()}` : ''}`

  // Helper: Get effective selected service with fallback
  const effectiveSelectedService = getEffectiveSelectedService(profile.services, selectedService)

  // Helper: Get effective selected day with fallback
  const effectiveSelectedDay = getEffectiveSelectedDay(profile.availabilitySlots, selectedDay)

  // Helper: Get slots for selected day
  const selectedDaySlots = getSlotsForDay(profile.availabilitySlots, effectiveSelectedDay)
  const profileSpecialties = Array.from(new Set([physician.specialty, ...profile.subSpecialties].filter(Boolean)))
  const profileSpecialtyLine = profileSpecialties.join(' · ')

  // Helper: Get effective selected slot with fallback
  const effectiveSelectedSlot = getEffectiveSelectedSlot(selectedDaySlots, selectedSlot)

  // Helper: Sort reviews based on sort option
  const sortedReviews = sortReviews(profile.reviews, reviewSort)

  if (loadingRemoteDoctor && !remoteDoctor) {
    return (
      <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'grid', placeItems: 'center', padding: '24px' }}>
        <section style={{ ...Glass.nav, maxWidth: '460px', borderRadius: '18px', padding: '22px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '22px', fontWeight: 800, color: T.navy }}>{t('loadingPhysicianProfile')}</h1>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.slate }}>{t('fetchingTheLatestDoctorDetails')}</p>
        </section>
      </main>
    )
  }

  if (remoteDoctorError && !remoteDoctor) {
    return (
      <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'grid', placeItems: 'center', padding: '24px' }}>
        <section style={{ ...Glass.nav, maxWidth: '460px', borderRadius: '18px', padding: '22px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '22px', fontWeight: 800, color: T.navy }}>{t('physicianUnavailable')}</h1>
          <p style={{ margin: '8px 0 14px', fontSize: '13px', color: T.slate }}>{t(remoteDoctorError)}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/patient/dashboard" style={{ minHeight: '40px', borderRadius: '11px', background: 'rgba(52,140,234,0.1)', color: "var(--link)", textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', fontSize: '13px', fontWeight: 700 }}>
              {t('backToDashboard')}
            </Link>
            <Link href={backToDiscovery} style={{ minHeight: '40px', borderRadius: '11px', background: '#20B5DF', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', fontSize: '13px', fontWeight: 700 }}>
              {t('backToFindADoctor')}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        .pp-shell { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; max-width: 1400px; margin: 0 auto; padding: 18px; }
        .pp-main { display: grid; gap: 14px; }
        .pp-side { position: sticky; top: 18px; align-self: start; }
        .pp-overview-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .pp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pp-service-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .pp-timeline { display: grid; gap: 8px; }

        @media (max-width: 1180px) {
          .pp-shell { grid-template-columns: minmax(0, 1fr); }
          .pp-side { position: static; }
        }

        @media (max-width: 920px) {
          .pp-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pp-two-col { grid-template-columns: 1fr; }
          .pp-service-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 700px) {
          .pp-overview-grid { grid-template-columns: 1fr; }
          .pp-mobile-book { display: flex !important; }
          .pp-side { display: none; }
        }
      `}</style>

      <div aria-hidden='true' style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.1) 1px, transparent 1.2px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)' }} />

      <div className='pp-shell'>
        <section className='pp-main'>
          <header style={{ ...Glass.nav, borderRadius: '20px', border: "1px solid var(--border)", padding: '14px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
              <Link href="/patient/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: "var(--link)", fontSize: '13px', fontWeight: 700 }}>
                <Ico p={ICONS.arrowBack} size={14} sw={1.8} color='#348CEA' />
                {t('backToDashboard')}
              </Link>
              <span style={{ color: 'rgba(52,140,234,0.4)' }}>|</span>
              <Link href={backToDiscovery} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: "var(--link)", fontSize: '13px', fontWeight: 700 }}>
                <Ico p={ICONS.arrowBack} size={14} sw={1.8} color='#348CEA' />
                {t('backToFindADoctor')}
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px minmax(0, 1fr) auto', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '108px', height: '108px', borderRadius: '20px', overflow: 'hidden', border: "1px solid var(--border)", background: 'linear-gradient(135deg, rgba(32,181,223,0.24), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center', color: T.navy, fontSize: '30px', fontWeight: 700, transition: 'transform 0.2s ease' }}>
                <DoctorAvatar name={physician.name} imageUrl={physician.imageUrl} size={108} />
              </div>

              <div>
	                <span style={{ ...Glass.chip, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: "13px", fontWeight: 700, color: doctorVerification(physician.verification).verified ? T.link : T.slate, marginBottom: '8px' }}>
                  {doctorVerification(physician.verification).verified && <Ico p={ICONS.check} size={12} sw={2.4} color={T.link} />}
	                  {tVerification(doctorVerification(physician.verification).key)}
                </span>
                <h1 style={{ margin: '0 0 6px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '30px', fontWeight: 800, letterSpacing: '-0.034em', color: T.navy }}>{physician.name}</h1>
                <p style={{ margin: '0 0 4px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>
                  {profileSpecialtyLine || t('specialtyMissing')}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: T.slate2 }}>
                  {[physician.hospital, physician.experienceYears > 0 ? t('yearsExperience', { years: physician.experienceYears }) : '', physician.languages.join(', ')].filter(Boolean).join(' · ')}
                </p>
                {profile.availabilitySlots.length > 0 && profile.availabilitySlots[0].slots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: "13px", color: T.slate2 }}>{t('nextAvailable')}</span>
                    {profile.availabilitySlots.slice(0, 1).map((day) => (
                      <div key={day.day} style={{ display: 'flex', gap: '4px' }}>
                        {day.slots.slice(0, 3).map((slot) => (
                          <span key={slot} style={{ ...Glass.chip, fontSize: "13px", color: T.link, fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                            {formatDay(day.day, german)} {slot}
                          </span>
                        ))}
                      </div>
                    ))}
                    <Link href="#availability" style={{ fontSize: "13px", color: "var(--link)", fontWeight: 700, textDecoration: 'none' }}>
                      {t('viewAll')}
                    </Link>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <Link href={toBookingHref(physician, effectiveSelectedService, preservedQuery)} style={{ minHeight: '44px', borderRadius: '12px', background: '#20B5DF', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(32,181,223,0.32)' }}>
                  {t('bookNow')}
                </Link>
                {profile.responseTime && <span style={{ fontSize: "13px", color: T.slate2, textAlign: 'center' }}>{t('responseTime', { time: profile.responseTime })}</span>}
              </div>
            </div>
          </header>

          <section className='pp-overview-grid'>
            {[
              { label: t('statRating'), value: formatPhysicianRating(physician, t('noRatings')) },
              { label: t('statPatients'), value: profile.patientsTreated },
              { label: t('statYears'), value: physician.experienceYears > 0 ? `${physician.experienceYears}` : '' },
              { label: t('statConsultations'), value: profile.consultationsDone },
              { label: t('statLanguages'), value: physician.languages.length ? `${physician.languages.length}` : '' },
            ].filter(item => item.value).map((item) => (
              <article key={item.label} style={{ background: "var(--surface-glass)", borderRadius: '14px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '12px' }}>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate2, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</p>
                <p style={{ margin: '7px 0 0', fontSize: '19px', color: T.navy, fontWeight: 800, letterSpacing: '-0.02em' }}>{item.value}</p>
              </article>
            ))}
          </section>

          <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('aboutName', { name: physician.name })}</h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
              {!profile.biography ? t('noBiography') : expandedBiography ? profile.biography : `${profile.biography.slice(0, 150)}${profile.biography.length > 150 ? '…' : ''}`}
            </p>
            {profile.biography.length > 150 && (
              <button
                type='button'
                onClick={() => setExpandedBiography(!expandedBiography)}
                style={{ border: 'none', background: 'transparent', color: "var(--link)", fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '4px', padding: 0 }}
              >
                {expandedBiography ? t('readLess') : t('readMore')}
              </button>
            )}
          </section>

          <section className='pp-two-col'>
            <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('specializations')}</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.specializations.length === 0 && <span style={{ fontSize: '13px', color: T.slate }}>{t('notListed')}</span>}
                {profile.specializations.map((item) => (
                  <span key={item} style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: "13px", color: T.link, fontWeight: 600 }}>{item}</span>
                ))}
              </div>
            </article>

            <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('insuranceAccepted')}</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {physician.insurance.length === 0 && <span style={{ fontSize: '13px', color: T.slate }}>{t('notListed')}</span>}
                {physician.insurance.map((item) => (
                  <span key={item} style={{ borderRadius: '999px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '6px 10px', fontSize: "13px", color: T.navy, fontWeight: 600 }}>{item}</span>
                ))}
              </div>
            </article>
          </section>

          {(profile.education.length > 0 || profile.experienceTimeline.length > 0) && <section className='pp-two-col'>
            {profile.education.length > 0 && <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('education')}</h3>
              <div className='pp-timeline'>
                {(expandedEducation ? profile.education : profile.education.slice(0, 1)).map((item) => (
                  <div key={`${item.title}-${item.period}`} style={{ borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '10px 11px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 2px', fontSize: "13px", color: T.slate }}>{item.org}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{item.period}</p>
                  </div>
                ))}
              </div>
              {profile.education.length > 1 && (
                <button
                  type='button'
                  onClick={() => setExpandedEducation(!expandedEducation)}
                  style={{ border: 'none', background: 'transparent', color: "var(--link)", fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px', padding: 0 }}
                >
                  {expandedEducation ? t('showLess') : t('viewAllCount', { count: profile.education.length })}
                </button>
              )}
            </article>}

            {profile.experienceTimeline.length > 0 && <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('professionalExperience')}</h3>
              <div className='pp-timeline'>
                {(expandedExperience ? profile.experienceTimeline : profile.experienceTimeline.slice(0, 1)).map((item) => (
                  <div key={`${item.title}-${item.period}`} style={{ borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '10px 11px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 2px', fontSize: "13px", color: T.slate }}>{item.org}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{item.period}</p>
                  </div>
                ))}
              </div>
              {profile.experienceTimeline.length > 1 && (
                <button
                  type='button'
                  onClick={() => setExpandedExperience(!expandedExperience)}
                  style={{ border: 'none', background: 'transparent', color: "var(--link)", fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px', padding: 0 }}
                >
                  {expandedExperience ? t('showLess') : t('viewAllCount', { count: profile.experienceTimeline.length })}
                </button>
              )}
            </article>}
          </section>}

          <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('consultationServices')}</h3>
            <div className='pp-service-grid'>
	              {profile.services.length === 0 ? (
	                <div style={{ borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '12px', color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>
	                  {t('thisPhysicianHasNotPublished')}
	                </div>
	              ) : profile.services.map((service) => {
                const active = effectiveSelectedService === service.type
                return (
                  <Link
                    key={service.type}
                    href={toBookingHref(physician, service.type, preservedQuery)}
                    style={{ textAlign: 'left', borderRadius: '14px', border: active ? '1px solid rgba(32,181,223,0.4)' : "1px solid var(--border)", background: active ? 'rgba(32,181,223,0.14)' : "var(--surface-glass)", padding: '12px', cursor: 'pointer', textDecoration: 'none', display: 'block' }}
                  >
                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: T.navy, fontWeight: 700 }}>{service.label}</p>
                    <p style={{ margin: '0 0 2px', fontSize: "13px", color: T.slate }}>{t('pricingPending')}</p>
                    <p style={{ margin: '0 0 2px', fontSize: "13px", color: T.slate }}>{t('duration', { duration: service.duration })}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{t('serviceAvailability', { value: service.availability })}</p>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className='pp-two-col'>
            <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('availability')}</h3>
	              <p style={{ margin: '0 0 8px', fontSize: "13px", color: T.slate2 }}>{t('timezone', { zone: profile.availabilitySlots[0]?.timezone ?? t('notConfigured') })}</p>
	              {profile.availabilitySlots.length === 0 ? (
	                <div style={{ borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '12px', color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>
	                  {t('thisPhysicianHasNotOpened')}
	                </div>
	              ) : (
	                <>
	                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '9px' }}>
	                    {profile.availabilitySlots.map((item) => (
	                      <button
	                        key={item.day}
	                        type='button'
	                        onClick={() => {
	                          setSelectedDay(item.day)
	                          setSelectedSlot(item.slots[0] ?? '')
	                        }}
	                        style={{ borderRadius: '9px', border: effectiveSelectedDay === item.day ? '1px solid rgba(32,181,223,0.4)' : "1px solid var(--border)", background: effectiveSelectedDay === item.day ? 'rgba(32,181,223,0.14)' : "var(--surface-glass)", color: effectiveSelectedDay === item.day ? T.link : T.slate, fontSize: "13px", fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }}
	                      >
	                        {formatDay(item.day, german)}
	                      </button>
	                    ))}
	                  </div>

	                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
	                    {selectedDaySlots.map((slot) => (
	                      <button
	                        key={slot}
	                        type='button'
	                        onClick={() => setSelectedSlot(slot)}
	                        style={{ borderRadius: '10px', border: effectiveSelectedSlot === slot ? '1px solid rgba(32,181,223,0.45)' : "1px solid var(--border)", background: effectiveSelectedSlot === slot ? 'rgba(32,181,223,0.15)' : "var(--surface-glass)", color: effectiveSelectedSlot === slot ? T.link : T.navy, fontSize: "13px", fontWeight: 700, padding: '7px 8px', cursor: 'pointer' }}
	                      >
	                        {slot}
	                      </button>
	                    ))}
	                  </div>
	                </>
	              )}
              {physician.nextAvailable && <p style={{ margin: '9px 0 0', fontSize: "13px", color: T.slate2 }}>{t('nextAppointment', { value: nextSlotText(physician, german ? 'de' : 'en', t('noSlotSoon')) })}</p>}
            </article>

            <article style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('location')}</h3>
              <PracticeLocation name={physician.name} practice={profile.location.practiceName || physician.hospital} address={profile.location.address}
                latitude={profile.location.latitude} longitude={profile.location.longitude} />
            </article>
          </section>

          <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('patientReviews')}</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'recent', label: t('sortRecent') },
                  { id: 'highest', label: t('sortHighest') },
                  { id: 'helpful', label: t('sortHelpful') },
                ].map((item) => (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => {
                      setReviewSort(item.id as ReviewSort)
                      setReviewsLoaded(true)
                    }}
                    style={{ borderRadius: '999px', border: reviewSort === item.id ? '1px solid rgba(32,181,223,0.45)' : "1px solid var(--border)", background: reviewSort === item.id ? 'rgba(32,181,223,0.14)' : "var(--surface-glass)", color: reviewSort === item.id ? T.link : T.slate, fontSize: "13px", fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
	            {profile.reviews.length === 0 ? (
	              <div style={{ width: '100%', padding: '16px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>
	                {t('noPatientReviewsYet')}
	              </div>
	            ) : !reviewsLoaded ? (
              <button
                type='button'
                onClick={() => setReviewsLoaded(true)}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.link, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                {t('loadReviews', { count: profile.reviews.length })}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {sortedReviews.map((review) => {
                  const expanded = expandedReviewId === review.id
                  return (
                    <article key={review.id} style={{ borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", padding: '10px' }}>
                      <button
                        type='button'
                        onClick={() => setExpandedReviewId(expanded ? '' : review.id)}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 700 }}>{review.patient} · {review.rating.toFixed(1)} ★</p>
                          <span style={{ ...Glass.chip, fontSize: "13px", color: T.link, fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>{t('verifiedPatient')}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate2 }}>{t('reviewMeta', { date: review.date, count: review.helpful })}</p>
                        <p style={{ margin: '7px 0 0', fontSize: "13px", color: T.slate, lineHeight: 1.55 }}>
                          {expanded ? review.body : `${review.body.slice(0, 90)}${review.body.length > 90 ? '...' : ''}`}
                        </p>
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {profile.faq.length > 0 && <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('frequentlyAskedQuestions')}</h3>
            {!faqLoaded ? (
              <button
                type='button'
                onClick={() => setFaqLoaded(true)}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.link, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                {t('loadFaq', { count: profile.faq.length })}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {profile.faq.map((item) => {
                  const open = openFaq === item.q
                  return (
                    <article key={item.q} style={{ borderRadius: '12px', border: "1px solid var(--border)", background: open ? 'rgba(32,181,223,0.08)' : "var(--surface-glass)", overflow: 'hidden' }}>
                      <button
                        type='button'
                        onClick={() => setOpenFaq(open ? '' : item.q)}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: '12px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item.q}</p>
                          <span style={{ fontSize: '16px', color: T.slate }}>{open ? '−' : '+'}</span>
                        </div>
                        {open && (
                          <p style={{ margin: '8px 0 0', fontSize: "13px", color: T.slate, lineHeight: 1.55 }}>
                            {item.a}
                          </p>
                        )}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>}

        </section>

        <aside className='pp-side'>
          <section style={{ background: "var(--surface-glass)", borderRadius: '18px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '14px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{t('aboutThisPhysician')}</h3>
            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('doctor')}</strong> {physician.name}</p>
            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('specialty')}</strong> {physician.specialty}</p>
            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('experience')}</strong> {physician.experienceYears > 0 ? t('years', { years: physician.experienceYears }) : t('notListed')}</p>
	            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('rating')}</strong> {formatPhysicianRating(physician, t('noRatings'))}</p>
            <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('languages')}</strong> {physician.languages.join(', ')}</p>
            <p style={{ margin: '0 0 12px', fontSize: "13px", color: T.slate }}><strong style={{ color: T.navy }}>{t('hospital')}</strong> {physician.hospital}</p>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default function PhysicianProfilePage() {
  return (
    <Suspense>
      <PhysicianProfilePageContent />
    </Suspense>
  )
}

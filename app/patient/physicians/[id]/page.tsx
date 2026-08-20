'use client'

import Link from 'next/link'
import { notFound, useParams, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams } from '@/lib/booking'
import { ICONS } from '@/constants/icons'
import { PHYSICIANS, PHYSICIAN_PROFILES } from '@/constants/physicians'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import DoctorCard from '@/components/cards/DoctorCard'

type ReviewSort = 'recent' | 'highest' | 'helpful'

const DEFAULT_PROFILE = {
  subSpecialties: ['Preventive Care', 'Chronic Care'],
  patientsTreated: '1,000+',
  consultationsDone: '800+',
  responseTime: '< 30 mins',
  availabilityStatus: 'available-today' as const,
  biography:
    'This physician delivers evidence-based, patient-centered care with a strong focus on transparency, continuity, and long-term outcomes.',
  specializations: ['General Medicine', 'Preventive Care', 'Telemedicine'],
  education: [
    { title: 'Medical Degree', org: 'Accredited Medical School', period: '2008 - 2012' },
    { title: 'Residency', org: 'Teaching Hospital', period: '2012 - 2015' },
  ],
  experienceTimeline: [
    { title: 'Consultant Physician', org: 'Current Hospital', period: '2021 - Present' },
    { title: 'Attending Physician', org: 'Regional Clinic', period: '2017 - 2021' },
  ],
  services: [
    { type: 'video' as const, label: 'Video Consultation', price: 140, duration: '30 min', availability: 'Today' },
    { type: 'physical' as const, label: 'In-person Consultation', price: 180, duration: '40 min', availability: 'Tomorrow' },
  ],
  availabilitySlots: [
    { day: 'Mon', timezone: 'WAT (UTC+1)', slots: ['10:00', '14:30'] },
    { day: 'Tue', timezone: 'WAT (UTC+1)', slots: ['09:30', '16:00'] },
  ],
  reviews: [
    { id: 'd1', patient: 'Verified Patient', rating: 5, date: 'Jul 28, 2026', helpful: 8, body: 'Great communication and clear treatment plan.' },
  ],
  faq: [
    { q: 'What happens during a video consultation?', a: 'The physician reviews your symptoms, history, and records, then provides a care plan and next steps.' },
  ],
  location: {
    address: 'Qarevo Partner Facility',
    directions: 'Please refer to your appointment confirmation for details.',
    parking: 'On-site visitor parking available.',
    accessibility: 'Accessible entrances and elevators available.',
  },
}

function toBookingHref(physician: (typeof PHYSICIANS)[number], serviceType: string, preservedParams: URLSearchParams) {
  const params = buildBookingQueryParams(preservedParams, physician, serviceType)
  return `/patient/consultation-booking?${params.toString()}`
}

export default function PhysicianProfilePage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const physicianId = params.id
  const physician = PHYSICIANS.find((item) => item.id === physicianId)

  if (!physician) {
    notFound()
  }

  const profile = PHYSICIAN_PROFILES[physician.id] ?? DEFAULT_PROFILE
  const preselectedService = searchParams.get('svc') ?? ''
  const validPreselectedService = profile.services.some((service) => service.type === preselectedService)
    ? preselectedService
    : profile.services[0]?.type ?? 'video'

  const [selectedService, setSelectedService] = useState(validPreselectedService)
  const [selectedDay, setSelectedDay] = useState(profile.availabilitySlots[0]?.day ?? 'Mon')
  const [selectedSlot, setSelectedSlot] = useState(profile.availabilitySlots[0]?.slots[0] ?? '')
  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent')
  const [expandedReviewId, setExpandedReviewId] = useState(profile.reviews[0]?.id ?? '')
  const [openFaq, setOpenFaq] = useState(profile.faq[0]?.q ?? '')

  const preservedQuery = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('intent')
    next.delete('physicianId')
    next.delete('service')
    return next
  }, [searchParams])

  const backToDiscovery = `/patient/find-doctor${preservedQuery.toString() ? `?${preservedQuery.toString()}` : ''}`
  const selectedDaySlots = profile.availabilitySlots.find((item) => item.day === selectedDay)?.slots ?? []

  const sortedReviews = useMemo(() => {
    const next = [...profile.reviews]
    if (reviewSort === 'highest') {
      return next.sort((a, b) => b.rating - a.rating)
    }
    if (reviewSort === 'helpful') {
      return next.sort((a, b) => b.helpful - a.helpful)
    }
    return next
  }, [profile.reviews, reviewSort])

  const relatedPhysicians = useMemo(() => {
    return PHYSICIANS.filter((item) => item.id !== physician.id)
      .filter((item) => item.specialty === physician.specialty || item.tags.some((tag) => physician.tags.includes(tag)))
      .slice(0, 4)
  }, [physician.id, physician.specialty, physician.tags])

  const activeService = profile.services.find((service) => service.type === selectedService) ?? profile.services[0]

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
          <header style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '14px' }}>
            <Link href={backToDiscovery} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#348CEA', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              <Ico p={ICONS.arrowSm} size={14} sw={1.8} color='#348CEA' />
              Back to Find a Doctor
            </Link>
            <div style={{ display: 'grid', gridTemplateColumns: '108px minmax(0, 1fr) auto', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '108px', height: '108px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.24), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center', color: T.navy, fontSize: '30px', fontWeight: 700, transition: 'transform 0.2s ease' }}>
                {physician.name.split(' ').slice(0, 2).map((chunk) => chunk[0]).join('')}
              </div>

              <div>
                <span style={{ ...Glass.chip, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: T.blue, marginBottom: '8px' }}>
                  <Ico p={ICONS.check} size={12} sw={2.4} color={T.blue} />
                  Verified Physician
                </span>
                <h1 style={{ margin: '0 0 6px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, letterSpacing: '-0.034em', color: T.navy }}>{physician.name}</h1>
                <p style={{ margin: '0 0 4px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>
                  {physician.specialty} · {profile.subSpecialties.join(' · ')}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>
                  {physician.hospital} · {physician.experienceYears} years experience · {physician.languages.join(', ')}
                </p>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <Link href={toBookingHref(physician, selectedService, preservedQuery)} style={{ minHeight: '44px', borderRadius: '12px', background: '#20B5DF', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(32,181,223,0.32)' }}>
                  Book Consultation
                </Link>
                <span style={{ fontSize: '11px', color: T.slate2, textAlign: 'center' }}>Response Time: {profile.responseTime}</span>
              </div>
            </div>
          </header>

          <section className='pp-overview-grid'>
            {[
              { label: 'Rating', value: `${physician.rating.toFixed(1)} ★` },
              { label: 'Patients Treated', value: profile.patientsTreated },
              { label: 'Years Experience', value: `${physician.experienceYears}` },
              { label: 'Consultations', value: profile.consultationsDone },
              { label: 'Languages', value: `${physician.languages.length}` },
            ].map((item) => (
              <article key={item.label} style={{ background: 'rgba(255,255,255,0.84)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '12px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: T.slate2, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</p>
                <p style={{ margin: '7px 0 0', fontSize: '19px', color: T.navy, fontWeight: 800, letterSpacing: '-0.02em' }}>{item.value}</p>
              </article>
            ))}
          </section>

          <section style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>About Dr. {physician.name.replace('Dr. ', '')}</h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>{profile.biography}</p>
          </section>

          <section className='pp-two-col'>
            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Specializations</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.specializations.map((item) => (
                  <span key={item} style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '12px', color: T.blue, fontWeight: 600 }}>{item}</span>
                ))}
              </div>
            </article>

            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Insurance Accepted</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {physician.insurance.map((item) => (
                  <span key={item} style={{ borderRadius: '999px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.84)', padding: '6px 10px', fontSize: '12px', color: T.navy, fontWeight: 600 }}>{item}</span>
                ))}
              </div>
            </article>
          </section>

          <section className='pp-two-col'>
            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Education</h3>
              <div className='pp-timeline'>
                {profile.education.map((item) => (
                  <div key={`${item.title}-${item.period}`} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.09)', background: 'rgba(255,255,255,0.84)', padding: '10px 11px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: T.slate }}>{item.org}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.period}</p>
                  </div>
                ))}
              </div>
            </article>

            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Professional Experience</h3>
              <div className='pp-timeline'>
                {profile.experienceTimeline.map((item) => (
                  <div key={`${item.title}-${item.period}`} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.09)', background: 'rgba(255,255,255,0.84)', padding: '10px 11px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: T.slate }}>{item.org}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate2 }}>{item.period}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Consultation Services</h3>
            <div className='pp-service-grid'>
              {profile.services.map((service) => {
                const active = selectedService === service.type
                return (
                  <button
                    key={service.type}
                    type='button'
                    onClick={() => setSelectedService(service.type)}
                    style={{ textAlign: 'left', borderRadius: '14px', border: active ? '1px solid rgba(32,181,223,0.4)' : '1px solid rgba(4,53,77,0.1)', background: active ? 'rgba(32,181,223,0.14)' : 'rgba(255,255,255,0.84)', padding: '12px', cursor: 'pointer' }}
                  >
                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: T.navy, fontWeight: 700 }}>{service.label}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: T.slate }}>Price: ${service.price}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: T.slate }}>Duration: {service.duration}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>Availability: {service.availability}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className='pp-two-col'>
            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Availability</h3>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: T.slate2 }}>Timezone: {profile.availabilitySlots[0]?.timezone ?? 'WAT (UTC+1)'}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '9px' }}>
                {profile.availabilitySlots.map((item) => (
                  <button
                    key={item.day}
                    type='button'
                    onClick={() => {
                      setSelectedDay(item.day)
                      setSelectedSlot(item.slots[0] ?? '')
                    }}
                    style={{ borderRadius: '9px', border: selectedDay === item.day ? '1px solid rgba(32,181,223,0.4)' : '1px solid rgba(4,53,77,0.1)', background: selectedDay === item.day ? 'rgba(32,181,223,0.14)' : 'rgba(255,255,255,0.86)', color: selectedDay === item.day ? T.blue : T.slate, fontSize: '12px', fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {item.day}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {selectedDaySlots.map((slot) => (
                  <button
                    key={slot}
                    type='button'
                    onClick={() => setSelectedSlot(slot)}
                    style={{ borderRadius: '10px', border: selectedSlot === slot ? '1px solid rgba(32,181,223,0.45)' : '1px solid rgba(4,53,77,0.1)', background: selectedSlot === slot ? 'rgba(32,181,223,0.15)' : 'rgba(255,255,255,0.84)', color: selectedSlot === slot ? T.blue : T.navy, fontSize: '12px', fontWeight: 700, padding: '7px 8px', cursor: 'pointer' }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <p style={{ margin: '9px 0 0', fontSize: '12px', color: T.slate2 }}>Next available appointment: {physician.nextAvailable}</p>
            </article>

            <article style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Location</h3>
              <div style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.1)', background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(165,224,218,0.18) 100%)', minHeight: '160px', display: 'grid', placeItems: 'center', color: T.slate2, fontSize: '12px', marginBottom: '10px' }}>
                Interactive map placeholder
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Address:</strong> {profile.location.address}</p>
              <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Directions:</strong> {profile.location.directions}</p>
              <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Parking:</strong> {profile.location.parking}</p>
              <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Accessibility:</strong> {profile.location.accessibility}</p>
            </article>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Patient Reviews</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'recent', label: 'Most Recent' },
                  { id: 'highest', label: 'Highest Rated' },
                  { id: 'helpful', label: 'Most Helpful' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => setReviewSort(item.id as ReviewSort)}
                    style={{ borderRadius: '999px', border: reviewSort === item.id ? '1px solid rgba(32,181,223,0.45)' : '1px solid rgba(4,53,77,0.1)', background: reviewSort === item.id ? 'rgba(32,181,223,0.14)' : 'rgba(255,255,255,0.84)', color: reviewSort === item.id ? T.blue : T.slate, fontSize: '11px', fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {sortedReviews.map((review) => {
                const expanded = expandedReviewId === review.id
                return (
                  <article key={review.id} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.09)', background: 'rgba(255,255,255,0.84)', padding: '10px' }}>
                    <button
                      type='button'
                      onClick={() => setExpandedReviewId(expanded ? '' : review.id)}
                      style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 700 }}>{review.patient} · {review.rating.toFixed(1)} ★</p>
                        <span style={{ ...Glass.chip, fontSize: '10.5px', color: T.blue, fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>Verified Patient</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.slate2 }}>{review.date} · Helpful {review.helpful}</p>
                      <p style={{ margin: '7px 0 0', fontSize: '12.5px', color: T.slate, lineHeight: 1.55 }}>
                        {expanded ? review.body : `${review.body.slice(0, 90)}${review.body.length > 90 ? '...' : ''}`}
                      </p>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Frequently Asked Questions</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {profile.faq.map((item) => {
                const open = openFaq === item.q
                return (
                  <article key={item.q} style={{ borderRadius: '12px', border: '1px solid rgba(4,53,77,0.09)', background: open ? 'rgba(32,181,223,0.08)' : 'rgba(255,255,255,0.84)', overflow: 'hidden' }}>
                    <button
                      type='button'
                      onClick={() => setOpenFaq(open ? '' : item.q)}
                      style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: '11px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.q}</span>
                      <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={open ? T.blue : T.slate2} />
                    </button>
                    {open && <p style={{ margin: '0 12px 11px', fontSize: '12.5px', color: T.slate, lineHeight: 1.6 }}>{item.a}</p>}
                  </article>
                )
              })}
            </div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.86)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.86)', boxShadow: Sh.card, padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Related Physicians</h3>
            <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(320px, 1fr)', gap: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
              {relatedPhysicians.map((item) => (
                <div key={item.id} style={{ display: 'grid', gap: '8px' }}>
                  <DoctorCard name={item.name} specialty={item.specialty} verification={item.verification} tags={item.tags} imageUrl={item.imageUrl} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>{item.rating.toFixed(1)} ★ · {item.experienceYears} yrs</p>
                    <Link href={`/patient/physicians/${item.id}${preservedQuery.toString() ? `?${preservedQuery.toString()}` : ''}`} style={{ fontSize: '12px', color: '#348CEA', fontWeight: 700, textDecoration: 'none' }}>
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className='pp-side'>
          <section style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.88)', boxShadow: Sh.float, padding: '14px' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Book Instantly</h3>
            <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Doctor:</strong> {physician.name}</p>
            <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Service:</strong> {activeService?.label}</p>
            <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Next Slot:</strong> {selectedDay} {selectedSlot ? `at ${selectedSlot}` : ''}</p>
            <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: T.slate }}><strong style={{ color: T.navy }}>Fee:</strong> ${activeService?.price}</p>

            <Link href={toBookingHref(physician, selectedService, preservedQuery)} style={{ minHeight: '42px', borderRadius: '11px', background: '#20B5DF', color: '#fff', textDecoration: 'none', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.3)', marginBottom: '8px' }}>
              Book Consultation
            </Link>

            <HoverBtn
              base={{
                width: '100%',
                minHeight: '42px',
                borderRadius: '11px',
                border: '1px solid rgba(4,53,77,0.14)',
                background: 'rgba(255,255,255,0.88)',
                color: T.navy,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              on={{ background: 'rgba(255,255,255,0.98)' }}
            >
              Message Physician
            </HoverBtn>
          </section>
        </aside>
      </div>

      <div className='pp-mobile-book' style={{ display: 'none', position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: 50, padding: '10px', background: 'rgba(247,250,252,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: '1px solid rgba(255,255,255,0.84)', boxShadow: '0 -8px 20px rgba(4,53,77,0.1)' }}>
        <Link href={toBookingHref(physician, selectedService, preservedQuery)} style={{ minHeight: '46px', width: '100%', borderRadius: '12px', background: '#20B5DF', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.32)' }}>
          Book Consultation - ${activeService?.price}
        </Link>
      </div>
    </main>
  )
}

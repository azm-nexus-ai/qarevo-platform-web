'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PAGE_BG, T, Sh, Glass } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { PHYSICIANS, PHYSICIAN_PROFILES } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

const progressSteps = ['Doctor Selected', 'Consultation Type', 'Schedule', 'Review', 'Confirmation']

function normalizeService(value: string | null) {
  if (value === 'physical' || value === 'follow-up') return value
  return 'video'
}

function formatFee(value: number) {
  return `$${value}`
}

function ConsultationBookingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? ''
  const initialService = normalizeService(searchParams.get('service'))
  const returning = searchParams.get('returning') === '1'

  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const profile = physician ? PHYSICIAN_PROFILES[physician.id] : undefined
  const physicianData = useMemo(() => getBookingPhysician(searchParams, physician), [searchParams, physician])
  const [selectedType, setSelectedType] = useState(initialService)

  useEffect(() => {
    setSelectedType(initialService)
  }, [initialService])

  const preservedParams = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, null)
    next.delete('service')
    return next
  }, [searchParams, physicianData])

  const backToProfile = physicianData.id
    ? `/patient/physicians/${physicianData.id}${preservedParams.toString() ? `?${preservedParams.toString()}` : ''}`
    : '/patient/find-doctor'

  const showFollowUp = Boolean(profile?.services.some((service) => service.type === 'follow-up')) || returning
  const selectedMeta = useMemo(() => {
    const fromProfile = profile?.services.find((service) => service.type === selectedType)
    if (fromProfile) {
      return fromProfile
    }

    return {
      type: selectedType as 'video' | 'physical' | 'follow-up',
      label: selectedType === 'physical' ? 'In-person Consultation' : selectedType === 'follow-up' ? 'Follow-up Consultation' : 'Video Consultation',
      price: physician?.consultationFee ?? 140,
      duration: selectedType === 'physical' ? '45 min' : selectedType === 'follow-up' ? '20 min' : '30 min',
      availability: selectedType === 'physical' ? 'Tomorrow' : selectedType === 'follow-up' ? 'Today' : 'Today',
    }
  }, [profile, physician, selectedType])

  const serviceCards = useMemo(() => {
    const base: Array<{
      key: 'video' | 'physical' | 'follow-up'
      title: string
      subtitle: string
      badge: string
      price: number
      duration: string
      availability: string
      points: string[]
      details: string[]
      travel: string
      waiting: string
      prescription: string
      exam: string
      privacy: string
      convenience: string
    }> = [
      {
        key: 'video' as const,
        title: 'Video Consultation',
        subtitle: 'HD secure video call',
        badge: 'Recommended',
        price: physician?.consultationFee ?? 140,
        duration: '30 min',
        availability: 'Today available',
        points: ['Meet from anywhere', 'Digital prescription support', 'Upload medical documents'],
        details: ['No travel required', 'Fast setup', 'Secure private care'],
        travel: 'None',
        waiting: 'Minimal',
        prescription: 'Digital support',
        exam: 'Clinical review',
        privacy: 'Private',
        convenience: 'Highest',
      },
      {
        key: 'physical' as const,
        title: 'In-Person Consultation',
        subtitle: 'Hospital visit with hands-on care',
        badge: 'Best for exams',
        price: (physician?.consultationFee ?? 140) + 40,
        duration: '45 min',
        availability: 'Tomorrow available',
        points: ['Physical examination', 'Diagnostic procedures', 'Face-to-face guidance'],
        details: ['On-site care', 'In-person diagnostics', 'Flexible follow-up'],
        travel: 'Required',
        waiting: 'Moderate',
        prescription: 'Immediate',
        exam: 'Hands-on',
        privacy: 'Clinical setting',
        convenience: 'Moderate',
      },
    ]

    if (showFollowUp) {
      base.push({
        key: 'follow-up' as const,
        title: 'Follow-up Consultation',
        subtitle: 'Existing patient care review',
        badge: 'Returning patient',
        price: Math.max((physician?.consultationFee ?? 140) - 30, 90),
        duration: '20 min',
        availability: 'Today available',
        points: ['Medication review', 'Progress discussion', 'Shorter check-in'],
        details: ['Fast follow-up', 'Continuity of care', 'Simple reassessment'],
        travel: 'None',
        waiting: 'Very low',
        prescription: 'Refill support',
        exam: 'Summary review',
        privacy: 'Private',
        convenience: 'Very high',
      })
    }

    return base
  }, [physician, showFollowUp])

  const continueHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, selectedType)
    next.set('fee', String(selectedMeta.price))
    next.set('duration', selectedMeta.duration)
    next.set('insurance', physicianData.insurance.slice(0, 2).join(',') || 'Axa')
    return `/patient/consultation-booking/date-time?${next.toString()}`
  }, [searchParams, selectedMeta.duration, selectedMeta.price, selectedType, physicianData])

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1420px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <style>{`
          * { box-sizing: border-box; }
          .booking-shell { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
          .booking-card { background: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.94); border-radius: 24px; box-shadow: ${Sh.float}; }
          .booking-option { transition: all 0.2s ease; cursor: pointer; }
          .booking-option:hover { transform: translateY(-2px); box-shadow: ${Sh.glow}; }
          .booking-option:focus-visible { outline: 2px solid ${T.blue}; outline-offset: 2px; }
          .progress-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(32,181,223,0.08); border: 1px solid rgba(32,181,223,0.16); color: ${T.blue}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
          .progress-step { display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${T.slate2}; }
          .progress-step.active { color: ${T.blue}; font-weight: 700; }
          .progress-step.done { color: ${T.green}; font-weight: 700; }
          @media (max-width: 1160px) {
            .booking-shell { grid-template-columns: 1fr; }
          }
          @media (max-width: 700px) {
            .booking-card { border-radius: 20px; }
          }
        `}</style>

        <div className='booking-shell'>
          <section style={{ display: 'grid', gap: '14px' }}>
            <header className='booking-card' style={{ padding: '22px 22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} className='progress-pill'>
                  <Ico p={ICONS.check} size={11} sw={2.4} color={T.blue} />
                  Booking Progress
                </div>
                <Link href={backToProfile} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: T.blue, fontSize: '13px', fontWeight: 700 }}>
                  <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={T.blue} />
                  Back to Physician Profile
                </Link>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {progressSteps.map((step, index) => {
                  const done = index < 1
                  const active = index === 1
                  return (
                    <div key={step} className={`progress-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: done ? T.greenLight : active ? T.blueLight : 'rgba(4,53,77,0.06)', color: done ? T.green : active ? T.blue : T.slate2, border: `1px solid ${done ? 'rgba(9,173,112,0.24)' : active ? 'rgba(32,181,223,0.24)' : 'rgba(4,53,77,0.1)'}` }}>
                        {done ? <Ico p={ICONS.check} size={10} sw={2.8} color={T.green} /> : index + 1}
                      </span>
                      {step}
                    </div>
                  )
                })}
              </div>

              <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Choose Your Consultation</h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
                Select how you would like to meet with your healthcare provider. You can choose between virtual or in-person consultations depending on availability.
              </p>
            </header>

            <section className='booking-card' style={{ padding: '18px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.18)', marginBottom: '8px' }}>
                    <Ico p={ICONS.check} size={11} sw={2.4} color={T.blue} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: T.blue, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Verified Physician</span>
                  </div>
                  <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>
                    {physicianData.name}
                  </h2>
                  <p style={{ margin: '0 0 6px', fontSize: '13.5px', color: T.slate, lineHeight: 1.6 }}>
                    {physicianData.specialty} · {physicianData.hospital}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physicianData.experienceYears} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.steth} size={12} sw={1.75} color={T.blue} />{physicianData.rating.toFixed(1)} rating</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{formatFee(physicianData.consultationFee)} consultation fee</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ display: 'grid', gap: '10px' }}>
              {serviceCards.map((option) => {
                const active = selectedType === option.key
                return (
                  <button
                    key={option.key}
                    type='button'
                    onClick={() => setSelectedType(option.key)}
                    className='booking-option'
                    style={{
                      textAlign: 'left',
                      borderRadius: '20px',
                      padding: '16px 16px 14px',
                      border: active ? '1px solid rgba(32,181,223,0.44)' : '1px solid rgba(4,53,77,0.1)',
                      background: active ? 'linear-gradient(135deg, rgba(232,248,252,0.96) 0%, rgba(255,255,255,0.94) 100%)' : 'rgba(255,255,255,0.86)',
                      boxShadow: active ? Sh.glow : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 10px rgba(4,53,77,0.05)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '999px', background: active ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.04)', color: active ? T.blue : T.slate2, fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                          <Ico p={ICONS.check} size={10} sw={2.4} color={active ? T.blue : T.slate2} />
                          {option.badge}
                        </div>
                        <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{option.title}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{option.subtitle}</p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '84px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: T.navy }}>{formatFee(option.price)}</div>
                        <div style={{ fontSize: '12px', color: T.slate2, marginTop: '2px' }}>{option.duration}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {option.points.map((point) => (
                        <span key={point} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 9px', borderRadius: '999px', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(4,53,77,0.08)', color: T.slate, fontSize: '12px', fontWeight: 600 }}>
                          <Ico p={ICONS.check} size={10} sw={2.4} color={T.green} />
                          {point}
                        </span>
                      ))}
                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: T.slate2 }}>Availability: {option.availability}</p>
                  </button>
                )
              })}
            </section>

            <section className='booking-card' style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Compare Consultation Types</h3>
                <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 600 }}>At a glance</span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Travel Required', 'None', 'Required', 'None'],
                  ['Waiting Time', 'Minimal', 'Moderate', 'Very low'],
                  ['Prescription', 'Digital support', 'Immediate', 'Refill support'],
                  ['Medical Examination', 'Clinical review', 'Hands-on', 'Summary review'],
                  ['Privacy', 'Private', 'Clinical setting', 'Private'],
                  ['Convenience', 'Highest', 'Moderate', 'Very high'],
                  ['Availability', 'Today', 'Tomorrow', 'Today'],
                  ['Duration', '30 min', '45 min', '20 min'],
                ].map(([label, video, physical, followUp]) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px 110px', gap: '8px', alignItems: 'center', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12.5px', color: T.slate, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.slate2, textAlign: 'center' }}>{video}</span>
                    <span style={{ fontSize: '12px', color: T.slate2, textAlign: 'center' }}>{physical}</span>
                    <span style={{ fontSize: '12px', color: T.slate2, textAlign: 'center' }}>{showFollowUp ? followUp : '—'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='booking-card' style={{ padding: '18px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Consultation Preparation</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  'Prepare your medical history and symptoms before the visit.',
                  'Upload relevant reports or recent test results for faster review.',
                  'Ensure a stable internet connection for video consultations.',
                  'Keep your insurance details and ID handy for verification.',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.74)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                    <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='booking-card' style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Insurance Information</h3>
                <span style={{ padding: '6px 10px', borderRadius: '999px', background: 'rgba(165,224,218,0.3)', color: T.teal, fontSize: '12px', fontWeight: 700 }}>Accepted Insurance</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {physicianData.insurance.map((item) => (
                  <span key={item} style={{ padding: '7px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.08)', color: T.navy, fontSize: '12px', fontWeight: 700 }}>{item}</span>
                ))}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>Coverage summary is available at checkout. Self-pay is also available for eligible appointments.</p>
              <Link href='/support' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: T.blue, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>Learn More <Ico p={ICONS.arrowFwd} size={12} sw={2} color={T.blue} /></Link>
            </section>

            <section className='booking-card' style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                {[
                  'Secure End-to-End Consultations',
                  'Licensed Physicians',
                  'HIPAA / GDPR Compliance',
                  'Encrypted Health Records',
                  'Private Communication',
                ].map((item) => (
                  <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)', color: T.blue, fontSize: '12px', fontWeight: 600 }}>
                    <Ico p={ICONS.shield} size={11} sw={1.75} color={T.blue} />
                    {item}
                  </span>
                ))}
              </div>
            </section>
          </section>

          <aside style={{ position: 'sticky', top: '18px', display: 'grid', gap: '14px' }}>
            <section className='booking-card' style={{ padding: '18px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking Summary</p>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{physicianData.name}</h3>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Selected Type</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{selectedMeta.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Estimated Duration</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{selectedMeta.duration}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Consultation Fee</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{formatFee(selectedMeta.price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Insurance Status</span>
                  <span style={{ fontSize: '12px', color: T.green, fontWeight: 700 }}>Covered</span>
                </div>
              </div>

              <HoverBtn
                onClick={() => router.push(continueHref)}
                base={{
                  width: '100%',
                  minHeight: '46px',
                  borderRadius: '13px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(32,181,223,0.28)',
                }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 18px rgba(32,181,223,0.28)' }}
              >
                Continue to Schedule
                <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
              </HoverBtn>

              <Link href={backToProfile} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', color: T.slate2, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
                Back to Physician Profile
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function ConsultationBookingPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1420px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Loading consultation options</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Preparing your booking experience</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>We are bringing over your physician and consultation details.</p>
        </div>
      </div>
    </main>
  )
}

export default function ConsultationBookingPage() {
  return (
    <Suspense fallback={<ConsultationBookingPageFallback />}>
      <ConsultationBookingPageContent />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

type AgreementKey = 'info' | 'terms' | 'privacy' | 'policy'

function formatFee(value: number) {
  return `$${value}`
}

function readLabel(service: string | null) {
  switch (service) {
    case 'physical':
      return 'In-person Consultation'
    case 'follow-up':
      return 'Follow-up Consultation'
    default:
      return 'Video Consultation'
  }
}

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const physicianData = useMemo(() => getBookingPhysician(searchParams, physician), [searchParams, physician])
  const service = searchParams.get('service') ?? 'video'
  const fee = Number(searchParams.get('fee') ?? physician?.consultationFee ?? 140)
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const notes = searchParams.get('notes') ?? ''
  const patientName = 'A. Bello'
  const email = 'abello@qarevo.health'
  const phone = '+234 805 000 0000'
  const emergencyContact = 'M. Bamidele · +234 810 123 4567'
  const medicalConcern = 'Cardiovascular review and medication follow-up'

  const [agreements, setAgreements] = useState<Record<AgreementKey, boolean>>({
    info: false,
    terms: false,
    privacy: false,
    policy: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)

  const appointmentEnd = useMemo(() => {
    const parts = duration.match(/(\d+)/)
    const minutes = parts ? Number(parts[1]) : 30
    const start = new Date('2026-01-01T09:00:00')
    start.setMinutes(start.getMinutes() + minutes)
    return start.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
  }, [duration])

  const allAgreed = agreements.info && agreements.terms && agreements.privacy && agreements.policy

  const successHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    next.set('date', date)
    next.set('slot', slot)
    next.set('notes', notes)
    return `/patient/consultation-booking/success?${next.toString()}`
  }, [date, notes, searchParams, physicianData, service, slot])

  const backHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return `/patient/consultation-booking/date-time?${next.toString()}`
  }, [searchParams, physicianData, service])

  const editHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return `/patient/consultation-booking/date-time?${next.toString()}`
  }, [searchParams, physicianData, service])

  const handleConfirm = () => {
    if (!allAgreed) return
    setIsSubmitting(true)
    window.setTimeout(() => {
      router.push(successHref)
    }, 1200)
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1460px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '280px minmax(0, 1fr) 340px', alignItems: 'start' }}>
          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booking Progress</p>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Doctor Selected', 'Consultation Type', 'Date & Time', 'Review', 'Confirmation'].map((step, index) => {
                  const completed = index < 3
                  const active = index === 3
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: active ? 'rgba(32,181,223,0.08)' : completed ? 'rgba(15,158,119,0.08)' : 'rgba(255,255,255,0.7)', border: `1px solid ${active ? 'rgba(32,181,223,0.16)' : completed ? 'rgba(15,158,119,0.16)' : 'rgba(4,53,77,0.08)'}` }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: completed ? T.greenLight : active ? T.blueLight : 'rgba(255,255,255,0.8)', color: completed ? T.green : active ? T.blue : T.slate2, fontSize: '11px', fontWeight: 700 }}>
                        {completed ? <Ico p={ICONS.check} size={10} sw={2.2} color={T.green} /> : index + 1}
                      </span>
                      <span style={{ fontSize: '12px', color: active ? T.navy : T.slate, fontWeight: active ? 700 : 600 }}>{step}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section style={{ ...Glass.pill, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                <Ico p={ICONS.lock} size={11} sw={2.2} color={T.blue} />
                Protected review
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{physicianData.name}</h2>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
              <div style={{ display: 'grid', gap: '7px', fontSize: '12px', color: T.slate2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Consultation</span><strong style={{ color: T.navy }}>{readLabel(service)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Date</span><strong style={{ color: T.navy }}>{date}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Time</span><strong style={{ color: T.navy }}>{slot}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Fee</span><strong style={{ color: T.navy }}>${fee}</strong></div>
              </div>
            </section>
          </aside>

          <section style={{ display: 'grid', gap: '14px' }}>
            <header style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Ico p={ICONS.check} size={11} sw={2.2} color={T.blue} />
                    Final review
                  </div>
                  <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Review Your Appointment</h1>
                  <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7, maxWidth: '760px' }}>Please review every detail before confirming your booking. This final step is designed to give you complete clarity, confidence, and reassurance.</p>
                </div>
                <Link href={editHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: T.blue, fontSize: '13px', fontWeight: 700 }}>
                  <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={T.blue} />
                  Edit Booking
                </Link>
              </div>
            </header>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician Summary</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your care team at a glance</h2>
                </div>
                <Link href={editHref} style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textDecoration: 'none' }}>Edit</Link>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />
                    Verified Physician
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physician?.name ?? 'Selected physician'}</h3>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physician?.specialty ?? 'Care Team'} · {physician?.hospital ?? 'Qarevo Care Network'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physician?.experienceYears ?? 12} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.steth} size={12} sw={1.75} color={T.blue} />{(physician?.rating ?? 4.9).toFixed(1)} rating</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physician?.languages.join(', ') ?? 'English, French'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appointment Details</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your selected consultation details</h2>
                </div>
                <Link href={editHref} style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textDecoration: 'none' }}>Edit</Link>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {[
                  ['Consultation Type', readLabel(service)],
                  ['Appointment Date', date],
                  ['Appointment Time', slot],
                  ['Timezone', 'Africa/Lagos (GMT+1)'],
                  ['Estimated Duration', duration],
                  ['Consultation Fee', formatFee(fee)],
                  ['Insurance Coverage', insurance],
                  ['Expected End Time', appointmentEnd],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 13px', borderRadius: '14px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient Information</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your details are ready for review</h2>
                </div>
                <Link href={editHref} style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textDecoration: 'none' }}>Edit</Link>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {[
                  ['Patient Name', patientName],
                  ['Email Address', email],
                  ['Phone Number', phone],
                  ['Emergency Contact', emergencyContact],
                  ['Primary Medical Concern', medicalConcern],
                  ['Patient Notes', notes || 'No additional notes provided'],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 13px', borderRadius: '14px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment Summary</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything is transparent before payment</h2>
                </div>
                <button type='button' style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer' }}>Change Payment Method</button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Consultation Fee', formatFee(fee)],
                  ['Insurance Contribution', formatFee(Math.max(0, fee - 40))],
                  ['Additional Charges', '$0'],
                  ['Estimated Total', formatFee(fee)],
                  ['Payment Method', 'Card ending in 4821'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation Preparation</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A calm, ready experience</h2>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {['Join the consultation 5 minutes early', 'Ensure a stable internet connection', 'Upload any remaining medical documents', 'Prepare questions for your physician', 'Keep previous prescriptions available'].map((tip) => (
                    <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                      <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cancellation Policy</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Clear, flexible terms</h2>
                </div>
                <button type='button' onClick={() => setShowPolicy((value) => !value)} style={{ border: 'none', background: 'none', color: T.blue, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{showPolicy ? 'Hide' : 'Show Details'}</button>
              </div>
              {showPolicy ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    ['Free cancellation', 'Free cancellation up to 24 hours before appointment.'],
                    ['Late cancellation', 'A late cancellation fee may apply if the appointment is changed within 24 hours.'],
                    ['Missed appointments', 'Missed visits are subject to the standard care-team rescheduling policy.'],
                    ['Refund eligibility', 'Eligible refunds are reviewed based on the consultation type and provider availability.'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: T.slate, lineHeight: 1.6 }}>{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>Free cancellation up to 24 hours before your appointment. Late or missed appointments may be subject to a rescheduling fee.</p>
              )}
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consent & Agreements</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Please confirm the final terms</h2>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    ['info', 'I confirm that the information provided is accurate.'],
                    ['terms', 'I agree to the Terms & Conditions.'],
                    ['privacy', 'I consent to the Privacy Policy.'],
                    ['policy', 'I understand the consultation and cancellation policy.'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)', cursor: 'pointer' }}>
                      <input
                        type='checkbox'
                        checked={agreements[key as AgreementKey]}
                        onChange={() => setAgreements((value) => ({ ...value, [key]: !value[key as AgreementKey] }))}
                        style={{ marginTop: '2px', accentColor: T.blue }}
                      />
                      <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>
          </section>

          <aside style={{ position: 'sticky', top: '18px', display: 'grid', gap: '12px' }}>
            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={22} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking Summary</p>
                  <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy }}>{physician?.name ?? 'Selected physician'}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                {[
                  ['Consultation', readLabel(service)],
                  ['Date', date],
                  ['Time', slot],
                  ['Duration', duration],
                  ['Fee', formatFee(fee)],
                  ['Insurance', insurance],
                  ['Estimated Total', formatFee(fee)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>

              <HoverBtn
                onClick={handleConfirm}
                base={{
                  width: '100%',
                  minHeight: '46px',
                  borderRadius: '13px',
                  border: 'none',
                  background: allAgreed ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(109,135,151,0.28)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  cursor: allAgreed ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: allAgreed ? '0 4px 14px rgba(32,181,223,0.28)' : 'none',
                }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 18px rgba(32,181,223,0.28)' }}
              >
                {isSubmitting ? 'Confirming…' : 'Confirm Appointment'}
                <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
              </HoverBtn>

              <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', color: T.slate2, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
                Back
              </Link>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '16px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Secure Booking', 'Encrypted Scheduling', 'Instant Confirmation', 'HIPAA-Compliant Platform', 'Verified Physicians'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: T.slate, fontSize: '12px', fontWeight: 600 }}>
                    <Ico p={ICONS.shield} size={12} sw={1.8} color={T.green} />
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function ReviewPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1460px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparing your review</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Loading your appointment summary</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>We are bringing over the latest slot and consultation details.</p>
        </div>
      </div>
    </main>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewPageFallback />}>
      <ReviewPageContent />
    </Suspense>
  )
}

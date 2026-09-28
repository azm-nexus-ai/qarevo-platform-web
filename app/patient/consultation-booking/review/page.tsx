'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { createPatientAppointment, getPatientDoctor, type PatientDoctor } from '@/lib/api'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

function formatFee(value: number) {
  return value > 0 ? `$${value}` : 'Not configured'
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

function parseAppointmentStart(dateLabel: string, timeLabel: string) {
  const trimmedDate = dateLabel.trim()
  const today = new Date()
  let datePart = trimmedDate
  if (/^today$/i.test(trimmedDate)) {
    datePart = today.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  } else if (/^tomorrow$/i.test(trimmedDate)) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    datePart = tomorrow.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const parsed = new Date(`${datePart} ${timeLabel}`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Choose a valid appointment date and time before confirming.')
  }
  return parsed
}

function addDuration(start: Date, durationLabel: string) {
  const minutes = Number(durationLabel.match(/(\d+)/)?.[1] ?? 30)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + minutes)
  return end
}

function profileServices(doctor: PatientDoctor | null) {
  const services = doctor?.profile?.services
  if (!Array.isArray(services)) return []

  return services
    .map((service) => {
      if (!service || typeof service !== 'object') return null
      const item = service as Record<string, unknown>
      return {
        type: typeof item.type === 'string' ? item.type : '',
        duration: typeof item.duration === 'string' ? item.duration : '',
        price: typeof item.price === 'number' ? item.price : null,
      }
    })
    .filter((service): service is { type: string; duration: string; price: number | null } => Boolean(service))
}

function doctorToBookingFallback(doctor: PatientDoctor | null) {
  if (!doctor) return undefined
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    imageUrl: doctor.imageUrl || '',
    consultationFee: doctor.consultationFee,
    experienceYears: doctor.experienceYears,
    rating: doctor.rating,
    languages: doctor.languages,
    insurance: doctor.insurance,
  }
}

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const [remoteDoctor, setRemoteDoctor] = useState<PatientDoctor | null>(null)
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const bookingFallback = useMemo(() => doctorToBookingFallback(remoteDoctor) ?? physician, [remoteDoctor, physician])
  const physicianData = useMemo(() => getBookingPhysician(searchParams, bookingFallback), [searchParams, bookingFallback])
  const service = searchParams.get('service') ?? searchParams.get('service_type') ?? 'video'
  const serviceDetail = useMemo(() => {
    const services = profileServices(remoteDoctor)
    return services.find((item) => item.type === service) ?? services[0]
  }, [remoteDoctor, service])
  const fee = Number(searchParams.get('fee') ?? serviceDetail?.price ?? physicianData.consultationFee ?? 0)
  const duration = searchParams.get('duration') ?? serviceDetail?.duration ?? '30 min'
  const insurance = searchParams.get('insurance') ?? physicianData.insurance[0] ?? 'Self pay'
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const notes = searchParams.get('notes') ?? ''
  const episodeId = searchParams.get('episode_id') ?? ''
  const intakeSubmitted = searchParams.get('intake_submitted') === 'true'
  const patientName = 'A. Bello'
  const email = 'abello@qarevo.health'
  const phone = '+234 805 000 0000'
  const emergencyContact = 'M. Bamidele · +234 810 123 4567'
  const medicalConcern = 'Cardiovascular review and medication follow-up'

  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showPolicy, setShowPolicy] = useState(false)
  const [editableNotes, setEditableNotes] = useState(notes)

  useEffect(() => {
    if (!physicianId || physician) return

    let cancelled = false
    getPatientDoctor(physicianId)
      .then((doctor) => {
        if (cancelled) return
        setRemoteDoctor(doctor)
        setDoctorLoadError('')
      })
      .catch((error) => {
        console.error('Failed to load selected doctor', error)
        if (!cancelled) {
          setRemoteDoctor(null)
          setDoctorLoadError('We could not load the selected physician details. Please go back and choose the doctor again.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [physicianId, physician])

  const appointmentEnd = useMemo(() => {
    const parts = duration.match(/(\d+)/)
    const minutes = parts ? Number(parts[1]) : 30
    const start = new Date('2026-01-01T09:00:00')
    start.setMinutes(start.getMinutes() + minutes)
    return start.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
  }, [duration])

  const allAgreed = agreed

  const successHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    next.set('date', date)
    next.set('slot', slot)
    next.set('notes', editableNotes)
    return `/patient/consultation-booking/success?${next.toString()}`
  }, [date, editableNotes, searchParams, physicianData, service, slot])

  const backHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return `/patient/consultation-booking/intake?${next.toString()}`
  }, [searchParams, physicianData, service])

  const handleConfirm = async () => {
    if (!allAgreed || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const insuranceType = /statutory|public|nhs|gkv/i.test(insurance) ? 'public' : 'private'
      const startAt = parseAppointmentStart(date, slot)
      const endAt = addDuration(startAt, duration)
      
      // If intake was already submitted on the intake page, don't send intake data here
      // to avoid overwriting the detailed intake fields (chief_complaint, symptoms, medical_history)
      const intake = episodeId ? undefined : {
        raw_text: editableNotes || medicalConcern,
        reported_duration: duration,
        reported_location: physicianData.hospital,
        reported_onset: `${date} ${slot}`,
        reported_severity: 'Not specified',
        associated_factors: `${physicianData.specialty}; ${readLabel(service)}; selected doctor: ${physicianData.name}`,
        booking_date: date,
        booking_slot: slot,
        consultation_type: readLabel(service),
        selected_physician_id: physicianData.id,
        selected_physician_name: physicianData.name,
        insurance_provider: insurance,
        consultation_fee: fee,
      }

      const booking = await createPatientAppointment({
        provider_id: physicianData.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        consultation_modality: service,
        intake,
        episode_id: episodeId || undefined,
        episode: episodeId ? undefined : {
          pack_id: 'patient-booking-intake',
          pack_version: '1.0.0',
          bundesland: searchParams.get('bundesland') ?? 'Berlin',
          insurance_type: insuranceType,
          flow_type: service === 'follow-up' ? 'follow_up' : 'consultation',
          matching_mode: physicianData.id ? 'patient_selects' : 'matching_required',
          insurance_provider: insurance,
          consent_data_processing: agreed,
          consent_ai_assistance: true,
          recipient_email: email,
          recipient_phone_e164: phone.replace(/\s/g, ''),
          notification_channel: 'email',
        },
      })
      const next = new URLSearchParams(successHref.split('?')[1] ?? '')
      if (booking.episode_id) next.set('episodeId', booking.episode_id)
      if (booking.consultation_id) next.set('consultationId', booking.consultation_id)
      next.set('appointmentId', booking.id)
      const aiDraftJobId = booking.ai_draft?.job_id
      if (aiDraftJobId) next.set('aiDraftJobId', aiDraftJobId)
      router.push(`/patient/consultation-booking/success?${next.toString()}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to confirm this appointment right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1460px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '280px minmax(0, 1fr) 340px', alignItems: 'start' }}>
          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booking Progress</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.blue }}>80%</p>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Doctor Selected', 'Date & Time', 'Intake', 'Review', 'Confirmation'].map((step, index) => {
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Fee</span><strong style={{ color: T.navy }}>{formatFee(fee)}</strong></div>
              </div>
              {doctorLoadError && (
                <div style={{ marginTop: '10px', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(254,242,242,0.9)', color: '#B91C1C', padding: '10px 11px', fontSize: '12px', fontWeight: 700, lineHeight: 1.5 }}>
                  {doctorLoadError}
                </div>
              )}
            </section>
          </aside>

          <section style={{ display: 'grid', gap: '14px' }}>
            <header style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '22px 24px' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  <Ico p={ICONS.check} size={11} sw={2.2} color={T.blue} />
                  Final review
                </div>
                <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Review Your Appointment</h1>
                <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7, maxWidth: '760px' }}>Please review every detail before confirming your booking. This final step is designed to give you complete clarity, confidence, and reassurance.</p>
              </div>
            </header>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician Summary</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your care team at a glance</h2>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physicianData.imageUrl ? (
                    <img src={physicianData.imageUrl} alt={physicianData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />
                    Verified Physician
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physicianData.experienceYears} years experience</span>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.steth} size={12} sw={1.75} color={T.blue} />{remoteDoctor && remoteDoctor.reviews > 0 ? `${remoteDoctor.rating.toFixed(1)} rating` : 'No ratings yet'}</span>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physicianData.languages.length ? physicianData.languages.join(', ') : 'Languages not listed'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appointment Details</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your selected consultation details</h2>
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
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient Information</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your details are ready for review</h2>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {[
                  ['Patient Name', patientName],
                  ['Email Address', email],
                  ['Phone Number', phone],
                  ['Emergency Contact', emergencyContact],
                  ['Primary Medical Concern', medicalConcern],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 13px', borderRadius: '14px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1', padding: '12px 13px', borderRadius: '14px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient Notes</p>
                  <textarea
                    value={editableNotes}
                    onChange={(event) => setEditableNotes(event.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={4}
                    placeholder='Describe your symptoms, concerns, or anything you would like your physician to know before the consultation.'
                    style={{ width: '100%', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', padding: '10px 12px', fontFamily: 'inherit', fontSize: '13px', color: T.navy, resize: 'vertical', outline: 'none', background: 'rgba(255,255,255,0.9)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: T.slate2 }}>
                    <span>Optional and private to your booking.</span>
                    <span>{editableNotes.length}/500</span>
                  </div>
                </div>
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
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)', cursor: 'pointer' }}>
                  <input
                    type='checkbox'
                    checked={agreed}
                    onChange={() => setAgreed((value) => !value)}
                    style={{ marginTop: '2px', accentColor: T.blue }}
                  />
                  <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>I confirm that the information provided is accurate, agree to the Terms & Conditions, consent to the Privacy Policy, and understand the consultation and cancellation policy.</span>
                </label>
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
                  <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
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
              {submitError && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', background: '#FFF5F5', border: '1px solid rgba(220,38,38,0.25)', color: T.red, fontSize: '12px', lineHeight: 1.5 }}>
                  {submitError}
                </div>
              )}

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

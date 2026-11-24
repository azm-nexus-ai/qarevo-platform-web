'use client'

import { useLocale, useTranslations } from 'next-intl'
import { getApiErrorDetail } from '@/lib/api'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { declaredDoctorFundingOptions } from '@/lib/insurance-presentation'
import TreatingEntityChoice, { type EntitySelection } from '@/components/booking/TreatingEntityChoice'
import { createPatientAppointment, getPatientDoctor, getPatientBookingSlots, getPatientSettings, type PatientSettings, type PatientDoctor, type PatientBookingSlot } from '@/lib/api'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import { useEpisodeIntake } from '@/lib/use-episode-intake'
import { resolveBookingSlot } from '@/lib/booking-slot'


/** Message key for the consultation type shown to the patient. */
function serviceKey(service: string | null) {
  switch (service) {
    case 'physical':
      return 'serviceInPerson'
    case 'follow-up':
      return 'serviceFollowUp'
    default:
      return 'serviceVideo'
  }
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
  const t = useTranslations('bookingReview'), timeLocale = useLocale().startsWith('de') ? 'de-DE' : 'en'
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const [remoteDoctor, setRemoteDoctor] = useState<PatientDoctor | null>(null)
  const [verifiedSlot, setVerifiedSlot] = useState<PatientBookingSlot | null>(null)
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const bookingFallback = useMemo(() => doctorToBookingFallback(remoteDoctor) ?? physician, [remoteDoctor, physician])
  const physicianData = useMemo(() => getBookingPhysician(searchParams, bookingFallback), [searchParams, bookingFallback])
  const service = searchParams.get('service') ?? searchParams.get('service_type') ?? 'video'
  const duration = verifiedSlot ? t('minutes', { minutes: verifiedSlot.duration_minutes }) : t('notYetVerified')
  const insurance = declaredDoctorFundingOptions(physicianData.insurance)
  const date = searchParams.get('date') ?? ''
  const slot = searchParams.get('slot') ?? ''
  const episodeId = searchParams.get('episode_id') ?? ''
  const intakeSubmitted = searchParams.get('intake_submitted') === 'true'
  const [patient, setPatient] = useState<PatientSettings | null>(null)
  const [patientError, setPatientError] = useState('')
  const intake = useEpisodeIntake(episodeId)
  const patientName = patient ? [patient.first_name, patient.last_name].filter(Boolean).join(' ') || t('notProvided') : t('loading')
  const email = patient?.email || t('notProvided')
  const phone = patient?.phone || t('notProvided')
  const emergencyContact = patient?.emergency_contacts?.map(contact => [contact.name, contact.phone].filter(Boolean).join(' · ')).join('; ') || t('notProvided')
  const medicalConcern = intake.loading ? t('loadingIntake') : intake.error || intake.notes || t('noIntake')
  useEffect(() => {
    let current = true
    getPatientSettings().then(value => { if (current) setPatient(value) })
      .catch(() => { if (current) setPatientError(t('patientLoadFailed')) })
    return () => { current = false }
  }, [t])

  const [agreed, setAgreed] = useState(false)
  const [entitySelection, setEntitySelection] = useState<EntitySelection>({ ready: false, treatingEntityId: null, confirmedFeeMinor: null, reason: t('checkingTreating') })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showPolicy, setShowPolicy] = useState(false)

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
          setDoctorLoadError(t('doctorLoadFailed'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [physicianId, physician, t])

  const [slotError, setSlotError] = useState('')
  const requestedStart = searchParams.get('start_at')
  useEffect(() => {
    let current = true
    setVerifiedSlot(null)
    setSlotError('')
    if (!physicianId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !slot) {
      setSlotError(t('chooseSlotAgain'))
      return
    }
    getPatientBookingSlots(physicianId, date)
      .then(response => { if (current) setVerifiedSlot(resolveBookingSlot(response.slot_details ?? [], slot, requestedStart)) })
      .catch(error => { if (current) setSlotError(getApiErrorDetail(error) || t('slotUnverified')) })
    return () => { current = false }
  }, [physicianId, date, slot, requestedStart, t])
  const appointmentEnd = verifiedSlot
    ? new Date(verifiedSlot.end_at).toLocaleTimeString(timeLocale, { hour: 'numeric', minute: '2-digit', timeZone: verifiedSlot.time_zone })
    : t('verifyingSlot')

  const allAgreed = agreed

  const successHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    next.set('date', date)
    next.set('slot', slot)
    return `/patient/consultation-booking/success?${next.toString()}`
  }, [date, searchParams, physicianData, service, slot])

  const backHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return `/patient/consultation-booking/intake?${next.toString()}`
  }, [searchParams, physicianData, service])

  const handleConfirm = async () => {
    if (isSubmitting) return
    if (!verifiedSlot) { setSubmitError(slotError || t('waitForSlot')); return }
    if (!allAgreed) { setSubmitError(t('confirmReview')); return }
    if (!entitySelection.ready) { setSubmitError(entitySelection.reason || t('choosePractice')); return }
    if (!episodeId || !intakeSubmitted) { setSubmitError(t('completeIntake')); return }
    if (!patient || patientError || intake.error || intake.loading) { setSubmitError(patientError || intake.error || t('waitForData')); return }
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const booking = await createPatientAppointment({
        provider_id: physicianData.id,
        start_at: verifiedSlot.start_at,
        end_at: verifiedSlot.end_at,
        consultation_modality: service,
        episode_id: episodeId || undefined,
        ...(entitySelection.treatingEntityId ? { treating_entity_id: entitySelection.treatingEntityId } : {}),
        ...(entitySelection.confirmedFeeMinor != null ? { confirmed_self_pay_fee_minor: entitySelection.confirmedFeeMinor } : {}),
      })
      const next = new URLSearchParams(successHref.split('?')[1] ?? '')
      if (booking.episode_id) next.set('episodeId', booking.episode_id)
      if (booking.consultation_id) next.set('consultationId', booking.consultation_id)
      next.set('appointmentId', booking.id)
      const aiDraftJobId = booking.ai_draft?.job_id
      if (aiDraftJobId) next.set('aiDraftJobId', aiDraftJobId)
      router.push(`/patient/consultation-booking/success?${next.toString()}`)
    } catch (error) {
      setSubmitError(getApiErrorDetail(error) || t('confirmFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1460px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <style>{` .review-grid { display: grid; gap: 16px; grid-template-columns: 280px minmax(0, 1fr) 340px; align-items: start; } @media(max-width: 1120px) { .review-grid { grid-template-columns: minmax(0, 1fr); } } `}</style>
        {slotError && <p role='alert' className='field-error'>{slotError}</p>}
        <div className='review-grid'>
          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ ...Glass.nav, borderRadius: '20px', border: "1px solid var(--border)", padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('bookingProgress')}</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.link }}>80%</p>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: "var(--surface-hover)", marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg, #20B5DF 0%, var(--primary-end) 100%)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[t('stepDoctor'), t('stepDateTime'), t('stepIntake'), t('stepReview'), t('stepConfirmation')].map((step, index) => {
                  const completed = index < 3
                  const active = index === 3
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: active ? 'rgba(32,181,223,0.08)' : completed ? 'rgba(15,158,119,0.08)' : "var(--surface-glass)", border: `1px solid ${active ? 'rgba(32,181,223,0.16)' : completed ? 'rgba(15,158,119,0.16)' : "var(--border)"}` }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: completed ? T.greenLight : active ? T.blueLight : "var(--surface-glass)", color: completed ? T.green : active ? T.link : T.slate2, fontSize: "13px", fontWeight: 700 }}>
                        {completed ? <Ico p={ICONS.check} size={10} sw={2.2} color={T.green} /> : index + 1}
                      </span>
                      <span style={{ fontSize: "13px", color: active ? T.navy : T.slate, fontWeight: active ? 700 : 600 }}>{step}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section style={{ ...Glass.pill, borderRadius: '20px', border: "1px solid var(--border)", padding: '18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                <Ico p={ICONS.lock} size={11} sw={2.2} color={T.blue} />
                {t('protectedReview')}
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{physicianData.name}</h2>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
              <div style={{ display: 'grid', gap: '7px', fontSize: "13px", color: T.slate2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>{t('consultation')}</span><strong style={{ color: T.navy }}>{t(serviceKey(service))}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>{t('date')}</span><strong style={{ color: T.navy }}>{date}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>{t('time')}</span><strong style={{ color: T.navy }}>{slot}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>{t('fee')}</span><strong style={{ color: T.navy }}>{t('pricingPending')}</strong></div>
              </div>
              {doctorLoadError && (
                <div style={{ marginTop: '10px', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(254,242,242,0.9)', color: '#B91C1C', padding: '10px 11px', fontSize: "13px", fontWeight: 700, lineHeight: 1.5 }}>
                  {doctorLoadError}
                </div>
              )}
            </section>
          </aside>

          <section style={{ display: 'grid', gap: '14px' }}>
            <header style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '22px 24px' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  <Ico p={ICONS.check} size={11} sw={2.2} color={T.blue} />
                  {t('finalReview')}
                </div>
                <h1 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('reviewYourAppointment')}</h1>
                <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7, maxWidth: '760px' }}>{t('pleaseReviewEveryDetailBefore')}</p>
              </div>
            </header>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('physicianSummary')}</p>
                <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('yourCareTeamAtA')}</h2>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '18px', overflow: 'hidden', border: "1px solid var(--border)", background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physicianData.imageUrl ? (
                    <img src={physicianData.imageUrl} alt={physicianData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />
                    {t('verifiedPhysician')}
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: "13px", color: T.slate2 }}>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{t('yearsExperience', { years: physicianData.experienceYears })}</span>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.steth} size={12} sw={1.75} color={T.blue} />{remoteDoctor && remoteDoctor.reviews > 0 ? t('rating', { rating: remoteDoctor.rating.toFixed(1) }) : t('noRatings')}</span>
	                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physicianData.languages.length ? physicianData.languages.join(', ') : t('noLanguages')}</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('appointmentDetails')}</p>
                <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('yourSelectedConsultationDetails')}</h2>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
                {[
                  [t('consultationType'), t(serviceKey(service))],
                  [t('appointmentDate'), date],
                  [t('appointmentTime'), slot],
                  [t('timezone'), verifiedSlot?.time_zone || t('notAvailable')],
                  [t('estimatedDuration'), verifiedSlot ? t('minutes', { minutes: verifiedSlot.duration_minutes }) : t('notAvailable')],
                  [t('consultationFee'), t('pricingPending')],
                  [t('billingOptions'), insurance],
                  [t('expectedEnd'), appointmentEnd],
                ].map(([label, value]) => (
                  <div key={label} style={{ minWidth: 0, overflowWrap: 'anywhere', padding: '12px 13px', borderRadius: '14px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                    <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('patientInformation')}</p>
                <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('yourDetailsAreReadyFor')}</h2>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
                {[
                  [t('patientName'), patientName],
                  [t('emailAddress'), email],
                  [t('phoneNumber'), phone],
                  [t('emergencyContact'), emergencyContact],
                  [t('primaryConcern'), medicalConcern],
                ].map(([label, value]) => (
                  <div key={label} style={{ minWidth: 0, overflowWrap: 'anywhere', padding: '12px 13px', borderRadius: '14px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                    <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
                <p style={{ gridColumn: '1 / -1' }}>{t('intakeIsLoadedSecurelyFrom')}</p>
              </div>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('consultationPreparation')}</p>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('aCalmReadyExperience')}</h2>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[t('tipEarly'), t('tipInternet'), t('tipDocuments'), t('tipQuestions'), t('tipPrescriptions')].map((tip) => (
                    <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                      <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('cancellationPolicy')}</p>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('clearFlexibleTerms')}</h2>
                </div>
                <button type='button' onClick={() => setShowPolicy((value) => !value)} style={{ border: 'none', background: 'none', color: T.link, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}>{showPolicy ? t('hideDetails') : t('showDetails')}</button>
              </div>
              {showPolicy ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    [t('policyFree'), t('policyFreeBody')],
                    [t('policyTerms'), t('policyTermsBody')],
                    [t('policyMissed'), t('policyMissedBody')],
                    [t('policyPayments'), t('policyPaymentsBody')],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</p>
                      <p style={{ margin: 0, fontSize: "13px", color: T.slate, lineHeight: 1.6 }}>{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>{t('thisIsASyntheticDevelopment')}</p>
              )}
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('consentAgreements')}</p>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('reviewYourTestBooking')}</h2>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '12px', background: "var(--surface-subtle)", border: "1px solid var(--border)", cursor: 'pointer' }}>
                  <input
                    type='checkbox'
                    checked={agreed}
                    onChange={() => setAgreed((value) => !value)}
                    style={{ marginTop: '2px', accentColor: T.blue }}
                  />
                  <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{t('iHaveReviewedMySynthetic')}</span>
                </label>
              </div>
            </section>
            <TreatingEntityChoice providerId={physicianData.id} onChange={setEntitySelection} />
          </section>

          <aside style={{ position: 'sticky', top: '18px', display: 'grid', gap: '12px' }}>
            <section style={{ background: "var(--surface-glass)", borderRadius: '22px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={22} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('bookingSummary')}</p>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                {[
                  [t('consultation'), t(serviceKey(service))],
                  [t('date'), date],
                  [t('time'), slot],
                  [t('duration'), duration],
                  [t('fee'), t('pricingPending')],
                  [t('insurance'), insurance],
                  [t('estimatedTotal'), t('pricingPending')],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "13px", color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: "13px", color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
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
                  background: allAgreed ? `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)` : 'rgba(109,135,151,0.28)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: allAgreed ? '0 4px 14px rgba(32,181,223,0.28)' : 'none',
                }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 18px rgba(32,181,223,0.28)' }}
              >
                {isSubmitting ? t('confirming') : t('confirmAppointment')}
                <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
              </HoverBtn>
              {submitError && (
                <div role="alert" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', background: "var(--danger-soft)", border: '1px solid rgba(220,38,38,0.25)', color: T.red, fontSize: "13px", lineHeight: 1.5 }}>
                  {submitError}
                </div>
              )}

              <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', color: T.slate2, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
                {t('back')}
              </Link>
            </section>

            <section style={{ background: "var(--surface-glass)", borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '16px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[t('trustReview'), t('trustAi'), t('trustClinician')].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: T.slate, fontSize: "13px", fontWeight: 600 }}>
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
  const t = useTranslations('bookingReview')
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1460px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: "var(--surface-glass)", borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('preparingYourReview')}</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('loadingYourAppointmentSummary')}</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>{t('weAreBringingOverThe')}</p>
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

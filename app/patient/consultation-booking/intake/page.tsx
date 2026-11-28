'use client'

import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { getPatientDoctor, getPatientSettings, createPatientEpisode, authorizeBilling, submitPatientEpisodeIntake, getApiErrorDetail, type PatientDoctor, type Insurance } from '@/lib/api'
import { bookingFunding, selfPayPricingBasis } from '@/lib/booking-funding'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'

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

function IntakePageContent() {
  const t = useTranslations('bookingIntake')
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? ''
  const [remoteDoctor, setRemoteDoctor] = useState<PatientDoctor | null>(null)
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const bookingFallback = useMemo(() => doctorToBookingFallback(remoteDoctor), [remoteDoctor])
  const physicianData = useMemo(() => getBookingPhysician(searchParams, bookingFallback), [searchParams, bookingFallback])

  const service = searchParams.get('service') ?? searchParams.get('service_type') ?? 'video'
  // The patient's own saved insurance decides the billing route, not the doctor's accepted options.
  const [savedInsurance, setSavedInsurance] = useState<Insurance | null | undefined>(undefined)
  const [insuranceLoadFailed, setInsuranceLoadFailed] = useState(false)
  const funding = useMemo(() => bookingFunding(savedInsurance), [savedInsurance])
  const [selfPayConfirmed, setSelfPayConfirmed] = useState(false)

  const [chiefComplaint, setChiefComplaint] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  const [reportedDuration, setReportedDuration] = useState('')
  const [reportedLocation, setReportedLocation] = useState('')
  const [reportedOnset, setReportedOnset] = useState('')
  const [reportedSeverity, setReportedSeverity] = useState('')
  const [associatedFactors, setAssociatedFactors] = useState('')

  const [processingConsent, setProcessingConsent] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const errors = {
    complaint: !chiefComplaint.trim() ? 'Describe the main reason for your visit.' : chiefComplaint.length > 2000 ? 'Use no more than 2,000 characters for the main concern.' : undefined,
    processing: !processingConsent ? 'Confirm the required data-processing choice before submitting this intake.' : undefined,
    selfPay: funding.needsSelfPayConfirmation && !selfPayConfirmed ? 'Confirm that this consultation is self-pay, or add your insurance first.' : undefined,
  }
  const submitting = useRef(false)
  const episodeRef = useRef(searchParams.get('episode_id') || '')
  const [submitStage, setSubmitStage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!physicianId) return

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
  }, [physicianId, t])

  useEffect(() => {
    let cancelled = false
    const load = () => getPatientSettings()
      .then(settings => { if (!cancelled) { setSavedInsurance(settings.insurance ?? null); setInsuranceLoadFailed(false) } })
      .catch(() => { if (!cancelled) { setSavedInsurance(null); setInsuranceLoadFailed(true) } })
    load()
    // Insurance added in another tab is picked up when the patient returns here.
    window.addEventListener('focus', load)
    return () => { cancelled = true; window.removeEventListener('focus', load) }
  }, [])

  const handleBack = () => {
    const params = buildBookingQueryParams(searchParams, physicianData, service)
    router.push(`/patient/consultation-booking/date-time?${params.toString()}`)
  }

  const handleSubmit = async () => {
    if (submitting.current) return
    const validationStarted = performance.now()
    setAttempted(true)
    if (Object.values(errors).some(Boolean)) {
      const form = document.getElementById('clinical-intake-form')
      if (form) focusValidation(form)
      return
    }

    submitting.current = true
    const validationMs = performance.now() - validationStarted
    setIsSubmitting(true)
    setSubmitStage('Opening your clinical intake…')
    setSubmitError('')

    try {
      const apiStarted = performance.now()
      const episodeResponse = episodeRef.current ? {id: episodeRef.current} : await createPatientEpisode({
        pack_id: 'patient-booking-intake',
        pack_version: '1.0.0',
        bundesland: 'general',
        insurance_type: funding.episodeInsuranceType,
        flow_type: 'consultation',
        matching_mode: 'patient_selects',
        insurance_provider: funding.insurer || undefined,
        insurance_number: '',
        consent_data_processing: processingConsent,
        consent_ai_assistance: aiConsent,
        recipient_email: '',
        recipient_phone_e164: '',
        notification_channel: 'email',
      })

      const newEpisodeId = episodeResponse.id
      episodeRef.current = newEpisodeId
      const recoveryUrl = new URL(window.location.href)
      recoveryUrl.searchParams.set('episode_id', newEpisodeId)
      window.history.replaceState(window.history.state, '', recoveryUrl.pathname + recoveryUrl.search)
      if (funding.needsSelfPayConfirmation) {
        setSubmitStage('Recording your self-pay confirmation…')
        // Audited consent intent in the clinical service; repeating it is a no-op.
        await authorizeBilling(newEpisodeId, { insurance_type: 'SELF_PAY', currency: 'EUR' })
      }
      setSubmitStage('Saving and submitting your intake…')
      const serializationStarted = performance.now()

      const intakeData = {
        chief_complaint: chiefComplaint,
        symptoms: symptoms,
        medical_history: medicalHistory,
        reported_duration: reportedDuration,
        reported_location: reportedLocation,
        reported_onset: reportedOnset,
        reported_severity: reportedSeverity,
        associated_factors: associatedFactors,
        raw_text: `${chiefComplaint}. ${symptoms}. ${medicalHistory}`,
      }

      JSON.stringify(intakeData)
      const serializationMs = performance.now() - serializationStarted
      await submitPatientEpisodeIntake(newEpisodeId, intakeData)
      if (process.env.NODE_ENV === 'development') console.info('intake.performance', {validation_ms:validationMs, serialization_ms:serializationMs, api_ms:performance.now()-apiStarted})

      const reviewParams = buildBookingQueryParams(searchParams, physicianData, service)
      reviewParams.set('episode_id', newEpisodeId)
      reviewParams.set('intake_submitted', 'true')
      router.push(`/patient/consultation-booking/review?${reviewParams.toString()}`)
    } catch (error) {
      console.error('Failed to submit intake:', error)
      setSubmitError(getApiErrorDetail(error) || t('yourIntakeCouldNotBe'))
    } finally {
      submitting.current = false
      setIsSubmitting(false)
      setSubmitStage('')
    }
  }

  if (doctorLoadError) {
    return (
      <main style={{ minHeight: '100vh', background: PAGE_BG, padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <p role="alert" style={{ color: 'var(--danger)', marginBottom: '20px', fontSize: '14px' }}>{doctorLoadError}</p>
          <PortalButton onClick={handleBack}>
            {t('goBack')}
          </PortalButton>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <header style={{ background: "var(--surface)", borderBottom: '1px solid var(--border-subtle)', padding: '16px 24px' }}>
        <div className="portal-form-heading-row" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button aria-label={t('backToAppointmentTime')} disabled={isSubmitting} onClick={handleBack} style={{ minWidth: 44, minHeight: 44, padding: '8px', borderRadius: '8px', background: "var(--canvas)", border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: '20px', color: "var(--text-muted)" }}>←</span>
            </button>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 700, color: "var(--text)" }}>{t('intakeInformation')}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: "var(--text-muted)" }}>
            <span>{t('step2Of3')}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '24px', height: '4px', background: 'var(--action-primary)', borderRadius: '2px' }} />
              <div style={{ width: '24px', height: '4px', background: 'var(--action-primary)', borderRadius: '2px' }} />
              <div style={{ width: '24px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <div className="portal-form-card" style={{ ...Glass.pill, borderRadius: 'var(--radius-lg)' }}>
          <h2 className="portal-h2">{t('tellUsAboutYourHealth')}</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: '24px', fontSize: '14px' }}>
            Please provide details about your medical condition so Dr. {physicianData.name} can prepare for your consultation.
          </p>

          {submitStage && <p role='status' aria-live='polite'>{submitStage}</p>}
          {submitError && (
            <div role="alert" style={{ background: "var(--danger-soft)", border: '1px solid var(--danger)', borderRadius: '8px', padding: '12px', marginBottom: '24px' }}>
              <p style={{ color: 'var(--danger)', margin: 0, fontSize: '14px' }}>{submitError}</p>
            </div>
          )}

          <form aria-busy={isSubmitting} id="clinical-intake-form" noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p className="field-hint">{t('developmentTestingOnlyUseSynthetic')}</p>
            {attempted && <ValidationSummary errors={errors} />}
            <div>
              <label htmlFor="chief-complaint" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('chiefComplaintRequired')}
              </label>
              <textarea
                id="chief-complaint"
                aria-invalid={attempted && Boolean(errors.complaint)}
                aria-describedby={attempted && errors.complaint ? 'complaint-error complaint-hint' : 'complaint-hint'}
                maxLength={2000}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder={t('whatIsTheMainReason')}
                required
                style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <FieldFeedback name="complaint" error={attempted ? errors.complaint : undefined} hint={t('describeYourMainConcernIn')} />

            <div>
              <label htmlFor="symptoms" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('symptomsOptionalUpTo5')}
              </label>
              <textarea
                id="symptoms"
                maxLength={5000}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder={t('describeYourSymptomsInDetail')}
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <div>
              <label htmlFor="medical-history" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('medicalHistoryOptionalUpTo')}
              </label>
              <textarea
                id="medical-history"
                maxLength={5000}
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder={t('anyRelevantMedicalHistoryPrevious')}
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="reported-duration" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('durationOptionalUpTo500')}
              </label>
                <input
                  type="text"
                  id="reported-duration"
                maxLength={500}
                value={reportedDuration}
                  onChange={(e) => setReportedDuration(e.target.value)}
                  placeholder={t('eG3Days2')}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>

              <div>
                <label htmlFor="reported-location" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('locationOptionalUpTo500')}
              </label>
                <input
                  type="text"
                  id="reported-location"
                maxLength={500}
                value={reportedLocation}
                  onChange={(e) => setReportedLocation(e.target.value)}
                  placeholder={t('eGLeftSideOf')}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="reported-onset" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('onsetOptionalUpTo500')}
              </label>
                <input
                  type="text"
                  id="reported-onset"
                maxLength={500}
                value={reportedOnset}
                  onChange={(e) => setReportedOnset(e.target.value)}
                  placeholder={t('eGSuddenGradual')}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>

              <div>
                <label htmlFor="reported-severity" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('severityOptional')}
              </label>
                <select
                  id="reported-severity"
                value={reportedSeverity}
                  onChange={(e) => setReportedSeverity(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                >
                  <option value="">{t('selectSeverity')}</option>
                  <option value="mild">{t('mild')}</option>
                  <option value="moderate">{t('moderate')}</option>
                  <option value="severe">{t('severe')}</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="associated-factors" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                {t('associatedFactorsOptionalUpTo')}
              </label>
              <textarea
                id="associated-factors"
                maxLength={5000}
                value={associatedFactors}
                onChange={(e) => setAssociatedFactors(e.target.value)}
                placeholder={t('anythingThatMakesItBetter')}
                style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <fieldset aria-describedby="funding-summary" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px', margin: 0, background: 'var(--surface-subtle)' }}>
              <legend style={{ fontWeight: 700, fontSize: '15px', padding: '0 6px' }}>{t('howThisConsultationIsPaid')}</legend>
              {savedInsurance === undefined ? (
                <p role="status" style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{t('checkingYourSavedInsurance')}</p>
              ) : funding.needsSelfPayConfirmation ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <p id="funding-summary" style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                    {t.rich(insuranceLoadFailed ? 'insuranceLoadFailedSelfPay' : 'noInsuranceSelfPay', { selfPay: t('selfPay'), strong: chunks => <strong>{chunks}</strong> })}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)' }}>{selfPayPricingBasis(physicianData.consultationFee)}</p>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    <Link href="/patient/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link, var(--action-primary))', fontWeight: 600 }}>{t('addYourInsurance')}</Link>
                    <span style={{ color: 'var(--text-muted)' }}> {t('opensInNewTab')}</span>
                  </p>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={selfPayConfirmed} onChange={e => setSelfPayConfirmed(e.target.checked)} aria-invalid={attempted && Boolean(errors.selfPay)} aria-describedby="selfPay-hint selfPay-error" />
                    <span>{t('iUnderstandThisConsultationIs')}</span>
                  </label>
                  <FieldFeedback name="selfPay" error={attempted ? errors.selfPay : undefined} hint={t('youCanStillAddInsurance')} />
                </div>
              ) : (
                <p id="funding-summary" style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                  {funding.label} · {funding.insurer}. Saved details are not yet verified; the practice confirms coverage before your consultation.
                </p>
              )}
            </fieldset>

            <div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={processingConsent} onChange={e => setProcessingConsent(e.target.checked)} aria-invalid={attempted && Boolean(errors.processing)} aria-describedby="processing-hint processing-error" />
                <span>{t('iAgreeToProcessingThis')}</span>
              </label>
              <FieldFeedback name="processing" error={attempted ? errors.processing : undefined} hint={t('thisIsADevelopmentAcknowledgement')} />
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
                <input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />
                <span>{t('allowOptionalAiAssistanceTo')}</span>
              </label>
            </div>
            <div className="portal-form-actions">
              <PortalButton
                type="button"
                tone="secondary"
                disabled={isSubmitting}
                onClick={handleBack}
              >
                {t('back')}
              </PortalButton>
              <PortalButton
                type="submit"
                tone="primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('submitting') : t('continueToReview')}
              </PortalButton>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

function IntakePageFallback() {
  const t = useTranslations('bookingIntake')
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: "var(--text-muted)" }}>{t('loadingIntakeForm')}</p>
      </div>
    </main>
  )
}

export default function IntakePage() {
  return (
    <Suspense fallback={<IntakePageFallback />}>
      <IntakePageContent />
    </Suspense>
  )
}

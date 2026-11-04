'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { getPatientDoctor, createPatientEpisode, submitPatientEpisodeIntake, getApiErrorDetail, type PatientDoctor } from '@/lib/api'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'

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

function profileServices(doctor: PatientDoctor | null) {
  const services = doctor?.services ?? doctor?.profile?.services
  if (!Array.isArray(services)) return []

  return services
    .map((service) => {
      if (!service || typeof service !== 'object') return null
      const item = service as Record<string, unknown>
      return {
        type: typeof item.type === 'string' ? item.type : '',
        duration: typeof item.duration === 'string' || typeof item.duration === 'number' ? String(item.duration) : '',
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

function IntakePageContent() {
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
  }
  const submitting = useRef(false)
  const episodeRef = useRef(searchParams.get('episode_id') || '')
  const [submitStage, setSubmitStage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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
        insurance_type: insurance === 'Self pay' ? 'self_pay' : 'private',
        flow_type: 'consultation',
        matching_mode: 'patient_selects',
        insurance_provider: insurance !== 'Self pay' ? insurance : undefined,
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
      setSubmitError(getApiErrorDetail(error) || 'Your intake could not be submitted. Please retry; your existing care episode will be reused.')
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
          <p style={{ color: '#ef4444', marginBottom: '20px', fontSize: '14px' }}>{doctorLoadError}</p>
          <button onClick={handleBack} style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '8px', background: '#348cea', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            Go Back
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <header style={{ background: "var(--surface)", borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleBack} style={{ padding: '8px', borderRadius: '8px', background: "var(--canvas)", border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: '20px', color: "var(--text-muted)" }}>←</span>
            </button>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: "var(--text)" }}>Intake Information</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: "var(--text-muted)" }}>
            <span>Step 2 of 3</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '24px', height: '4px', background: '#348cea', borderRadius: '2px' }} />
              <div style={{ width: '24px', height: '4px', background: '#348cea', borderRadius: '2px' }} />
              <div style={{ width: '24px', height: '4px', background: '#e2e8f0', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ ...Glass, padding: '32px', borderRadius: '16px' }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: 600, color: "var(--text)" }}>Tell us about your health concern</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: '24px', fontSize: '14px' }}>
            Please provide details about your medical condition so Dr. {physicianData.name} can prepare for your consultation.
          </p>

          {submitStage && <p role='status' aria-live='polite'>{submitStage}</p>}
          {submitError && (
            <div role="alert" style={{ background: "var(--danger-soft)", border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '24px' }}>
              <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{submitError}</p>
            </div>
          )}

          <form aria-busy={isSubmitting} id="clinical-intake-form" noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p className="field-hint">Development testing only. Use synthetic information. The legal documents are drafts awaiting approval.</p>
            {attempted && <ValidationSummary errors={errors} />}
            <div>
              <label htmlFor="chief-complaint" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Chief Complaint (Required)
              </label>
              <textarea
                id="chief-complaint"
                aria-invalid={attempted && Boolean(errors.complaint)}
                aria-describedby={attempted && errors.complaint ? 'complaint-error complaint-hint' : 'complaint-hint'}
                maxLength={2000}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="What is the main reason for your visit? (e.g., persistent headache, fever, chest pain)"
                required
                style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <FieldFeedback name="complaint" error={attempted ? errors.complaint : undefined} hint="Describe your main concern in up to 2,000 characters." />

            <div>
              <label htmlFor="symptoms" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Symptoms (Optional, up to 5,000 characters)
              </label>
              <textarea
                id="symptoms"
                maxLength={5000}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe your symptoms in detail (e.g., throbbing pain, nausea, dizziness)"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <div>
              <label htmlFor="medical-history" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Medical History (Optional, up to 5,000 characters)
              </label>
              <textarea
                id="medical-history"
                maxLength={5000}
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Any relevant medical history, previous conditions, or ongoing treatments"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="reported-duration" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Duration (Optional, up to 500 characters)
              </label>
                <input
                  type="text"
                  id="reported-duration"
                maxLength={500}
                value={reportedDuration}
                  onChange={(e) => setReportedDuration(e.target.value)}
                  placeholder="e.g., 3 days, 2 weeks"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>

              <div>
                <label htmlFor="reported-location" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Location (Optional, up to 500 characters)
              </label>
                <input
                  type="text"
                  id="reported-location"
                maxLength={500}
                value={reportedLocation}
                  onChange={(e) => setReportedLocation(e.target.value)}
                  placeholder="e.g., left side of head, lower back"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="reported-onset" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Onset (Optional, up to 500 characters)
              </label>
                <input
                  type="text"
                  id="reported-onset"
                maxLength={500}
                value={reportedOnset}
                  onChange={(e) => setReportedOnset(e.target.value)}
                  placeholder="e.g., sudden, gradual"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                />
              </div>

              <div>
                <label htmlFor="reported-severity" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Severity (Optional)
              </label>
                <select
                  id="reported-severity"
                value={reportedSeverity}
                  onChange={(e) => setReportedSeverity(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                >
                  <option value="">Select severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="associated-factors" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Associated Factors (Optional, up to 5,000 characters)
              </label>
              <textarea
                id="associated-factors"
                maxLength={5000}
                value={associatedFactors}
                onChange={(e) => setAssociatedFactors(e.target.value)}
                placeholder="Anything that makes it better or worse (e.g., rest, movement, certain foods)"
                style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={processingConsent} onChange={e => setProcessingConsent(e.target.checked)} aria-invalid={attempted && Boolean(errors.processing)} aria-describedby="processing-hint processing-error" />
                <span>I agree to processing this synthetic intake for development testing. (Required)</span>
              </label>
              <FieldFeedback name="processing" error={attempted ? errors.processing : undefined} hint="This is a development acknowledgement, not acceptance of final legal terms. See the draft status on the privacy page." />
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
                <input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />
                <span>Allow optional AI assistance to prepare a draft for clinician review. Declining does not prevent clinician-led care.</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleBack}
                style={{ padding: '12px 24px', borderRadius: '8px', background: "var(--canvas)", color: "var(--text-muted)", border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ padding: '12px 32px', borderRadius: '8px', background: '#348cea', color: '#fff', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? 'Submitting...' : 'Continue to Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

function IntakePageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: "var(--text-muted)" }}>Loading intake form...</p>
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

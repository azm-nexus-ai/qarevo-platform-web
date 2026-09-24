'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { getPatientDoctor, createPatientEpisode, updatePatientEpisodeIntake, submitPatientEpisodeIntake, type PatientDoctor } from '@/lib/api'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

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
    const params = new URLSearchParams(searchParams.toString())
    router.push(`/patient/consultation-booking/date-time?${params.toString()}`)
  }

  const handleSubmit = async () => {
    if (!chiefComplaint.trim()) {
      setSubmitError('Please describe your chief complaint (what brings you here today).')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const episodeResponse = await createPatientEpisode({
        pack_id: 'patient-booking-intake',
        pack_version: '1.0.0',
        bundesland: 'general',
        insurance_type: insurance === 'Self pay' ? 'self_pay' : 'private',
        flow_type: 'consultation',
        matching_mode: 'patient_selects',
        insurance_provider: insurance !== 'Self pay' ? insurance : undefined,
        insurance_number: '',
        consent_data_processing: true,
        consent_ai_assistance: true,
        recipient_email: '',
        recipient_phone_e164: '',
        notification_channel: 'email',
      })

      const newEpisodeId = episodeResponse.id

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

      await updatePatientEpisodeIntake(newEpisodeId, intakeData)
      await submitPatientEpisodeIntake(newEpisodeId)

      const reviewParams = buildBookingQueryParams(searchParams, physicianData, service)
      reviewParams.set('episode_id', newEpisodeId)
      reviewParams.set('intake_submitted', 'true')
      router.push(`/patient/consultation-booking/review?${reviewParams.toString()}`)
    } catch (error) {
      console.error('Failed to submit intake:', error)
      setSubmitError('Failed to submit your intake information. Please try again.')
    } finally {
      setIsSubmitting(false)
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
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleBack} style={{ padding: '8px', borderRadius: '8px', background: '#f1f5f9', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: '20px', color: '#64748b' }}>←</span>
            </button>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#04354D' }}>Intake Information</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b' }}>
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
          <h2 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: 600, color: '#04354D' }}>Tell us about your health concern</h2>
          <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
            Please provide details about your medical condition so Dr. {physicianData.name} can prepare for your consultation.
          </p>

          {submitError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '24px' }}>
              <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{submitError}</p>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Chief Complaint <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="What is the main reason for your visit? (e.g., persistent headache, fever, chest pain)"
                required
                style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Symptoms
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe your symptoms in detail (e.g., throbbing pain, nausea, dizziness)"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Medical History
              </label>
              <textarea
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Any relevant medical history, previous conditions, or ongoing treatments"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Duration
                </label>
                <input
                  type="text"
                  value={reportedDuration}
                  onChange={(e) => setReportedDuration(e.target.value)}
                  placeholder="e.g., 3 days, 2 weeks"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Location
                </label>
                <input
                  type="text"
                  value={reportedLocation}
                  onChange={(e) => setReportedLocation(e.target.value)}
                  placeholder="e.g., left side of head, lower back"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Onset
                </label>
                <input
                  type="text"
                  value={reportedOnset}
                  onChange={(e) => setReportedOnset(e.target.value)}
                  placeholder="e.g., sudden, gradual"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Severity
                </label>
                <select
                  value={reportedSeverity}
                  onChange={(e) => setReportedSeverity(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                >
                  <option value="">Select severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Associated Factors
              </label>
              <textarea
                value={associatedFactors}
                onChange={(e) => setAssociatedFactors(e.target.value)}
                placeholder="Anything that makes it better or worse (e.g., rest, movement, certain foods)"
                style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                onClick={handleBack}
                style={{ padding: '12px 24px', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
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
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Loading intake form...</p>
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

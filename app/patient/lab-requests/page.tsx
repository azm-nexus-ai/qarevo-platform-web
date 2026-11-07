'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import { usePortalAction } from '@/lib/portal-action'
import { orderDateFromIso, orderDateToIso } from '@/lib/clinical-order-dates'
import { medicalUploadError } from '@/lib/clinical-upload'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import {
  bookPatientLabRequest,
  clearPortalSession,
  downloadMedicalRecord,
  getApiErrorDetail,
  getPatientLabRequests,
  isAuthError,
  readSessionMarker,
  uploadPatientLabResult,
  type PatientLabRequest,
  type PatientLabRequestsResponse,
} from '@/lib/api'

const blankResponse: PatientLabRequestsResponse = {
  test_requests: [],
  partner_labs: [],
  preparation: [],
  recent_uploads: [],
  summary: {
    requested_tests: 0,
    pending_tests: 0,
    completed_tests: 0,
    upcoming_lab_appointment: null,
    estimated_completion: null,
  },
}

const planAllowed = (request: PatientLabRequest | null) => !!request && !request.result_file_id && !request.result_uploaded_at &&
  ['pending', 'booked', 'scheduled', 'requested', 'ordered'].includes(request.status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '))
const planUnavailable = 'This lab request can no longer be planned or rescheduled here. Contact your care team; existing results and clinical progress are preserved.'
const labStatusLabel = (status: string) => status.trim().toLowerCase() === 'booked' ? 'Patient-reported appointment' : status

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function LabRequestsPageContent() {
  const router = useRouter()
  const captureAction = usePortalAction()
  const operationInFlight = useRef(false)
  const refreshInFlight = useRef(false)
  const refreshVersion = useRef(0)
  const selectedRequestRef = useRef('')
  const planEdited = useRef(false)
  const [notice, setNotice] = useState('')
  const [validation, setValidation] = useState<Partial<Record<'request' | 'date' | 'time' | 'lab' | 'address', string>>>({})
  const bookingRef = useRef<HTMLDivElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [data, setData] = useState<PatientLabRequestsResponse>(blankResponse)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [detailsRequest, setDetailsRequest] = useState<PatientLabRequest | null>(null)
  const [appointmentLabName, setAppointmentLabName] = useState('')
  const [appointmentLabAddress, setAppointmentLabAddress] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [homeCollection, setHomeCollection] = useState(false)

  const selectedRequest = data.test_requests.find((item) => item.id === selectedRequestId) ?? null
  const canRecord = planAllowed(selectedRequest)
  const hasRequests = data.test_requests.length > 0

  const syncBookingFields = (request?: PatientLabRequest | null) => {
    planEdited.current = false
    setAppointmentLabName(request?.selected_lab_name || request?.recommended_lab_name || '')
    setAppointmentLabAddress(request?.selected_lab_address || request?.recommended_lab_address || '')
    const local = orderDateFromIso(request?.scheduled_for)
    setSelectedDate(local.slice(0, 10)); setSelectedTime(local.slice(11, 16))
    setHomeCollection(Boolean(request?.home_collection)); setValidation({}); setNotice('')
  }

  const applyResponse = (response: PatientLabRequestsResponse, preserveEdits = true) => {
    const selected = response.test_requests.find(item => item.id === selectedRequestRef.current) ?? response.test_requests[0] ?? null
    const sameRequest = selected?.id === selectedRequestRef.current
    selectedRequestRef.current = selected?.id || ''
    setData(response); setSelectedRequestId(selectedRequestRef.current)
    // Keep the selected request and its visit fields together. Never copy the
    // first request's values into another request or overwrite an active edit.
    if (!sameRequest || !preserveEdits || !planEdited.current) syncBookingFields(selected)
  }

  const refresh = async () => {
    if (operationInFlight.current || refreshInFlight.current) return
    refreshInFlight.current = true
    const version = ++refreshVersion.current
    const action = captureAction()
    const isCurrent = () => action.isCurrent() && version === refreshVersion.current
    setError(null); setLoading(true)
    try {
      const response = await getPatientLabRequests()
      if (!isCurrent()) return
      applyResponse(response)
    } catch (err) {
      if (!isCurrent()) return
      if (isAuthError(err)) { clearPortalSession(); router.replace('/auth/sign-in'); return }
      setError(getApiErrorDetail(err) ?? 'Unable to load lab requests right now. Reload saved requests to retry.')
    } finally {
      refreshInFlight.current = false
      if (isCurrent()) setLoading(false)
    }
  }

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/sign-in')
      return
    }
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const preparationItems = useMemo(() => {
    if (!selectedRequest) return []
    const specific = selectedRequest.preparation_instructions?.trim()
    return [
      specific ? { title: 'Doctor instruction', body: specific } : null,
      { title: 'Bring identification', body: 'Bring your ID and insurance card if the lab requests them.' },
      { title: 'Follow test guidance', body: 'Follow fasting or medication instructions from your doctor or lab before your visit.' },
    ].filter(Boolean) as Array<{ title: string; body: string }>
  }, [selectedRequest])

  const beginBooking = (request: PatientLabRequest) => {
    if (!planAllowed(request) || operationInFlight.current) return
    selectedRequestRef.current = request.id
    setSelectedRequestId(request.id)
    syncBookingFields(request)
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectRequest = (requestId: string) => {
    if (operationInFlight.current) return
    selectedRequestRef.current = requestId
    setSelectedRequestId(requestId)
    syncBookingFields(data.test_requests.find((item) => item.id === requestId))
  }

  const handleBook = async () => {
    if (operationInFlight.current || refreshInFlight.current) return
    setNotice(''); setError(null)
    if (!planAllowed(selectedRequest)) { setError(planUnavailable); return }
    const errors: typeof validation = {}
    if (!selectedRequest) errors.request = 'Choose the doctor-created request.'
    if (appointmentLabName.trim().length > 220) errors.lab = 'Use 220 characters or fewer for the laboratory name.'
    if (appointmentLabAddress.trim().length > 2000) errors.address = 'Use 2,000 characters or fewer for the laboratory address.'
    if (!appointmentLabName.trim()) errors.lab = 'Enter the laboratory or centre name you arranged the visit with.'
    if (!selectedDate) errors.date = 'Enter the date arranged with your laboratory.'
    if (!selectedTime) errors.time = 'Enter the time arranged with your laboratory.'
    let scheduledFor = ''
    if (selectedDate && selectedTime) {
      try { scheduledFor = orderDateToIso(`${selectedDate}T${selectedTime}`, selectedRequest?.scheduled_for) }
      catch (err) { errors.date = err instanceof Error ? err.message : 'Check your local date and time.' }
    }
    setValidation(errors)
    if (Object.keys(errors).length || !selectedRequest) return
    operationInFlight.current = true
    ++refreshVersion.current
    const action = captureAction()
    const requestId = selectedRequest.id
    setSaving(true)
    const formData = new FormData()
    formData.set('scheduled_for', scheduledFor)
    formData.set('lab_name', appointmentLabName.trim())
    formData.set('lab_address', appointmentLabAddress.trim())
    formData.set('home_collection', String(homeCollection))
    try {
      const response = await bookPatientLabRequest(requestId, formData)
      if (!action.isCurrent()) return
      applyResponse(response, false)
      setNotice('Your patient-reported visit is saved. Qarevo has not booked or contacted the laboratory.')
    } catch (err) { if (action.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to save your patient-reported visit. Your entries are still here; retry saving.') }
    finally { operationInFlight.current = false; if (action.isCurrent()) setSaving(false) }
  }

  const handleUpload = async (file?: File) => {
    if (!selectedRequest || !file || operationInFlight.current || refreshInFlight.current) return
    const uploadError = medicalUploadError(file.size)
    if (uploadError) { setError(uploadError); return }
    operationInFlight.current = true
    ++refreshVersion.current
    const action = captureAction()
    setSaving(true)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('note', `${selectedRequest.title} result uploaded by patient`)
    try {
      const response = await uploadPatientLabResult(selectedRequest.id, formData)
      if (!action.isCurrent()) return
      applyResponse(response)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    } catch (err) {
      if (action.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to upload this lab result.')
    } finally {
      operationInFlight.current = false
      if (action.isCurrent()) setSaving(false)
    }
  }

  const previewResult = async (fileId: string) => {
    const action = captureAction()
    try {
      const response = await downloadMedicalRecord(fileId, { disposition: 'inline' })
      if (!action.isCurrent()) return
      window.open(response.download_url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      if (action.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to preview this result.')
    }
  }

  const downloadRequests = () => {
    const lines = data.test_requests.map((item) => [
      `Title: ${item.title}`,
      `Status: ${labStatusLabel(item.status)}`,
      `Ordering physician: ${item.physician_name ?? 'Care team'}`,
      `Reason: ${item.reason ?? 'Not provided'}`,
      `Recommended completion: ${item.completionDate ?? item.recommended_date ?? 'Not scheduled'}`,
      `Recommended lab: ${item.recommended_lab_name || 'Any accredited laboratory'}`,
      `Recommended lab details: ${item.recommended_lab_address || 'Not specified'}`,
      `Patient-reported appointment: ${item.scheduledForLabel || 'Not recorded yet'}`,
      `Patient-reported laboratory: ${item.selected_lab_name || 'Not recorded yet'}`,
      '',
    ].join('\n'))
    downloadTextFile('lab-requests.txt', 'Patient-reported visits are not laboratory confirmations. Arrange visits directly with the laboratory. Saving in Qarevo does not book or contact the laboratory or confirm home collection.\n\n' + lines.join('\n'))
  }

  const rightRail = (
    <div className='lab-summary-card'>
      <p className='section-eyebrow'>Care summary</p>
      <h2 className='rail-title'>Diagnostic overview</h2>
      <div className='rail-grid'>
        <div className='rail-stat'><span>Outstanding tests</span><strong>{data.summary.pending_tests} pending</strong></div>
        <div className='rail-stat'><span>Patient-reported visit</span><strong>{data.summary.upcoming_lab_appointment ?? 'Not recorded'}</strong></div>
        <div className='rail-stat'><span>Estimated completion</span><strong>{data.summary.estimated_completion ?? 'Not provided'}</strong></div>
        <div className='rail-stat'><span>Completed results</span><strong>{data.summary.completed_tests}</strong></div>
      </div>
      <div className='rail-note'>Results uploaded here are saved into Medical Records as Lab Result files for authorized care-team review.</div>
    </div>
  )

  return (
    <PatientPortalShell
      eyebrow="Lab Results"
      title="Lab Requests"
      description="Doctor-ordered laboratory and diagnostic tests appear here after your care team creates them."
      rightRail={rightRail}
    >
      <style>{`
        * { box-sizing: border-box; }
        .lab-hero, .lab-card, .lab-summary-card { background: var(--surface); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid var(--border); box-shadow: ${Sh.card}; }
        .lab-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .lab-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .lab-summary-card { border-radius: 24px; padding: 18px; display: grid; gap: 10px; }
        .section-eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 800; color: ${T.slate2}; letter-spacing: 0.06em; text-transform: uppercase; }
        .rail-title { margin: 0 0 6px; font-size: 18px; font-weight: 800; color: ${T.navy}; }
        .rail-grid { display: grid; gap: 8px; }
        .rail-stat, .meta-item { padding: 10px 12px; border-radius: 12px; background: var(--surface-subtle); border: 1px solid var(--border); }
        .rail-stat span, .meta-item span { display: block; font-size: 10px; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
        .rail-stat strong, .meta-item strong { font-size: 12px; color: ${T.navy}; }
        .rail-note, .empty-box { padding: 14px; border-radius: 16px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 12px; font-weight: 700; line-height: 1.65; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: ${T.navy}; font-size: 13px; font-weight: 800; text-decoration: none; transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; cursor: pointer; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .request-card, .download-row { border-radius: 18px; padding: 16px; border: 1px solid var(--border); background: var(--surface-subtle); }
        .badge { display: inline-flex; align-items: center; justify-content: center; width: fit-content; max-width: 100%; padding: 7px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; line-height: 1.2; white-space: nowrap; }
        .status-badge { align-self: flex-start; flex: 0 0 auto; min-height: 28px; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 10px; }
        .select-input, .text-input { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 700; }
        .toggle-pill { min-height: 44px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 800; cursor: pointer; }
        .toggle-pill.active { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.24); }
        .modal-backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(3,28,41,0.42); display: grid; place-items: center; padding: 18px; }
        .modal-card { width: min(620px, 100%); max-height: 88vh; overflow: auto; border-radius: 24px; background: var(--surface); box-shadow: 0 24px 70px rgba(3,28,41,0.3); padding: 22px; }
        .icon-btn { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-subtle); color: ${T.navy}; cursor: pointer; font-size: 20px; line-height: 1; }
        @media (max-width: 720px) {
          .lab-hero, .lab-card { padding: 16px; border-radius: 22px; }
          .meta-grid { grid-template-columns: 1fr; }
          .action-btn, .toggle-pill { width: 100%; }
        }
      `}</style>

      <section className='lab-hero'>
        <p className='section-eyebrow'>Lab requests and diagnostic tests</p>
        <h1 style={{ margin: '8px 0', fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, color: T.navy }}>Everything your care team orders lives here</h1>
        <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
          New patients will see an empty state until a doctor creates a real lab request from the doctor portal.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href={PATIENT_ROUTES.dashboard} className='action-btn'>Return to Dashboard</Link>
          <button type='button' className='action-btn' onClick={() => void refresh()} disabled={saving || loading}>Reload saved requests</button>
          <button type='button' className='action-btn primary' onClick={downloadRequests} disabled={!hasRequests}>Download Requests</button>
        </div>
      </section>

      {notice && <div role='status' className='lab-card'>{notice}</div>}
      {error && <div role='alert' className='lab-card' style={{ color: T.red, border: '1px solid rgba(220,38,38,0.18)' }}>{error}</div>}
      {loading && <div className='lab-card'>Loading your lab requests...</div>}

      {!loading && (
        <>
          <section className='lab-card'>
            <p className='section-eyebrow'>Request summary</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>A quick overview</h2>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {[
                ['Requested tests', String(data.summary.requested_tests)],
                ['Pending tests', String(data.summary.pending_tests)],
                ['Completed tests', String(data.summary.completed_tests)],
                ['Patient-reported visit', data.summary.upcoming_lab_appointment ?? 'Not recorded'],
              ].map(([label, value]) => (
                <div key={label} className='meta-item'><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Diagnostic requests</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Ordered by your physician</h2>
            {!hasRequests ? (
              <div className='empty-box'>No lab requests yet. Once your doctor orders tests, they will appear here with actions to record an externally arranged visit and upload results.</div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {data.test_requests.map((item) => {
                  return (
                    <article key={item.id} className='request-card'>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <span className='badge' style={{ display: 'inline-flex', background: "var(--surface)", color: T.navy }}>{item.category ?? 'Diagnostic Test'}</span>
                          <h3 style={{ margin: '10px 0 4px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{item.title}</h3>
                          <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{item.description || 'No extra description provided yet.'}</p>
                        </div>
                        <span className='status-badge'><ClinicalStatusBadge status={item.status} domain='lab-request' label={labStatusLabel(item.status)} /></span>
                      </div>
                      <div className='meta-grid'>
                        <div className='meta-item'><span>Ordering physician</span><strong>{item.physician_name ?? 'Care team'}</strong></div>
                        <div className='meta-item'><span>Recommended lab</span><strong>{item.recommended_lab_name || 'Any accredited laboratory'}</strong></div>
                        <div className='meta-item'><span>Processing time</span><strong>{item.processing_time || 'Lab dependent'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <div style={{ fontSize: "13px", color: T.slate2 }}>Recommended completion: {item.completionDate ?? 'Not scheduled'}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button type='button' className='action-btn primary' onClick={() => beginBooking(item)} disabled={!planAllowed(item) || saving}>Record patient-reported visit</button>
                          <button type='button' className='action-btn' onClick={() => setDetailsRequest(item)}>View Details</button>
                          {item.result_file_id && <button type='button' className='action-btn' onClick={() => previewResult(item.result_file_id as string)}>Preview Result</button>}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section ref={bookingRef} className='lab-card'>
            <p className='section-eyebrow'>Patient-reported visit</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Record a visit arranged with your laboratory</h2>
            <p id='lab-plan-guidance' style={{ color: T.slate, lineHeight: 1.7 }}>Arrange the visit directly with the laboratory. Saving here does not book or contact the laboratory, verify availability, or confirm home collection. Dates and times use your device’s local timezone.</p>
            {!hasRequests ? (
              <div className='empty-box'>A doctor-created request is required before you can record an externally arranged visit.</div>
            ) : (
              <>
                {selectedRequest && (
                  <div className='empty-box' style={{ marginBottom: '12px' }}>
                    Doctor guidance: {selectedRequest.recommended_lab_name || 'Any accredited laboratory'}{selectedRequest.recommended_lab_address ? ` - ${selectedRequest.recommended_lab_address}` : ''}
                  </div>
                )}
                <label><span id='patient-lab-request-label' className='section-eyebrow'>Request (required)</span><select aria-labelledby='patient-lab-request-label' className='select-input' value={selectedRequestId} disabled={saving} onChange={(event) => selectRequest(event.target.value)}>{data.test_requests.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                {!canRecord && <p role='status' className='empty-box'>{planUnavailable}</p>}
                <fieldset disabled={saving || !canRecord} aria-describedby='lab-plan-guidance' style={{ border: 0, margin: '12px 0 0', padding: 0, minWidth: 0 }}>
                <div className='form-grid'>
                  <label><span id='lab-plan-date-label' className='section-eyebrow'>Date (required)</span><input aria-labelledby='lab-plan-date-label' required className='select-input' type='date' value={selectedDate} aria-invalid={Boolean(validation.date)} aria-describedby={validation.date ? 'lab-plan-date-error' : undefined} onChange={(event) => { planEdited.current = true; setSelectedDate(event.target.value) }} />{validation.date && <span id='lab-plan-date-error' role='alert'>{validation.date}</span>}</label>
                  <label><span id='lab-plan-time-label' className='section-eyebrow'>Time (required)</span><input aria-labelledby='lab-plan-time-label' required className='select-input' type='time' value={selectedTime} aria-invalid={Boolean(validation.time)} aria-describedby={validation.time ? 'lab-plan-time-error' : undefined} onChange={(event) => { planEdited.current = true; setSelectedTime(event.target.value) }} />{validation.time && <span id='lab-plan-time-error' role='alert'>{validation.time}</span>}</label>
                  <label><span id='lab-plan-name-label' className='section-eyebrow'>Lab or centre name (required)</span><input aria-labelledby='lab-plan-name-label' required className='text-input' value={appointmentLabName} aria-invalid={Boolean(validation.lab)} aria-describedby={validation.lab ? 'lab-plan-name-error' : undefined} onChange={(event) => { planEdited.current = true; setAppointmentLabName(event.target.value) }} placeholder='Laboratory you arranged the visit with' />{validation.lab && <span id='lab-plan-name-error' role='alert'>{validation.lab}</span>}</label>
                  <label><span id='lab-plan-address-label' className='section-eyebrow'>Address or branch (optional)</span><input aria-labelledby='lab-plan-address-label' aria-invalid={Boolean(validation.address)} aria-describedby={validation.address ? 'lab-plan-address-error' : undefined} className='text-input' value={appointmentLabAddress} onChange={(event) => { planEdited.current = true; setAppointmentLabAddress(event.target.value) }} placeholder='Optional address or branch details' />{validation.address && <span id='lab-plan-address-error' role='alert'>{validation.address}</span>}</label>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button type='button' aria-pressed={homeCollection} className={`toggle-pill ${homeCollection ? 'active' : ''}`} onClick={() => { planEdited.current = true; setHomeCollection((value) => !value) }}>Home collection arranged with laboratory</button>
                  <button type='button' className='action-btn primary' onClick={handleBook}>{saving ? 'Saving visit…' : 'Save patient-reported visit'}</button>
                </div>
                </fieldset>
              </>
            )}
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Test preparation</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Prepare with confidence</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {preparationItems.length === 0 ? <div className='empty-box'>Preparation notes will appear after you select a request.</div> : preparationItems.map((item) => (
                <div key={item.title} className='download-row'>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div className='icon-btn' style={{ color: T.link }}><Ico p={ICONS.check} size={16} sw={1.8} /></div>
                    <div><div style={{ fontSize: '13px', fontWeight: 800, color: T.navy }}>{item.title}</div><div style={{ fontSize: "13px", color: T.slate, lineHeight: 1.65, marginTop: '3px' }}>{item.body}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Results tracker</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Status timeline</h2>
            <div className='meta-grid'>
              {['Pending', 'Booked', 'Collected', 'Processing', 'Results Available'].map((step) => (
                <div key={step} className='meta-item'><span>{labStatusLabel(step)}</span><strong>{data.test_requests.filter((item) => item.status.toLowerCase() === step.toLowerCase()).length}</strong></div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Upload external results</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Add results completed elsewhere</h2>
            {!hasRequests ? (
              <div className='empty-box'>A result must attach to a doctor-created lab request, so uploads are disabled until a request exists.</div>
            ) : (
              <div className='download-row'>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: T.navy }}>{selectedRequest?.title ?? 'Selected lab request'}</div>
                  <div style={{ fontSize: "13px", color: T.slate2, marginTop: '3px' }}>PDF, PNG, JPG, or WEBP. Stored in Medical Records after upload.</div>
                </div>
                <input ref={uploadInputRef} type='file' accept='.pdf,image/png,image/jpeg,image/webp' style={{ display: 'none' }} onChange={(event) => handleUpload(event.target.files?.[0])} />
                <button type='button' className='action-btn primary' onClick={() => uploadInputRef.current?.click()} disabled={saving}>{saving ? 'Uploading...' : 'Upload Result'}</button>
              </div>
            )}
            {data.recent_uploads.length > 0 && (
              <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                {data.recent_uploads.map((item) => (
                  <div key={item.file_id} className='download-row'>
                    <div><div style={{ fontSize: '13px', fontWeight: 800, color: T.navy }}>{item.title}</div><div style={{ fontSize: "13px", color: T.slate2, marginTop: '3px' }}>{item.meta}</div></div>
                    <button type='button' className='action-btn' onClick={() => previewResult(item.file_id)}>Preview</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Patient actions</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Stay connected to care</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button type='button' className='action-btn primary' onClick={downloadRequests} disabled={!hasRequests}>Download Requests</button>
              <button type='button' className='action-btn' onClick={() => router.push('/patient/messages')} disabled={!selectedRequest?.provider_id}>Message Physician</button>
              <button type='button' className='action-btn' onClick={() => selectedRequest && beginBooking(selectedRequest)} disabled={!canRecord || saving}>Record patient-reported visit</button>
            </div>
          </section>
        </>
      )}

      {detailsRequest && (
        <div className='modal-backdrop' role='dialog' aria-modal='true' onClick={() => setDetailsRequest(null)}>
          <div className='modal-card' onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <p className='section-eyebrow'>{detailsRequest.category ?? 'Lab request'}</p>
                <h2 style={{ margin: '0 0 6px', color: T.navy }}>{detailsRequest.title}</h2>
                <p style={{ margin: 0, color: T.slate }}>{detailsRequest.physician_name ?? 'Care team'} | {labStatusLabel(detailsRequest.status)}</p>
              </div>
              <button type='button' className='icon-btn' aria-label='Close lab request details' onClick={() => setDetailsRequest(null)}>x</button>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
              <div className='meta-item'><span>Description</span><strong>{detailsRequest.description || 'No description provided.'}</strong></div>
              <div className='meta-item'><span>Reason</span><strong>{detailsRequest.reason || 'No reason provided.'}</strong></div>
              <div className='meta-item'><span>Doctor recommendation</span><strong>{detailsRequest.recommended_lab_name || 'Any accredited laboratory'}</strong></div>
              <div className='meta-item'><span>Recommendation details</span><strong>{detailsRequest.recommended_lab_address || 'No specific centre or address provided.'}</strong></div>
              <div className='meta-item'><span>Patient-reported visit</span><strong>{detailsRequest.scheduledForLabel || 'Not recorded yet'}</strong></div>
              <div className='meta-item'><span>Patient recorded lab</span><strong>{detailsRequest.selected_lab_name || 'Not recorded yet'}</strong></div>
              <div className='meta-item'><span>Patient lab address</span><strong>{detailsRequest.selected_lab_address || 'Not recorded yet'}</strong></div>
            </div>
          </div>
        </div>
      )}
    </PatientPortalShell>
  )
}

export default function LabRequestsPage() {
  return (
    <Suspense>
      <LabRequestsPageContent />
    </Suspense>
  )
}

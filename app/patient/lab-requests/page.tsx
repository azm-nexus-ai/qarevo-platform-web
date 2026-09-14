'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import {
  bookPatientLabRequest,
  clearAuthTokens,
  downloadMedicalRecord,
  getApiErrorDetail,
  getPatientLabRequests,
  isAuthError,
  readAccessToken,
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

const statusTone = (status: string) => {
  const lower = status.toLowerCase()
  if (lower.includes('result') || lower.includes('complete')) return { bg: 'rgba(15,158,119,0.12)', color: '#0F9E77' }
  if (lower.includes('book')) return { bg: 'rgba(165,224,218,0.24)', color: T.navy }
  if (lower.includes('progress') || lower.includes('process')) return { bg: 'rgba(32,181,223,0.12)', color: T.blue }
  return { bg: 'rgba(247,158,27,0.12)', color: '#B35C00' }
}

const toIso = (date: string, time: string) => {
  if (!date || !time) return ''
  return new Date(`${date}T${time}`).toISOString()
}

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
  const [selectedTime, setSelectedTime] = useState('09:30')
  const [homeCollection, setHomeCollection] = useState(false)

  const selectedRequest = data.test_requests.find((item) => item.id === selectedRequestId) ?? data.test_requests[0] ?? null
  const hasRequests = data.test_requests.length > 0

  const syncBookingFields = (request?: PatientLabRequest | null) => {
    setAppointmentLabName(request?.selected_lab_name || request?.recommended_lab_name || '')
    setAppointmentLabAddress(request?.selected_lab_address || request?.recommended_lab_address || '')
  }

  const refresh = async () => {
    setError(null)
    try {
      const response = await getPatientLabRequests()
      setData(response)
      const firstRequest = response.test_requests[0]
      setSelectedRequestId((current) => current || firstRequest?.id || '')
      if (firstRequest) syncBookingFields(firstRequest)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setError(getApiErrorDetail(err) ?? 'Unable to load lab requests right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
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
    setSelectedRequestId(request.id)
    syncBookingFields(request)
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectRequest = (requestId: string) => {
    setSelectedRequestId(requestId)
    syncBookingFields(data.test_requests.find((item) => item.id === requestId))
  }

  const handleBook = async () => {
    if (!selectedRequest || !appointmentLabName.trim() || !selectedDate || !selectedTime) {
      setError('Choose a request, enter the lab or centre name, date, and time before saving the appointment.')
      return
    }
    setSaving(true)
    setError(null)
    const formData = new FormData()
    formData.set('scheduled_for', toIso(selectedDate, selectedTime))
    formData.set('lab_name', appointmentLabName.trim())
    formData.set('lab_address', appointmentLabAddress.trim())
    formData.set('home_collection', String(homeCollection))
    try {
      const response = await bookPatientLabRequest(selectedRequest.id, formData)
      setData(response)
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to save this lab appointment.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (file?: File) => {
    if (!selectedRequest || !file) return
    setSaving(true)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('note', `${selectedRequest.title} result uploaded by patient`)
    try {
      const response = await uploadPatientLabResult(selectedRequest.id, formData)
      setData(response)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to upload this lab result.')
    } finally {
      setSaving(false)
    }
  }

  const previewResult = async (fileId: string) => {
    try {
      const response = await downloadMedicalRecord(fileId, { disposition: 'inline' })
      window.open(response.download_url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to preview this result.')
    }
  }

  const downloadRequests = () => {
    const lines = data.test_requests.map((item) => [
      `Title: ${item.title}`,
      `Status: ${item.status}`,
      `Ordering physician: ${item.physician_name ?? 'Care team'}`,
      `Reason: ${item.reason ?? 'Not provided'}`,
      `Recommended completion: ${item.completionDate ?? item.recommended_date ?? 'Not scheduled'}`,
      `Recommended lab: ${item.recommended_lab_name || 'Any accredited laboratory'}`,
      `Recommended lab details: ${item.recommended_lab_address || 'Not specified'}`,
      `Patient appointment: ${item.scheduledForLabel || 'Not recorded yet'}`,
      `Patient booked at: ${item.selected_lab_name || 'Not recorded yet'}`,
      '',
    ].join('\n'))
    downloadTextFile('lab-requests.txt', lines.join('\n'))
  }

  const rightRail = (
    <div className='lab-summary-card'>
      <p className='section-eyebrow'>Care summary</p>
      <h2 className='rail-title'>Diagnostic overview</h2>
      <div className='rail-grid'>
        <div className='rail-stat'><span>Outstanding tests</span><strong>{data.summary.pending_tests} pending</strong></div>
        <div className='rail-stat'><span>Upcoming lab appointment</span><strong>{data.summary.upcoming_lab_appointment ?? 'Not booked'}</strong></div>
        <div className='rail-stat'><span>Estimated completion</span><strong>{data.summary.estimated_completion ?? 'Pending booking'}</strong></div>
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
        .lab-hero, .lab-card, .lab-summary-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .lab-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .lab-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .lab-summary-card { border-radius: 24px; padding: 18px; display: grid; gap: 10px; }
        .section-eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 800; color: ${T.slate2}; letter-spacing: 0.06em; text-transform: uppercase; }
        .rail-title { margin: 0 0 6px; font-size: 18px; font-weight: 800; color: ${T.navy}; }
        .rail-grid { display: grid; gap: 8px; }
        .rail-stat, .meta-item { padding: 10px 12px; border-radius: 12px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.06); }
        .rail-stat span, .meta-item span { display: block; font-size: 10px; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
        .rail-stat strong, .meta-item strong { font-size: 12px; color: ${T.navy}; }
        .rail-note, .empty-box { padding: 14px; border-radius: 16px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 12px; font-weight: 700; line-height: 1.65; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 800; text-decoration: none; transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; cursor: pointer; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .request-card, .download-row { border-radius: 18px; padding: 16px; border: 1px solid rgba(4,53,77,0.08); background: rgba(247,250,252,0.92); }
        .badge { display: inline-flex; align-items: center; justify-content: center; width: fit-content; max-width: 100%; padding: 7px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; line-height: 1.2; white-space: nowrap; }
        .status-badge { align-self: flex-start; flex: 0 0 auto; min-height: 28px; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
        .select-input, .text-input { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.08); background: rgba(255,255,255,0.95); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 700; }
        .toggle-pill { min-height: 44px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.08); background: rgba(255,255,255,0.9); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 800; cursor: pointer; }
        .toggle-pill.active { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.24); }
        .modal-backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(3,28,41,0.42); display: grid; place-items: center; padding: 18px; }
        .modal-card { width: min(620px, 100%); max-height: 88vh; overflow: auto; border-radius: 24px; background: white; box-shadow: 0 24px 70px rgba(3,28,41,0.3); padding: 22px; }
        .icon-btn { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; border: 1px solid rgba(4,53,77,0.1); background: rgba(247,250,252,0.96); color: ${T.navy}; cursor: pointer; font-size: 20px; line-height: 1; }
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
          <button type='button' className='action-btn primary' onClick={downloadRequests} disabled={!hasRequests}>Download Requests</button>
        </div>
      </section>

      {error && <div className='lab-card' style={{ color: T.red, border: '1px solid rgba(220,38,38,0.18)' }}>{error}</div>}
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
                ['Upcoming appointment', data.summary.upcoming_lab_appointment ?? 'Not booked'],
              ].map(([label, value]) => (
                <div key={label} className='meta-item'><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <p className='section-eyebrow'>Diagnostic requests</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Ordered by your physician</h2>
            {!hasRequests ? (
              <div className='empty-box'>No lab requests yet. Once your doctor orders tests, they will appear here with booking and upload actions.</div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {data.test_requests.map((item) => {
                  const tone = statusTone(item.status)
                  return (
                    <article key={item.id} className='request-card'>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <span className='badge' style={{ display: 'inline-flex', background: 'white', color: T.navy }}>{item.category ?? 'Diagnostic Test'}</span>
                          <h3 style={{ margin: '10px 0 4px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{item.title}</h3>
                          <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{item.description || 'No extra description provided yet.'}</p>
                        </div>
                        <span className='badge status-badge' style={{ background: tone.bg, color: tone.color }}>{item.status}</span>
                      </div>
                      <div className='meta-grid'>
                        <div className='meta-item'><span>Ordering physician</span><strong>{item.physician_name ?? 'Care team'}</strong></div>
                        <div className='meta-item'><span>Recommended lab</span><strong>{item.recommended_lab_name || 'Any accredited laboratory'}</strong></div>
                        <div className='meta-item'><span>Processing time</span><strong>{item.processing_time || 'Lab dependent'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: T.slate2 }}>Recommended completion: {item.completionDate ?? 'Not scheduled'}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button type='button' className='action-btn primary' onClick={() => beginBooking(item)}>Record Appointment</button>
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
            <p className='section-eyebrow'>Booking section</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Record the lab visit you booked</h2>
            {!hasRequests ? (
              <div className='empty-box'>Booking opens after a doctor creates a lab request.</div>
            ) : (
              <>
                {selectedRequest && (
                  <div className='empty-box' style={{ marginBottom: '12px' }}>
                    Doctor guidance: {selectedRequest.recommended_lab_name || 'Any accredited laboratory'}{selectedRequest.recommended_lab_address ? ` - ${selectedRequest.recommended_lab_address}` : ''}
                  </div>
                )}
                <div className='form-grid'>
                  <label><span className='section-eyebrow'>Request</span><select className='select-input' value={selectedRequestId} onChange={(event) => selectRequest(event.target.value)}>{data.test_requests.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                  <label><span className='section-eyebrow'>Date</span><input className='select-input' type='date' value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
                  <label><span className='section-eyebrow'>Time</span><input className='select-input' type='time' value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} /></label>
                  <label><span className='section-eyebrow'>Lab or centre name</span><input className='text-input' value={appointmentLabName} onChange={(event) => setAppointmentLabName(event.target.value)} placeholder='Name of the lab you booked with' /></label>
                  <label><span className='section-eyebrow'>Address or branch</span><input className='text-input' value={appointmentLabAddress} onChange={(event) => setAppointmentLabAddress(event.target.value)} placeholder='Optional address or branch details' /></label>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button type='button' className={`toggle-pill ${homeCollection ? 'active' : ''}`} onClick={() => setHomeCollection((value) => !value)}>Home sample collection</button>
                  <button type='button' className='action-btn primary' onClick={handleBook} disabled={saving}>{saving ? 'Saving...' : 'Save appointment'}</button>
                </div>
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
                    <div className='icon-btn' style={{ color: T.blue }}><Ico p={ICONS.check} size={16} sw={1.8} /></div>
                    <div><div style={{ fontSize: '13px', fontWeight: 800, color: T.navy }}>{item.title}</div><div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65, marginTop: '3px' }}>{item.body}</div></div>
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
                <div key={step} className='meta-item'><span>{step}</span><strong>{data.test_requests.filter((item) => item.status.toLowerCase() === step.toLowerCase()).length}</strong></div>
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
                  <div style={{ fontSize: '11px', color: T.slate2, marginTop: '3px' }}>PDF, PNG, JPG, or WEBP. Stored in Medical Records after upload.</div>
                </div>
                <input ref={uploadInputRef} type='file' accept='.pdf,image/png,image/jpeg,image/webp' style={{ display: 'none' }} onChange={(event) => handleUpload(event.target.files?.[0])} />
                <button type='button' className='action-btn primary' onClick={() => uploadInputRef.current?.click()} disabled={saving}>{saving ? 'Uploading...' : 'Upload Result'}</button>
              </div>
            )}
            {data.recent_uploads.length > 0 && (
              <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                {data.recent_uploads.map((item) => (
                  <div key={item.file_id} className='download-row'>
                    <div><div style={{ fontSize: '13px', fontWeight: 800, color: T.navy }}>{item.title}</div><div style={{ fontSize: '11px', color: T.slate2, marginTop: '3px' }}>{item.meta}</div></div>
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
              <button type='button' className='action-btn' onClick={() => selectedRequest && beginBooking(selectedRequest)} disabled={!selectedRequest}>Record Lab Appointment</button>
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
                <p style={{ margin: 0, color: T.slate }}>{detailsRequest.physician_name ?? 'Care team'} | {detailsRequest.status}</p>
              </div>
              <button type='button' className='icon-btn' aria-label='Close lab request details' onClick={() => setDetailsRequest(null)}>x</button>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
              <div className='meta-item'><span>Description</span><strong>{detailsRequest.description || 'No description provided.'}</strong></div>
              <div className='meta-item'><span>Reason</span><strong>{detailsRequest.reason || 'No reason provided.'}</strong></div>
              <div className='meta-item'><span>Doctor recommendation</span><strong>{detailsRequest.recommended_lab_name || 'Any accredited laboratory'}</strong></div>
              <div className='meta-item'><span>Recommendation details</span><strong>{detailsRequest.recommended_lab_address || 'No specific centre or address provided.'}</strong></div>
              <div className='meta-item'><span>Scheduled visit</span><strong>{detailsRequest.scheduledForLabel || 'Not booked yet'}</strong></div>
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

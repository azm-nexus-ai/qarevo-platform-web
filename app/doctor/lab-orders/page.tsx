'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { currentPortal } from '@/lib/portal-scope'
import { readAccountScope } from '@/lib/account-storage'
import { labResultTarget } from '@/lib/doctor-lab-notifications'
import { labUploadAttempt, labUploadReceipt, type LabUploadAttempt } from '@/lib/lab-upload-attempt'
import { useNavigationGuard } from 'nextjs-nav-guard'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import SecureDocumentAccessDialog from '@/components/ui/SecureDocumentAccessDialog'
import { usePortalAction } from '@/lib/portal-action'
import { medicalUploadError } from '@/lib/clinical-upload'
import { orderDateFromIso, orderDateToIso } from '@/lib/clinical-order-dates'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  clearPortalSession,
  createDoctorLabOrder,
  deleteDoctorLabOrder,
  getApiErrorDetail,
  getDoctorLabOrders,
  getDoctorLabResultAccess,
  getDoctorPatients,
  isAuthError,
  readSessionMarker,
  updateDoctorLabOrder,
  uploadDoctorLabResult,
  type DoctorLabOrderPayload,
  type DoctorPatient,
  type PatientLabRequest,
} from '@/lib/api'

const emptyForm: DoctorLabOrderPayload = {
  patient_id: '',
  episode_id: '',
  title: '',
  category: '',
  test: '',
  status: 'Pending',
  scheduled_for: '',
  recommended_date: '',
  recommended_lab_name: '',
  recommended_lab_address: '',
  description: '',
  reason: '',
  priority: 'Routine',
  processing_time: '',
  preparation_instructions: '',
}

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  padding: '12px 14px',
  borderRadius: '12px',
  border: "1px solid var(--border)",
  background: "var(--surface-glass)",
  color: T.navy,
  fontSize: '14px',
  fontWeight: 600,
  outline: 'none',
} as const

function DoctorLabOrdersPageContent() {
  const router = useRouter()
  const renderedScope = readAccountScope('doctor'), renderedPath = usePathname()
  const directoryGeneration = useRef(0)
  const parameters = useSearchParams()
  const renderedQuery = parameters.toString()
  const isRenderedContext = useCallback(() => currentPortal() === 'doctor' && renderedScope === readAccountScope('doctor') && window.location.pathname === renderedPath && new URLSearchParams(window.location.search).toString() === renderedQuery, [renderedScope, renderedPath, renderedQuery])
  const linked = useMemo(() => labResultTarget(new URLSearchParams(parameters.toString())), [parameters])
  const linkedKey = JSON.stringify(linked)
  const appliedLink = useRef('')
  const dirtyRef = useRef(false)
  const uploadAttempt = useRef<LabUploadAttempt | null>(null)
  const [failedUpload, setFailedUpload] = useState<{ orderId: string; file: File; note: string } | null>(null)
  const [uploadNotice, setUploadNotice] = useState('')
  const [patientListAttempt, setPatientListAttempt] = useState(0)
  const [patientListState, setPatientListState] = useState<{ attempt: number; error: string } | null>(null)
  const captureAction = usePortalAction()
  const operationInFlight = useRef(false)
  const readVersion = useRef(0)
  const patientScope = useRef('')
  const baseline = useRef({ ...emptyForm })
  const originalDates = useRef<{ scheduled_for?: string | null; recommended_date?: string | null }>({})
  const [pendingChange, setPendingChange] = useState<null | { patientId: string } | { edit: PatientLabRequest } | { cancel: true }>(null)
  const [documentAccess, setDocumentAccess] = useState<{ patientId: string; orderId: string; fileId: string; title: string } | null>(null)
  const closeDocumentAccess = useCallback(() => setDocumentAccess(null), [])
  const loadDocument = useCallback(() => {
    if (!documentAccess || documentAccess.patientId !== patientScope.current || !isRenderedContext()) return Promise.reject(new Error('Choose the patient and refresh this result.'))
    return getDoctorLabResultAccess(documentAccess.patientId, documentAccess.orderId)
  }, [documentAccess, isRenderedContext])
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [labTests, setLabTests] = useState<PatientLabRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DoctorLabOrderPayload>(emptyForm)

  const dirty = showAddForm && JSON.stringify(form) !== JSON.stringify(baseline.current)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  const patientsReady = patientListState?.attempt === patientListAttempt && !patientListState.error
  const navigation = useNavigationGuard({ enabled: ({ to }) => (dirty || saving) && !to.startsWith('/auth/') })

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.patient_id === selectedPatientId),
    [patients, selectedPatientId],
  )

  const fetchLabTests = useCallback(async (patientId = patientScope.current) => {
    if (!patientId || operationInFlight.current || !isRenderedContext()) return
    const action = captureAction()
    const version = ++readVersion.current
    const isCurrent = () => action.isCurrent() && isRenderedContext() && version === readVersion.current && patientId === patientScope.current
    setLoading(true); setError(null)
    try {
      const data = await getDoctorLabOrders(patientId)
      if (isCurrent()) setLabTests(data.test_requests || [])
    } catch (err) {
      if (!isCurrent()) return
      if (isAuthError(err)) { router.replace('/auth/doctor/login'); return }
      setError(getApiErrorDetail(err) ?? 'Unable to load lab orders. Use Refresh to retry.')
    } finally { if (isCurrent()) setLoading(false) }
  }, [captureAction, router, isRenderedContext])

  const changePatient = useCallback((patientId: string) => {
    if (operationInFlight.current || !isRenderedContext()) return
    ++readVersion.current
    patientScope.current = patientId
    setDocumentAccess(null)
    uploadAttempt.current = null; setFailedUpload(null); setUploadNotice('')
    setSelectedPatientId(patientId); setLabTests([]); setShowAddForm(false)
    setEditingId(null); setError(null); setLoading(false)
    baseline.current = { ...emptyForm, patient_id: patientId }
    originalDates.current = {}
    setForm(baseline.current); setPendingChange(null)
    if (patientId) void fetchLabTests(patientId)
  }, [fetchLabTests, isRenderedContext])
  const handlePatientChange = (patientId: string) => {
    if (operationInFlight.current) return
    if (dirty) setPendingChange({ patientId })
    else changePatient(patientId)
  }

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/doctor/login')
      return
    }

    const action = captureAction(), controller = new AbortController(), generation = ++directoryGeneration.current
    let current = true
    const isCurrent = () => current && generation === directoryGeneration.current && action.isCurrent() && isRenderedContext()
    const fetchPatients = async () => {
      try {
        const [data, exact] = await Promise.all([getDoctorPatients(undefined, {}, undefined, undefined, controller.signal), linked.target ? getDoctorPatients(undefined, {}, undefined, linked.target.patientId, controller.signal) : Promise.resolve(null)])
        if (!isCurrent()) return
        const available = exact && linked.target ? [...(data.patients || []).filter(patient => patient.patient_id !== linked.target!.patientId), ...(exact.patients || []).filter(patient => patient.patient_id === linked.target!.patientId)] : data.patients || []
        setPatients(available); setPatientListState({ attempt: patientListAttempt, error: '' })
        if (linked.target && appliedLink.current !== linkedKey && !dirtyRef.current && !operationInFlight.current && available.some(item => item.patient_id === linked.target!.patientId)) {
          appliedLink.current = linkedKey; changePatient(linked.target.patientId)
        }
      } catch (err) {
        if (!isCurrent()) return
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        const message = getApiErrorDetail(err) ?? 'Unable to load your patients.'
        setError(message); setPatientListState({ attempt: patientListAttempt, error: message })
      }
    }

    fetchPatients()
    return () => { current = false; controller.abort() }
  }, [router, captureAction, patientListAttempt, linked, linkedKey, changePatient, isRenderedContext])

  const beginEdit = (test: PatientLabRequest) => {
    setEditingId(test.id)
    setShowAddForm(true)
    const nextForm = {
      patient_id: selectedPatientId,
      episode_id: test.episode_id ?? '',
      title: test.title,
      category: test.category ?? '',
      test: test.test ?? '',
      status: test.status || 'Pending',
      scheduled_for: orderDateFromIso(test.scheduled_for),
      recommended_date: orderDateFromIso(test.recommended_date),
      recommended_lab_name: test.recommended_lab_name ?? '',
      recommended_lab_address: test.recommended_lab_address ?? '',
      description: test.description ?? '',
      reason: test.reason ?? '',
      priority: test.priority ?? 'Routine',
      processing_time: test.processing_time ?? '',
      preparation_instructions: test.preparation_instructions ?? '',
    }
    baseline.current = nextForm
    originalDates.current = { scheduled_for: test.scheduled_for, recommended_date: test.recommended_date }
    setForm(nextForm); setPendingChange(null)
  }

  const resetForm = () => {
    setEditingId(null)
    setShowAddForm(false)
    baseline.current = { ...emptyForm, patient_id: patientScope.current }
    originalDates.current = {}
    setForm(baseline.current); setPendingChange(null)
  }

  // Serialize writes synchronously and bind their continuations to the patient,
  // portal, session and page that started the request.
  const beginMutation = () => {
    if (!patientScope.current || operationInFlight.current || !renderedScope || !isRenderedContext()) return null
    operationInFlight.current = true
    ++readVersion.current
    const action = captureAction()
    const patientId = patientScope.current
    setSaving(true); setLoading(false); setError(null)
    return { patientId, scope: action.scope, isCurrent: () => action.isCurrent() && isRenderedContext() && patientScope.current === patientId,
      finish: () => { operationInFlight.current = false; if (action.isCurrent() && isRenderedContext() && patientScope.current === patientId) setSaving(false) } }
  }

  const handleSave = async () => {
    if (!selectedPatientId || !form.title.trim()) { setError('Select a patient and enter a lab test title.'); return }
    let dates: { scheduled_for: string; recommended_date: string }
    try {
      dates = { scheduled_for: orderDateToIso(form.scheduled_for, originalDates.current.scheduled_for),
        recommended_date: orderDateToIso(form.recommended_date, originalDates.current.recommended_date) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the lab order dates.'); return }
    const operation = beginMutation()
    if (!operation) return
    try {
      const payload = { ...form, ...dates, patient_id: operation.patientId, title: form.title.trim() }
      const savedBaseline = { ...baseline.current,
        scheduled_for: orderDateToIso(baseline.current.scheduled_for, originalDates.current.scheduled_for),
        recommended_date: orderDateToIso(baseline.current.recommended_date, originalDates.current.recommended_date) }
      // Send only deliberate edits: unrelated changes made in another view must
      // not be replaced by this editor's older snapshot.
      const changes = Object.fromEntries(Object.entries(payload).filter(([key, value]) => key === 'patient_id' || value !== savedBaseline[key as keyof DoctorLabOrderPayload]))
      const response = editingId ? await updateDoctorLabOrder({ ...changes, patient_id: operation.patientId, test_id: editingId }) : await createDoctorLabOrder(payload)
      if (!operation.isCurrent()) return
      setLabTests(response.test_requests || []); resetForm()
    } catch (err) { if (operation.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to save this lab order. Your changes are still here.') }
    finally { operation.finish() }
  }

  const handleStatusChange = async (test: PatientLabRequest, status: string) => {
    const operation = beginMutation()
    if (!operation) return
    try {
      const response = await updateDoctorLabOrder({ patient_id: operation.patientId, test_id: test.id, status })
      if (operation.isCurrent()) setLabTests(response.test_requests || [])
    } catch (err) { if (operation.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to update lab order status.') }
    finally { operation.finish() }
  }

  const handleDelete = async (testId: string) => {
    const operation = beginMutation()
    if (!operation) return
    try {
      const response = await deleteDoctorLabOrder(operation.patientId, testId)
      if (!operation.isCurrent()) return
      setLabTests(response.test_requests || [])
      if (editingId === testId) resetForm()
    } catch (err) { if (operation.isCurrent()) setError(getApiErrorDetail(err) ?? 'Unable to delete this lab order.') }
    finally { operation.finish() }
  }

  const handleUploadResult = async (test: PatientLabRequest, file?: File, retryNote?: string) => {
    if (!file) return
    if (test.can_upload_result !== true) { setError('Only the ordering clinician can upload a result for this request.'); return }
    const uploadError = medicalUploadError(file.size) || (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? 'Choose a PDF, PNG, JPEG or WebP file.' : null)
    if (uploadError) { setError(uploadError); return }
    const operation = beginMutation()
    if (!operation) return
    const note = retryNote ?? 'Lab result uploaded by clinician'
    setUploadNotice('')
    try {
      const attempt = await labUploadAttempt(uploadAttempt.current, JSON.stringify([operation.scope, operation.patientId, test.id]), file, note)
      if (!operation.isCurrent()) return
      uploadAttempt.current = attempt
      const formData = new FormData()
      formData.set('file', file); formData.set('note', attempt.note); formData.set('upload_id', attempt.uploadId)
      const response = await uploadDoctorLabResult(operation.patientId, test.id, formData)
      if (!operation.isCurrent()) return
      const receipt = labUploadReceipt(response.upload_receipt, attempt.uploadId)
      if (!receipt) throw new Error('Upload confirmation is unavailable. Retry this same file to recover its saved upload safely.')
      setLabTests(response.test_requests || []); uploadAttempt.current = null; setFailedUpload(null)
      setUploadNotice(receipt.current ? (receipt.replayed ? 'This upload was already saved. No second file was created.' : 'Result upload saved. Uploading does not record clinical review.') : 'The earlier upload was already recorded; it is no longer the current available result. Review this lab request before uploading again.')
    } catch (err) { if (operation.isCurrent()) { setFailedUpload({ orderId: test.id, file, note }); setError(getApiErrorDetail(err) ?? 'Unable to upload this lab result. Retry the same file safely.') } }
    finally { operation.finish() }
  }
  const linkedOrder = linked.target?.patientId === selectedPatientId ? labTests.find(test => test.id === linked.target?.requestId && test.patient_id === linked.target.patientId) : null
  const linkedFileMatches = Boolean(linkedOrder?.result_file_id && linkedOrder.result_file_id === linked.target?.fileId)

  return (
    <div className='doctor-lab-page'>
      <style>{`
        .doctor-lab-page { display: grid; gap: 18px; }
        .dl-card { background: var(--surface); backdrop-filter: blur(22px) saturate(175%); -webkit-backdrop-filter: blur(22px) saturate(175%); border: 1px solid var(--border); border-radius: 20px; box-shadow: ${Sh.card}; padding: 22px; }
        .dl-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .dl-btn { min-height: 42px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: ${T.navy}; padding: 0 14px; font-size: 13px; font-weight: 800; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .dl-btn:hover, .dl-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .dl-btn.primary { border: none; background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: white; }
        .dl-btn.danger { color: ${T.red}; border-color: rgba(220,38,38,0.18); background: rgba(220,38,38,0.06); }
        .dl-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
        .dl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px; }
        .dl-field { display: grid; gap: 6px; }
        .dl-field span, .dl-eyebrow { font-size: 11px; font-weight: 800; color: ${T.slate2}; letter-spacing: 0.06em; text-transform: uppercase; }
        .dl-order[data-notification-target=true] { border-color:var(--focus-ring); box-shadow:0 0 0 1px var(--focus-ring); scroll-margin-top:100px; }
        .dl-order { border-radius: 18px; border: 1px solid var(--border); background: var(--surface-subtle); padding: 16px; display: grid; gap: 12px; }
        .dl-meta { display: flex; gap: 10px; flex-wrap: wrap; color: ${T.slate2}; font-size: 12px; font-weight: 700; }
        .dl-empty { padding: 28px; border-radius: 18px; background: rgba(32,181,223,0.08); color: ${T.blue}; text-align: center; font-weight: 800; }
        @media (max-width: 700px) { .dl-card { padding: 16px; border-radius: 18px; } .dl-btn { width: 100%; } .dl-header { display: grid; } }
      `}</style>

      {(linked.target || linked.invalid) && <section aria-label='Selected lab result' className='dl-card'>
        <h2 className='portal-h2'>Result selected from notifications</h2>
        <p className='text-sm leading-7 text-secondary'>{linked.invalid ? 'This result link is invalid. Open an update from your notification inbox.' : !patientsReady ? 'Confirming access to the selected patient…' : !patients.some(patient => patient.patient_id === linked.target?.patientId) ? 'The selected patient is not available to this clinician account.' : selectedPatientId !== linked.target?.patientId ? 'Choose the selected patient to view this order. Unsaved changes must be resolved first.' : loading ? 'Loading the selected order…' : error ? 'The selected result could not be confirmed. Refresh the order list to retry.' : !linkedOrder ? 'The selected order is no longer available to this account.' : !linkedFileMatches ? linkedOrder.result_file_id ? 'This notification refers to a different upload. The current result shown below is a separate file; it has not been opened automatically.' : 'The referenced result file is no longer available. No file has been opened automatically.' : 'The exact file from this notification is selected. Use Open selected result below to request access. No clinical review has been recorded.'}</p>
        <div className='mt-3 flex flex-wrap gap-3'>{linkedOrder && <button className='dl-btn' onClick={() => { const order = document.getElementById(`lab-order-${linkedOrder.id}`); order?.focus(); order?.scrollIntoView({ block: 'center' }) }}>Jump to selected order</button>}<Link href='/doctor/notifications' className='portal-button portal-button-secondary q-button q-button-secondary'>Back to result updates</Link>
          {patientsReady && linked.target && patients.some(patient => patient.patient_id === linked.target?.patientId) && selectedPatientId !== linked.target.patientId && <button className='dl-btn' disabled={saving} onClick={() => handlePatientChange(linked.target!.patientId)}>Show selected patient</button>}
        </div>
      </section>}
      {patientListState?.error && <div role='alert' className='dl-card'><p>{patientListState.error}</p><button className='dl-btn' onClick={() => setPatientListAttempt(value => value + 1)}>Retry patient list</button></div>}
      {uploadNotice && <p role='status' className='dl-card text-sm text-secondary'>{uploadNotice}</p>}

      <div className='dl-header'>
        <div>
          <p className='dl-eyebrow' style={{ margin: 0 }}>Doctor workspace</p>
          <h1 style={{ margin: '6px 0 4px', fontSize: '28px', fontWeight: 800, color: T.navy }}>Lab Orders</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate }}>Create, update, and track patient lab requests that appear in the patient portal.</p>
        </div>
        <button className='dl-btn primary' type='button' onClick={() => setShowAddForm(true)} disabled={!selectedPatientId || saving} aria-expanded={showAddForm}>Order Lab Test</button>
      </div>

      {error && <div role='alert' className='dl-card' style={{ color: T.red, border: '1px solid rgba(220,38,38,0.2)' }}>{error}</div>}

      <section className='dl-card'>
        <label className='dl-field'>
          <span id='doctor-lab-patient-label'>Select patient</span>
          <select aria-labelledby='doctor-lab-patient-label' style={inputStyle} value={selectedPatientId} onChange={(event) => handlePatientChange(event.target.value)} disabled={saving}>
            <option value=''>Choose a patient</option>
            {patients.map((patient) => (
              <option key={patient.patient_id} value={patient.patient_id}>
                {patient.name || patient.email || patient.patient_id}
              </option>
            ))}
          </select>
        </label>
        {selectedPatient && (
          <div style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', background: 'rgba(32,181,223,0.08)', color: T.navy, fontWeight: 800 }}>
            {selectedPatient.name || selectedPatient.email} selected
          </div>
        )}
      </section>

      {showAddForm && selectedPatientId && (
        <section className='dl-card'>
          <div className='dl-header' style={{ marginBottom: '14px' }}>
            <div>
              <p className='dl-eyebrow' style={{ margin: 0 }}>{editingId ? 'Edit request' : 'New request'}</p>
              <h2 style={{ margin: '5px 0 0', color: T.navy }}>{editingId ? 'Update lab order' : 'Order a lab test'}</h2>
            </div>
            <button className='dl-btn' type='button' onClick={() => dirty ? setPendingChange({ cancel: true }) : resetForm()} disabled={saving}>Cancel</button>
          </div>
          <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className='dl-grid'>
            <label className='dl-field'><span>Test title (required)</span><input style={inputStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder='Complete Blood Count' /></label>
            <label className='dl-field'><span>Category</span><input style={inputStyle} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder='Blood Test' /></label>
            <label className='dl-field'><span>Specific test</span><input style={inputStyle} value={form.test} onChange={(event) => setForm({ ...form, test: event.target.value })} placeholder='CBC' /></label>
            <label className='dl-field'><span id='doctor-lab-priority-label'>Priority</span><select aria-labelledby='doctor-lab-priority-label' style={inputStyle} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Routine</option><option>Urgent</option><option>High</option></select></label>
            <label className='dl-field'><span id='doctor-lab-status-label'>Status</span><select aria-labelledby='doctor-lab-status-label' style={inputStyle} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Pending</option><option>Booked</option><option>Collected</option><option>Processing</option><option>Results Available</option><option>Completed</option></select></label>
            <label className='dl-field'><span>Recommended by</span><input style={inputStyle} type='datetime-local' value={form.recommended_date} onChange={(event) => setForm({ ...form, recommended_date: event.target.value })} /></label>
            <label className='dl-field'><span>Known appointment time</span><input style={inputStyle} type='datetime-local' value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} /></label>
            <label className='dl-field'><span>Processing time</span><input style={inputStyle} value={form.processing_time} onChange={(event) => setForm({ ...form, processing_time: event.target.value })} placeholder='24 hrs' /></label>
            <label className='dl-field'><span>Recommended lab</span><input style={inputStyle} value={form.recommended_lab_name} onChange={(event) => setForm({ ...form, recommended_lab_name: event.target.value })} placeholder='Any accredited laboratory' /></label>
            <label className='dl-field'><span>Recommended lab details</span><input style={inputStyle} value={form.recommended_lab_address} onChange={(event) => setForm({ ...form, recommended_lab_address: event.target.value })} placeholder='Optional address, branch, or instruction' /></label>
          </div>
          <div className='dl-grid' style={{ marginTop: '12px' }}>
            <label className='dl-field'><span>Patient-facing description</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className='dl-field'><span>Reason for test</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <label className='dl-field'><span>Preparation instructions</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.preparation_instructions} onChange={(event) => setForm({ ...form, preparation_instructions: event.target.value })} /></label>
          </div>
          <button className='dl-btn primary' type='button' onClick={handleSave} disabled={saving} style={{ marginTop: '14px' }}>
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Lab Request'}
          </button>
          </fieldset>
          <p style={{ margin: '12px 0 0', color: T.slate2, fontSize: '13px' }}>Dates and times use your device’s local timezone. Changes remain unsaved until you save this request.</p>
        </section>
      )}

      <section className='dl-card'>
        <div className='dl-header' style={{ marginBottom: '14px' }}>
          <div>
            <p className='dl-eyebrow' style={{ margin: 0 }}>Patient requests</p>
            <h2 style={{ margin: '5px 0 0', color: T.navy }}>Lab test orders</h2>
          </div>
          <button className='dl-btn' type='button' onClick={() => fetchLabTests()} disabled={!selectedPatientId || loading || saving}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
        {!selectedPatientId && <div className='dl-empty'>Choose a patient to view or create lab requests.</div>}
        {loading && <p role='status'>Loading lab requests…</p>}
        {selectedPatientId && !loading && !error && labTests.length === 0 && <div className='dl-empty'>No lab requests yet for this patient.</div>}
        <div style={{ display: 'grid', gap: '12px' }}>
          {labTests.map((test) => (
            <article className='dl-order' key={test.id} id={`lab-order-${test.id}`} tabIndex={linked.target?.requestId === test.id ? -1 : undefined} data-lab-order-id={test.id} data-notification-target={linked.target?.requestId === test.id ? 'true' : undefined}>
              <div className='dl-header'>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: T.navy }}>{test.title}</h3>
                  <p style={{ margin: 0, color: T.slate }}>{test.description || test.test || 'No description added.'}</p>
                </div>
                <select
                  aria-label={`Status for ${test.title}`}
                  style={{ ...inputStyle, width: '190px' }}
                  value={test.status}
                  onChange={(event) => handleStatusChange(test, event.target.value)}
                  disabled={saving || showAddForm}
                >
                  <option>Pending</option>
                  <option>Booked</option>
                  <option>Collected</option>
                  <option>Processing</option>
                  <option>Results Available</option>
                  <option>Completed</option>
                </select>
              </div>
              <div className='dl-meta'>
                <span>Category: {test.category || 'Diagnostic Test'}</span>
                <span>Priority: {test.priority || 'Routine'}</span>
                <span>Recommended: {test.completionDate || test.recommended_date || 'Not set'}</span>
                <span>Recommended lab: {test.recommended_lab_name || 'Any accredited lab'}</span>
                {test.result_filename && <span>Result: {test.result_filename}</span>}
              </div>
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                  <div className='dl-eyebrow'>Doctor lab guidance</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.recommended_lab_name || 'Any accredited laboratory'}</div>
                  {test.recommended_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.recommended_lab_address}</div>}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                  <div className='dl-eyebrow'>Patient recorded appointment</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.selected_lab_name || 'Not recorded yet'}</div>
                  <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.scheduledForLabel || test.scheduled_for || 'No date recorded'}{test.home_collection ? ' - home collection' : ''}</div>
                  {test.selected_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.selected_lab_address}</div>}
                </div>
              </div>
              {test.reason && <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>Reason: {test.reason}</p>}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {test.result_file_id ? <button className='dl-btn' type='button' aria-haspopup='dialog' aria-label={`Open result for ${test.title}`} disabled={saving}
                  onClick={() => setDocumentAccess(current => current ?? { patientId: patientScope.current, orderId: test.id, fileId: test.result_file_id!, title: test.title })}>{linked.target?.requestId === test.id ? linkedFileMatches ? 'Open selected result' : 'Open current result (different upload)' : 'Open result'}</button>
                  : <span className='text-sm text-muted'>No result file available.</span>}
                <button className='dl-btn' type='button' onClick={() => dirty ? setPendingChange({ edit: test }) : beginEdit(test)} disabled={saving}>Edit</button>
                <input
                  id={`lab-result-${test.id}`}
                  type='file'
                  accept='.pdf,image/png,image/jpeg,image/webp'
                  disabled={saving || showAddForm || test.can_upload_result !== true}
                  style={{ display: 'none' }}
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void handleUploadResult(test, file) }}
                />
                <button className='dl-btn primary' type='button' disabled={saving || showAddForm || test.can_upload_result !== true} onClick={() => document.getElementById(`lab-result-${test.id}`)?.click()}>
                  Upload Result
                </button>
                {test.can_upload_result !== true && <span className='text-sm text-secondary'>Only the ordering clinician can upload a result for this request.</span>}
                {failedUpload?.orderId === test.id && <button className='dl-btn' type='button' disabled={saving} onClick={() => void handleUploadResult(test, failedUpload.file, failedUpload.note)}>Retry result upload</button>}
                <button className='dl-btn danger' type='button' onClick={() => handleDelete(test.id)} disabled={saving || showAddForm}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {documentAccess && <SecureDocumentAccessDialog key={`${documentAccess.patientId}:${documentAccess.orderId}:${documentAccess.fileId}`}
        documentTitle={documentAccess.title} documentKind='Lab result' expectedFileId={documentAccess.fileId} loadDocument={loadDocument} onClose={closeDocumentAccess} />}
      <UnsavedChangesDialog open={pendingChange !== null || navigation.active} busy={saving}
        onKeepEditing={() => { setPendingChange(null); if (navigation.active) navigation.reject() }}
        onDiscard={() => {
          if (pendingChange && 'patientId' in pendingChange) changePatient(pendingChange.patientId)
          else if (pendingChange && 'edit' in pendingChange) beginEdit(pendingChange.edit)
          else if (pendingChange) resetForm()
          else navigation.accept()
        }} />
    </div>
  )
}

function DoctorLabOrdersRoute() {
  const parameters = useSearchParams()
  return <DoctorLabOrdersPageContent key={parameters.toString()} />
}
export default function DoctorLabOrdersPage() {
  return <Suspense fallback={<p role='status' className='text-secondary'>Loading lab orders…</p>}><DoctorLabOrdersRoute /></Suspense>
}

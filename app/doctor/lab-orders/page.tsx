'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  clearAuthTokens,
  createDoctorLabOrder,
  deleteDoctorLabOrder,
  getApiErrorDetail,
  getDoctorLabOrders,
  getDoctorPatients,
  isAuthError,
  readAccessToken,
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
  border: '1px solid rgba(4,53,77,0.1)',
  background: 'rgba(255,255,255,0.95)',
  color: T.navy,
  fontSize: '14px',
  fontWeight: 600,
  outline: 'none',
} as const

function toIso(value?: string) {
  if (!value) return ''
  return new Date(value).toISOString()
}

function fromIso(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

export default function DoctorLabOrdersPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [labTests, setLabTests] = useState<PatientLabRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DoctorLabOrderPayload>(emptyForm)

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.patient_id === selectedPatientId),
    [patients, selectedPatientId],
  )

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    const fetchPatients = async () => {
      try {
        const data = await getDoctorPatients()
        setPatients(data.patients || [])
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/doctor/login')
          return
        }
        setError(getApiErrorDetail(err) ?? 'Unable to load your patients.')
      }
    }

    fetchPatients()
  }, [router])

  const fetchLabTests = async (patientId = selectedPatientId) => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getDoctorLabOrders(patientId)
      setLabTests(data.test_requests || [])
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/doctor/login')
        return
      }
      setError(getApiErrorDetail(err) ?? 'Unable to load lab orders.')
    } finally {
      setLoading(false)
    }
  }

  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId)
    setLabTests([])
    setShowAddForm(false)
    setEditingId(null)
    setForm({ ...emptyForm, patient_id: patientId })
    if (patientId) fetchLabTests(patientId)
  }

  const beginEdit = (test: PatientLabRequest) => {
    setEditingId(test.id)
    setShowAddForm(true)
    setForm({
      patient_id: selectedPatientId,
      episode_id: test.episode_id ?? '',
      title: test.title,
      category: test.category ?? '',
      test: test.test ?? '',
      status: test.status || 'Pending',
      scheduled_for: fromIso(test.scheduled_for),
      recommended_date: fromIso(test.recommended_date),
      recommended_lab_name: test.recommended_lab_name ?? '',
      recommended_lab_address: test.recommended_lab_address ?? '',
      description: test.description ?? '',
      reason: test.reason ?? '',
      priority: test.priority ?? 'Routine',
      processing_time: test.processing_time ?? '',
      preparation_instructions: test.preparation_instructions ?? '',
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setShowAddForm(false)
    setForm({ ...emptyForm, patient_id: selectedPatientId })
  }

  const handleSave = async () => {
    if (!selectedPatientId || !form.title.trim()) return
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      patient_id: selectedPatientId,
      title: form.title.trim(),
      scheduled_for: toIso(form.scheduled_for),
      recommended_date: toIso(form.recommended_date),
    }
    try {
      const response = editingId
        ? await updateDoctorLabOrder({ ...payload, test_id: editingId })
        : await createDoctorLabOrder(payload)
      setLabTests(response.test_requests || [])
      resetForm()
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to save this lab order.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (test: PatientLabRequest, status: string) => {
    if (!selectedPatientId) return
    setSaving(true)
    setError(null)
    try {
      const response = await updateDoctorLabOrder({
        patient_id: selectedPatientId,
        test_id: test.id,
        status,
      })
      setLabTests(response.test_requests || [])
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to update lab order status.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (testId: string) => {
    if (!selectedPatientId) return
    setSaving(true)
    setError(null)
    try {
      const response = await deleteDoctorLabOrder(selectedPatientId, testId)
      setLabTests(response.test_requests || [])
      if (editingId === testId) resetForm()
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to delete this lab order.')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadResult = async (test: PatientLabRequest, file?: File) => {
    if (!selectedPatientId || !file) return
    setSaving(true)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('note', `${test.title} result uploaded by doctor`)
    try {
      const response = await uploadDoctorLabResult(selectedPatientId, test.id, formData)
      setLabTests(response.test_requests || [])
    } catch (err) {
      setError(getApiErrorDetail(err) ?? 'Unable to upload this lab result.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='doctor-lab-page'>
      <style>{`
        .doctor-lab-page { display: grid; gap: 18px; }
        .dl-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(175%); -webkit-backdrop-filter: blur(22px) saturate(175%); border: 1px solid rgba(255,255,255,0.9); border-radius: 20px; box-shadow: ${Sh.card}; padding: 22px; }
        .dl-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .dl-btn { min-height: 42px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: white; color: ${T.navy}; padding: 0 14px; font-size: 13px; font-weight: 800; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .dl-btn:hover, .dl-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .dl-btn.primary { border: none; background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: white; }
        .dl-btn.danger { color: ${T.red}; border-color: rgba(220,38,38,0.18); background: rgba(220,38,38,0.06); }
        .dl-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
        .dl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .dl-field { display: grid; gap: 6px; }
        .dl-field span, .dl-eyebrow { font-size: 11px; font-weight: 800; color: ${T.slate2}; letter-spacing: 0.06em; text-transform: uppercase; }
        .dl-order { border-radius: 18px; border: 1px solid rgba(4,53,77,0.08); background: rgba(247,250,252,0.92); padding: 16px; display: grid; gap: 12px; }
        .dl-meta { display: flex; gap: 10px; flex-wrap: wrap; color: ${T.slate2}; font-size: 12px; font-weight: 700; }
        .dl-empty { padding: 28px; border-radius: 18px; background: rgba(32,181,223,0.08); color: ${T.blue}; text-align: center; font-weight: 800; }
        @media (max-width: 700px) { .dl-card { padding: 16px; border-radius: 18px; } .dl-btn { width: 100%; } .dl-header { display: grid; } }
      `}</style>

      <div className='dl-header'>
        <div>
          <p className='dl-eyebrow' style={{ margin: 0 }}>Doctor workspace</p>
          <h1 style={{ margin: '6px 0 4px', fontSize: '28px', fontWeight: 800, color: T.navy }}>Lab Orders</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate }}>Create, update, and track patient lab requests that appear in the patient portal.</p>
        </div>
        <button className='dl-btn primary' type='button' onClick={() => setShowAddForm(true)} disabled={!selectedPatientId}>Order Lab Test</button>
      </div>

      {error && <div className='dl-card' style={{ color: T.red, border: '1px solid rgba(220,38,38,0.2)' }}>{error}</div>}

      <section className='dl-card'>
        <label className='dl-field'>
          <span>Select patient</span>
          <select style={inputStyle} value={selectedPatientId} onChange={(event) => handlePatientChange(event.target.value)}>
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
            <button className='dl-btn' type='button' onClick={resetForm}>Cancel</button>
          </div>
          <div className='dl-grid'>
            <label className='dl-field'><span>Test title</span><input style={inputStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder='Complete Blood Count' /></label>
            <label className='dl-field'><span>Category</span><input style={inputStyle} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder='Blood Test' /></label>
            <label className='dl-field'><span>Specific test</span><input style={inputStyle} value={form.test} onChange={(event) => setForm({ ...form, test: event.target.value })} placeholder='CBC' /></label>
            <label className='dl-field'><span>Priority</span><select style={inputStyle} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Routine</option><option>Urgent</option><option>High</option></select></label>
            <label className='dl-field'><span>Status</span><select style={inputStyle} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Pending</option><option>Booked</option><option>Collected</option><option>Processing</option><option>Results Available</option><option>Completed</option></select></label>
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
          <button className='dl-btn primary' type='button' onClick={handleSave} disabled={saving || !form.title.trim()} style={{ marginTop: '14px' }}>
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Lab Request'}
          </button>
        </section>
      )}

      <section className='dl-card'>
        <div className='dl-header' style={{ marginBottom: '14px' }}>
          <div>
            <p className='dl-eyebrow' style={{ margin: 0 }}>Patient requests</p>
            <h2 style={{ margin: '5px 0 0', color: T.navy }}>Lab test orders</h2>
          </div>
          <button className='dl-btn' type='button' onClick={() => fetchLabTests()} disabled={!selectedPatientId || loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
        {!selectedPatientId && <div className='dl-empty'>Choose a patient to view or create lab requests.</div>}
        {selectedPatientId && !loading && labTests.length === 0 && <div className='dl-empty'>No lab requests yet for this patient.</div>}
        <div style={{ display: 'grid', gap: '12px' }}>
          {labTests.map((test) => (
            <article className='dl-order' key={test.id}>
              <div className='dl-header'>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: T.navy }}>{test.title}</h3>
                  <p style={{ margin: 0, color: T.slate }}>{test.description || test.test || 'No description added.'}</p>
                </div>
                <select
                  style={{ ...inputStyle, width: '190px' }}
                  value={test.status}
                  onChange={(event) => handleStatusChange(test, event.target.value)}
                  disabled={saving}
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
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <div className='dl-eyebrow'>Doctor lab guidance</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.recommended_lab_name || 'Any accredited laboratory'}</div>
                  {test.recommended_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: '12px' }}>{test.recommended_lab_address}</div>}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <div className='dl-eyebrow'>Patient recorded appointment</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.selected_lab_name || 'Not recorded yet'}</div>
                  <div style={{ marginTop: '2px', color: T.slate, fontSize: '12px' }}>{test.scheduledForLabel || test.scheduled_for || 'No date recorded'}{test.home_collection ? ' - home collection' : ''}</div>
                  {test.selected_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: '12px' }}>{test.selected_lab_address}</div>}
                </div>
              </div>
              {test.reason && <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>Reason: {test.reason}</p>}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className='dl-btn' type='button' onClick={() => beginEdit(test)}>Edit</button>
                <input
                  id={`lab-result-${test.id}`}
                  type='file'
                  accept='.pdf,image/png,image/jpeg,image/webp'
                  style={{ display: 'none' }}
                  onChange={(event) => handleUploadResult(test, event.target.files?.[0])}
                />
                <label className='dl-btn primary' htmlFor={`lab-result-${test.id}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Upload Result
                </label>
                <button className='dl-btn danger' type='button' onClick={() => handleDelete(test.id)} disabled={saving}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

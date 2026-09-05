'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getDoctorPatients,
  isAuthError,
  readAccessToken,
  type DoctorPatient,
} from '@/lib/api'

type LabTest = {
  id: string
  title: string
  category: string
  test: string
  status: string
  scheduled_for: string
  detail: string
  created_at: string
  created_by: string
}

export default function DoctorLabOrdersPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [labTests, setLabTests] = useState<LabTest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTest, setNewTest] = useState({
    title: '',
    category: '',
    test: '',
    status: 'Pending',
    scheduled_for: '',
    detail: '',
    episode_id: '',
  })
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('')

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
        console.error('Failed to load patients', err)
      }
    }

    fetchPatients()
  }, [router])

  const fetchLabTests = async () => {
    if (!selectedPatientId) return
    
    setLoading(true)
    setError(null)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/lab-orders/${selectedPatientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch lab tests')
      }
      
      const data = await response.json()
      setLabTests(data.test_requests || [])
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/doctor/login')
        return
      }
      console.error('Failed to load lab tests', err)
      setError('Unable to load lab tests')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLabTest = async () => {
    if (!selectedPatientId || !newTest.title) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/lab-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          ...newTest,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to order lab test')
      }
      
      const data = await response.json()
      setLabTests(data.test_requests || [])
      setNewTest({
        title: '',
        category: '',
        test: '',
        status: 'Pending',
        scheduled_for: '',
        detail: '',
        episode_id: '',
      })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to order lab test', err)
      setError('Failed to order lab test')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLabTest = async (testId: string) => {
    if (!selectedPatientId) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/lab-orders/${selectedPatientId}/${testId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete lab test')
      }
      
      const data = await response.json()
      setLabTests(data.test_requests || [])
    } catch (err) {
      console.error('Failed to delete lab test', err)
      setError('Failed to delete lab test')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Lab Orders</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage patient lab test orders</p>
        </div>
      </div>

      {/* Patient Selection */}
      <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(22px) saturate(175%)', WebkitBackdropFilter: 'blur(22px) saturate(175%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.88)', boxShadow: Sh.card, padding: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: T.navy, marginBottom: '12px' }}>Select Patient</label>
        <select
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.1)',
            fontSize: '15px',
            outline: 'none',
            background: 'white',
            color: T.navy,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <option value="" style={{ color: T.slate2 }}>-- Choose a patient --</option>
          {patients.map((patient) => (
            <option key={patient.patient_id} value={patient.patient_id} style={{ color: T.navy }}>
              {patient.name || patient.email} {patient.email && patient.name ? `(${patient.email})` : ''}
            </option>
          ))}
        </select>
        {selectedPatientId && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(32,181,223,0.08)', borderRadius: '8px', border: '1px solid rgba(32,181,223,0.2)' }}>
            <p style={{ margin: 0, fontSize: '13px', color: T.navy, fontWeight: 600 }}>
              {patients.find(p => p.patient_id === selectedPatientId)?.name || 'Patient selected'}
            </p>
          </div>
        )}
        <button
          onClick={fetchLabTests}
          disabled={loading || !selectedPatientId}
          style={{
            marginTop: '16px',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            background: loading || !selectedPatientId ? 'rgba(32,181,223,0.5)' : 'rgba(32,181,223,1)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading || !selectedPatientId ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Loading...' : 'Load Lab Tests'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '16px', color: T.red }}>{error}</div>
      )}

      {/* Add Lab Test Button */}
      {selectedPatientId && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(32,181,223,1)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : 'Order Lab Test'}
        </button>
      )}

      {/* Add Lab Test Form */}
      {showAddForm && (
        <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(22px) saturate(175%)', WebkitBackdropFilter: 'blur(22px) saturate(175%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.88)', boxShadow: Sh.card, padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: T.navy }}>New Lab Test Order</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Episode ID (Optional)</label>
              <input
                type="text"
                value={newTest.episode_id}
                onChange={(e) => setNewTest({ ...newTest, episode_id: e.target.value })}
                placeholder="CWS Episode ID"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Test Title *</label>
              <input
                type="text"
                value={newTest.title}
                onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                placeholder="e.g., CBC"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Category</label>
              <input
                type="text"
                value={newTest.category}
                onChange={(e) => setNewTest({ ...newTest, category: e.target.value })}
                placeholder="e.g., Blood work"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Specific Test</label>
              <input
                type="text"
                value={newTest.test}
                onChange={(e) => setNewTest({ ...newTest, test: e.target.value })}
                placeholder="e.g., Complete Blood Count"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Status</label>
              <select
                value={newTest.status}
                onChange={(e) => setNewTest({ ...newTest, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="Pending">Pending</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Collection Booked">Collection Booked</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Scheduled For</label>
              <input
                type="text"
                value={newTest.scheduled_for}
                onChange={(e) => setNewTest({ ...newTest, scheduled_for: e.target.value })}
                placeholder="e.g., Tomorrow, Friday, or specific date"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Additional Details</label>
              <textarea
                value={newTest.detail}
                onChange={(e) => setNewTest({ ...newTest, detail: e.target.value })}
                placeholder="Any additional instructions or notes"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <button
              onClick={handleAddLabTest}
              disabled={loading || !newTest.title}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: loading || !newTest.title ? 'rgba(32,181,223,0.5)' : 'rgba(32,181,223,1)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !newTest.title ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Ordering...' : 'Order Lab Test'}
            </button>
          </div>
        </div>
      )}

      {/* Lab Tests List */}
      {labTests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: T.navy }}>Lab Test Orders</h2>
          {labTests.map((test) => (
            <div
              key={test.id}
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(22px) saturate(175%)',
                WebkitBackdropFilter: 'blur(22px) saturate(175%)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.88)',
                boxShadow: Sh.card,
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: T.navy }}>{test.title}</h3>
                  {test.test && (
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: T.slate2 }}>{test.test}</p>
                  )}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Status: {test.status}</span>
                    {test.category && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Category: {test.category}</span>
                    )}
                    {test.scheduled_for && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: T.blue }}>Scheduled: {test.scheduled_for}</span>
                    )}
                  </div>
                  {test.detail && (
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.slate2 }}>{test.detail}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteLabTest(test.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'rgba(220,38,38,0.1)',
                    color: T.red,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {labTests.length === 0 && selectedPatientId && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.slate2 }}>
          <p>No lab test orders found for this patient</p>
        </div>
      )}
    </div>
  )
}

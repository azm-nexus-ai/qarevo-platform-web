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

type Medication = {
  id: string
  name: string
  brand: string
  strength: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  food: string
  times: string[]
  refill: string
  status: string
  created_at: string
  created_by: string
}

export default function DoctorPrescriptionsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMed, setNewMed] = useState({
    name: '',
    brand: '',
    strength: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    food: '',
    times: [] as string[],
    refill: '',
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

  const fetchMedications = async () => {
    if (!selectedPatientId) return
    
    setLoading(true)
    setError(null)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/prescriptions/${selectedPatientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch medications')
      }
      
      const data = await response.json()
      setMedications(data.medications || [])
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/doctor/login')
        return
      }
      console.error('Failed to load medications', err)
      setError('Unable to load medications')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMedication = async () => {
    if (!selectedPatientId || !newMed.name || !newMed.strength) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/prescriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          ...newMed,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to add medication')
      }
      
      const data = await response.json()
      setMedications(data.medications || [])
      setNewMed({
        name: '',
        brand: '',
        strength: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
        food: '',
        times: [],
        refill: '',
        episode_id: '',
      })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add medication', err)
      setError('Failed to add medication')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMedication = async (medId: string) => {
    if (!selectedPatientId) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/prescriptions/${selectedPatientId}/${medId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete medication')
      }
      
      const data = await response.json()
      setMedications(data.medications || [])
    } catch (err) {
      console.error('Failed to delete medication', err)
      setError('Failed to delete medication')
    } finally {
      setLoading(false)
    }
  }

  const handleTimeToggle = (time: string) => {
    if (newMed.times.includes(time)) {
      setNewMed({ ...newMed, times: newMed.times.filter(t => t !== time) })
    } else {
      setNewMed({ ...newMed, times: [...newMed.times, time] })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Prescriptions</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage patient medications</p>
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
          onClick={fetchMedications}
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
          {loading ? 'Loading...' : 'Load Medications'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '16px', color: T.red }}>{error}</div>
      )}

      {/* Add Medication Button */}
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
          {showAddForm ? 'Cancel' : 'Add Medication'}
        </button>
      )}

      {/* Add Medication Form */}
      {showAddForm && (
        <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(22px) saturate(175%)', WebkitBackdropFilter: 'blur(22px) saturate(175%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.88)', boxShadow: Sh.card, padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: T.navy }}>New Medication</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Episode ID (Optional)</label>
              <input
                type="text"
                value={newMed.episode_id}
                onChange={(e) => setNewMed({ ...newMed, episode_id: e.target.value })}
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Medication Name *</label>
              <input
                type="text"
                value={newMed.name}
                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                placeholder="e.g., Amlodipine"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Brand</label>
              <input
                type="text"
                value={newMed.brand}
                onChange={(e) => setNewMed({ ...newMed, brand: e.target.value })}
                placeholder="e.g., Generic"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Strength *</label>
              <input
                type="text"
                value={newMed.strength}
                onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                placeholder="e.g., 5 mg"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Dosage</label>
              <input
                type="text"
                value={newMed.dosage}
                onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                placeholder="e.g., 1 tablet"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Frequency</label>
              <input
                type="text"
                value={newMed.frequency}
                onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                placeholder="e.g., Once daily"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Duration</label>
              <input
                type="text"
                value={newMed.duration}
                onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                placeholder="e.g., 30 days"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Instructions</label>
              <textarea
                value={newMed.instructions}
                onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                placeholder="Special instructions"
                rows={2}
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
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Food</label>
              <input
                type="text"
                value={newMed.food}
                onChange={(e) => setNewMed({ ...newMed, food: e.target.value })}
                placeholder="e.g., Take with food"
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Times of Day</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Morning', 'Afternoon', 'Evening', 'Night'].map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeToggle(time)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: newMed.times.includes(time) ? 'rgba(32,181,223,0.1)' : 'rgba(255,255,255,0.88)',
                      color: newMed.times.includes(time) ? 'rgba(32,181,223,1)' : T.slate2,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Refill Status</label>
              <input
                type="text"
                value={newMed.refill}
                onChange={(e) => setNewMed({ ...newMed, refill: e.target.value })}
                placeholder="e.g., Refill ready"
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
            
            <button
              onClick={handleAddMedication}
              disabled={loading || !newMed.name || !newMed.strength}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: loading || !newMed.name || !newMed.strength ? 'rgba(32,181,223,0.5)' : 'rgba(32,181,223,1)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !newMed.name || !newMed.strength ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Adding...' : 'Add Medication'}
            </button>
          </div>
        </div>
      )}

      {/* Medications List */}
      {medications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: T.navy }}>Current Medications</h2>
          {medications.map((med) => (
            <div
              key={med.id}
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
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: T.navy }}>{med.name} {med.brand && `(${med.brand})`}</h3>
                  <p style={{ margin: '0 0 8px', fontSize: '14px', color: T.slate2 }}>{med.strength} · {med.dosage} · {med.frequency}</p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Duration: {med.duration}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Status: {med.status}</span>
                    {med.times.length > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Times: {med.times.join(', ')}</span>
                    )}
                    {med.refill && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: T.green }}>{med.refill}</span>
                    )}
                  </div>
                  {med.instructions && (
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.slate2 }}>{med.instructions}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteMedication(med.id)}
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

      {medications.length === 0 && selectedPatientId && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.slate2 }}>
          <p>No medications found for this patient</p>
        </div>
      )}
    </div>
  )
}

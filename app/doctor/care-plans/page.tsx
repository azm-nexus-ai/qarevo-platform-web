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

type CarePlan = {
  id: string
  title: string
  status: string
  progress: number
  description: string
  created_at: string
  created_by: string
}

export default function DoctorCarePlansPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [carePlans, setCarePlans] = useState<CarePlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPlan, setNewPlan] = useState({ title: '', status: 'Active', progress: 0, description: '', episode_id: '' })
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

  const fetchCarePlans = async () => {
    if (!selectedPatientId) return
    
    setLoading(true)
    setError(null)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/care-plans/${selectedPatientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch care plans')
      }
      
      const data = await response.json()
      setCarePlans(data.care_plans || [])
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/doctor/login')
        return
      }
      console.error('Failed to load care plans', err)
      setError('Unable to load care plans')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCarePlan = async () => {
    if (!selectedPatientId || !newPlan.title) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/care-plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          ...newPlan,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create care plan')
      }
      
      const data = await response.json()
      setCarePlans(data.care_plans || [])
      setNewPlan({ title: '', status: 'Active', progress: 0, description: '', episode_id: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to create care plan', err)
      setError('Failed to create care plan')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCarePlan = async (planId: string) => {
    if (!selectedPatientId) return
    
    setLoading(true)
    try {
      const token = readAccessToken()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/doctor/care-plans/${selectedPatientId}/${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete care plan')
      }
      
      const data = await response.json()
      setCarePlans(data.care_plans || [])
    } catch (err) {
      console.error('Failed to delete care plan', err)
      setError('Failed to delete care plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Care Plans</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage patient care plans</p>
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
          onClick={fetchCarePlans}
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
          {loading ? 'Loading...' : 'Load Care Plans'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '16px', color: T.red }}>{error}</div>
      )}

      {/* Add Care Plan Button */}
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
          {showAddForm ? 'Cancel' : 'Add Care Plan'}
        </button>
      )}

      {/* Add Care Plan Form */}
      {showAddForm && (
        <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(22px) saturate(175%)', WebkitBackdropFilter: 'blur(22px) saturate(175%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.88)', boxShadow: Sh.card, padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: T.navy }}>New Care Plan</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Episode ID (Optional)</label>
              <input
                type="text"
                value={newPlan.episode_id}
                onChange={(e) => setNewPlan({ ...newPlan, episode_id: e.target.value })}
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Title</label>
              <input
                type="text"
                value={newPlan.title}
                onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                placeholder="Care plan title"
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
                value={newPlan.status}
                onChange={(e) => setNewPlan({ ...newPlan, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="Active">Active</option>
                <option value="Monitoring">Monitoring</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Progress ({newPlan.progress}%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={newPlan.progress}
                onChange={(e) => setNewPlan({ ...newPlan, progress: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '8px' }}>Description</label>
              <textarea
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="Care plan description"
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
              onClick={handleAddCarePlan}
              disabled={loading || !newPlan.title}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: loading || !newPlan.title ? 'rgba(32,181,223,0.5)' : 'rgba(32,181,223,1)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !newPlan.title ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create Care Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Care Plans List */}
      {carePlans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: T.navy }}>Existing Care Plans</h2>
          {carePlans.map((plan) => (
            <div
              key={plan.id}
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
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: T.navy }}>{plan.title}</h3>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', color: T.slate2 }}>{plan.description}</p>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Status: {plan.status}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2 }}>Progress: {plan.progress}%</span>
                  </div>
                  <div style={{ marginTop: '12px', height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'rgba(32,181,223,1)', borderRadius: '3px', width: `${plan.progress}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCarePlan(plan.id)}
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

      {carePlans.length === 0 && selectedPatientId && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.slate2 }}>
          <p>No care plans found for this patient</p>
        </div>
      )}
    </div>
  )
}

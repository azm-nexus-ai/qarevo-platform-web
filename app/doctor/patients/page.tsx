'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { readDoctorAuthSession } from '@/lib/doctor-auth-session'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

interface Patient {
  patient_id: string
  name: string
  email: string
  phone: string | null
  age: number
  gender: string
  last_visit: string | null
  total_consultations: number
  status: 'active' | 'inactive'
}

interface PatientsData {
  patients: Patient[]
  total_count: number
  filtered_count: number
}

export default function PatientsPage() {
  const router = useRouter()
  const [patientsData, setPatientsData] = useState<PatientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const session = readDoctorAuthSession()
        if (!session) {
          router.replace('/auth/doctor/login')
          return
        }
        const data = await apiGet<PatientsData>('/api/v1/doctor/patients/', {
          authToken: session.access_token,
        })
        setPatientsData(data)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load patients')
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading patients...</p>
      </div>
    )
  }

  if (error) {
    return <p style={{ color: T.red, fontSize: '14px' }}>{error}</p>
  }

  if (!patientsData) return null
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No completed visits'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Patients</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage your patient directory</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            padding: '10px 16px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(4,53,77,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Ico p={ICONS.search} size={16} sw={1.5} color={T.slate2} />
            <input
              type="text"
              placeholder="Search patients..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: T.navy,
                width: '200px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total Patients</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{patientsData.total_count}</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Active</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.green }}>{patientsData.patients.filter((p: Patient) => p.status === 'active').length}</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>New This Month</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.blue }}>2</p>
        </div>
      </div>

      {/* Patients List */}
      <div style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(4,53,77,0.06)' }}>
          <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Patient Directory</h3>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {patientsData.patients.map((patient: Patient) => (
              <div key={patient.patient_id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(247,250,252,0.6)',
                border: '1px solid rgba(4,53,77,0.04)',
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue, fontSize: '14px', fontWeight: 700 }}>
                    {patient.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{patient.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate2 }}>{patient.email} · {patient.phone}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: T.slate }}>
                      {patient.gender}, {patient.age} years · Last visit: {formatDate(patient.last_visit)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>Consultations</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: T.navy }}>{patient.total_consultations}</p>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: patient.status === 'active' ? 'rgba(15,158,119,0.12)' : 'rgba(109,135,151,0.12)',
                    color: patient.status === 'active' ? T.green : T.slate2
                  }}>
                    {patient.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
            <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>Showing 1-{patientsData.patients.length} of {patientsData.patients.length} patients</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.9)', color: T.slate2, fontSize: '12px', fontWeight: 600, cursor: 'not-allowed', opacity: 0.5 }}>
                Previous
              </button>
              <button disabled style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.9)', color: T.slate2, fontSize: '12px', fontWeight: 600, cursor: 'not-allowed', opacity: 0.5 }}>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

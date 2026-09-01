'use client'

import { useEffect, useState } from 'react'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { useRouter } from 'next/navigation'
import {
  clearAuthTokens,
  getDoctorPatients,
  isAuthError,
  readAccessToken,
  type DoctorPatient,
  type DoctorPatientsResponse,
} from '@/lib/api'

export default function PatientsPage() {
  const router = useRouter()
  const [patientsData, setPatientsData] = useState<DoctorPatientsResponse | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    const fetchPatients = async () => {
      try {
        const data = await getDoctorPatients()
        if (!cancelled) {
          setPatientsData(data)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor patients', err)
        if (!cancelled) setError('Unable to load patients right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPatients()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading patients...</p>
      </div>
    )
  }

  if (error) {
    return <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>{error}</div>
  }

  if (!patientsData) return null

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visiblePatients = normalizedQuery
    ? patientsData.patients.filter((patient) =>
        [patient.name, patient.email, patient.phone, patient.gender]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
    : patientsData.patients

  const formatDate = (dateString: string) => {
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.green }}>{patientsData.patients.filter((p: DoctorPatient) => p.status === 'active').length}</p>
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
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Visible Patients</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.blue }}>{visiblePatients.length}</p>
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
            {visiblePatients.length === 0 ? (
              <p style={{ margin: 0, padding: '28px', textAlign: 'center', color: T.slate2, fontSize: '13px' }}>No patients found</p>
            ) : visiblePatients.map((patient: DoctorPatient) => (
              <div key={patient.patient_id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(247,250,252,0.6)',
                border: '1px solid rgba(4,53,77,0.04)',
                transition: 'all 0.15s ease',
                cursor: 'default'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue, fontSize: '14px', fontWeight: 700 }}>
                    {patient.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{patient.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate2 }}>{patient.email || 'No email'} · {patient.phone || 'No phone'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: T.slate }}>
                      {patient.gender || 'Unknown gender'}, {patient.age ?? 'Unknown'} years · Last visit: {patient.last_visit ? formatDate(patient.last_visit) : 'No visits yet'}
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
            <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>Showing {visiblePatients.length} of {patientsData.total_count} patients</p>
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

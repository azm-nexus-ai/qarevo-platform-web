'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminPatients,
  getAdminPatient,
  getAdminPatientEpisodes,
  exportAdminPatientData,
  updateAdminPatient,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminPatient,
  type AdminPatientEpisode,
  type AdminUpdatePatientRequest,
} from '@/lib/api'

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'active':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green }
      case 'inactive':
      case 'suspended':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red }
      case 'pending':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber }
      default:
        return { bg: 'rgba(32,181,223,0.12)', color: T.blue }
    }
  }

  const style = getStatusStyle(status)

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 700,
      background: style.bg,
      color: style.color
    }}>
      {status.toUpperCase()}
    </span>
  )
}

function PatientCard({ patient, onView, onExport }: { 
  patient: AdminPatient
  onView: (id: string) => void
  onExport: (id: string) => void
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          borderRadius: '12px', 
          background: 'rgba(32,181,223,0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: T.blue,
          fontSize: '16px',
          fontWeight: 700
        }}>
          {patient.full_name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{patient.full_name}</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>{patient.email}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: T.slate }}>{patient.phone}</span>
            {patient.date_of_birth && (
              <>
                <span style={{ fontSize: '12px', color: T.slate2 }}>•</span>
                <span style={{ fontSize: '12px', color: T.slate }}>
                  {new Date(patient.date_of_birth).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <StatusBadge status={patient.status} />
        <button
          type="button"
          onClick={() => onView(patient.patient_id)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: '#fff',
            color: T.navy,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          View
        </button>
        <button
          type="button"
          onClick={() => onExport(patient.patient_id)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: T.blue,
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Export
        </button>
      </div>
    </div>
  )
}

export default function AdminPatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    if (!isAdmin()) {
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const data = await getAdminPatients(searchQuery, statusFilter)
        if (!cancelled) {
          setPatients(data.patients)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load patients', err)
        if (!cancelled) setError('Unable to load patients data right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, searchQuery])

  const handleViewPatient = (patientId: string) => {
    router.push(`/admin/patients/${patientId}`)
  }

  const handleExportPatient = async (patientId: string) => {
    try {
      await exportAdminPatientData(patientId)
      alert('Patient data exported successfully')
    } catch (err) {
      console.error('Failed to export patient data', err)
      alert('Failed to export patient data')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading patients...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          Patients Management
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          View patient profiles, episodes, and export data
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Ico p={ICONS.search} size={16} sw={1.6} color={T.slate2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.12)',
              background: 'rgba(255,255,255,0.9)',
              fontSize: '14px',
              color: T.navy,
              outline: 'none',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Patients List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {patients.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            No patients found
          </div>
        ) : (
          patients.map((patient) => (
            <PatientCard
              key={patient.patient_id}
              patient={patient}
              onView={handleViewPatient}
              onExport={handleExportPatient}
            />
          ))
        )}
      </div>
    </div>
  )
}

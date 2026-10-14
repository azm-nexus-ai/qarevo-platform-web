'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminDoctors,
  getPendingDoctors,
  verifyDoctor,
  updateDoctorStatus,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminDoctor,
  type AdminDoctorVerification,
  type AdminVerifyDoctorRequest,
  type AdminUpdateDoctorStatusRequest,
} from '@/lib/api'

type Tab = 'all' | 'pending'

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'active':
      case 'verified':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green }
      case 'pending':
      case 'pending_verification':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber }
      case 'suspended':
      case 'rejected':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red }
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
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}

function DoctorCard({ doctor, onView, onVerify }: { 
  doctor: AdminDoctor | AdminDoctorVerification
  onView: (id: string) => void
  onVerify?: (id: string) => void
}) {
  const isVerification = 'submission_date' in doctor
  const providerId = isVerification ? (doctor as AdminDoctorVerification).provider_id : (doctor as AdminDoctor).provider_id
  const status = isVerification ? 'pending_verification' : (doctor as AdminDoctor).status

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
          {doctor.full_name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{doctor.full_name}</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>{doctor.email}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: T.slate }}>{doctor.specialty}</span>
            <span style={{ fontSize: '12px', color: T.slate2 }}>•</span>
            <span style={{ fontSize: '12px', color: T.slate }}>{doctor.phone}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <StatusBadge status={status} />
        <button
          type="button"
          onClick={() => onView(providerId)}
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
        {onVerify && isVerification && (
          <button
            type="button"
            onClick={() => onVerify(providerId)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: T.green,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Verify
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminDoctorsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [pendingDoctors, setPendingDoctors] = useState<AdminDoctorVerification[]>([])
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
        const [doctorsData, pendingData] = await Promise.all([
          getAdminDoctors(statusFilter, undefined, undefined, searchQuery),
          getPendingDoctors(),
        ])
        if (!cancelled) {
          setDoctors(doctorsData.doctors)
          setPendingDoctors(pendingData)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctors', err)
        if (!cancelled) setError('Unable to load doctors data right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, searchQuery])

  const handleViewDoctor = (providerId: string) => {
    router.push(`/admin/doctors/${providerId}`)
  }

  const handleVerifyDoctor = (providerId: string) => {
    router.push(`/admin/doctors/${providerId}/verify`)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading doctors...
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
        <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          Doctors Management
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          Manage doctor verifications, licenses, and account status
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(4,53,77,0.08)', paddingBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'all' ? 'rgba(32,181,223,0.12)' : 'transparent',
            color: activeTab === 'all' ? T.blue : T.slate,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          All Doctors ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'pending' ? 'rgba(32,181,223,0.12)' : 'transparent',
            color: activeTab === 'pending' ? T.blue : T.slate,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Pending Verification ({pendingDoctors.length})
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Ico p={ICONS.search} size={16} sw={1.6} color={T.slate2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search doctors..."
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
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      )}

      {/* Doctors List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeTab === 'all' ? (
          doctors.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
              No doctors found
            </div>
          ) : (
            doctors.map((doctor) => (
              <DoctorCard
                key={doctor.provider_id}
                doctor={doctor}
                onView={handleViewDoctor}
              />
            ))
          )
        ) : (
          pendingDoctors.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
              No pending verifications
            </div>
          ) : (
            pendingDoctors.map((doctor) => (
              <DoctorCard
                key={doctor.provider_id}
                doctor={doctor}
                onView={handleViewDoctor}
                onVerify={handleVerifyDoctor}
              />
            ))
          )
        )}
      </div>
    </div>
  )
}

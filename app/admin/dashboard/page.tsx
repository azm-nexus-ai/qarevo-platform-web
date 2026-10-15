'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminDashboardOverview,
  getAdminDashboardActivity,
  getAdminDashboardHealth,
  getAdminDashboardDoctorsSummary,
  getAdminDashboardPatientsSummary,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminDashboardOverview,
  type AdminDashboardActivity,
  type AdminDashboardHealth,
  type AdminDashboardDoctorsSummary,
  type AdminDashboardPatientsSummary,
} from '@/lib/api'

function StatCard({ title, value, subtitle, icon, color, trend }: {
  title: string
  value: number | string
  subtitle?: string
  icon: string | readonly string[]
  color: string
  trend?: { value: string; positive: boolean }
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</p>
          <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{value}</p>
          {subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2 }}>{subtitle}</p>
          )}
          {trend && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: 600, color: trend.positive ? T.green : T.red }}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <Ico p={icon} size={28} sw={1.8} color={color} />
        </div>
      </div>
    </div>
  )
}

function HealthCard({ data }: { data: AdminDashboardHealth }) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green, text: 'System Healthy' }
      case 'warning':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber, text: 'Attention Needed' }
      case 'critical':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red, text: 'Critical Issues' }
      default:
        return { bg: 'rgba(32,181,223,0.12)', color: T.blue, text: status }
    }
  }

  const statusStyle = getStatusColor(data.status)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>System Health</h3>
        <span style={{
          padding: '6px 12px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 700,
          background: statusStyle.bg,
          color: statusStyle.color
        }}>
          {statusStyle.text}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>Pending Verifications</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.pending_verifications}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>Critical Exceptions</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: data.critical_exceptions > 0 ? T.red : T.navy }}>{data.critical_exceptions}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>High Priority</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: data.high_exceptions > 0 ? T.amber : T.navy }}>{data.high_exceptions}</p>
        </div>
      </div>
    </div>
  )
}

function ActivityCard({ data }: { data: AdminDashboardActivity }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Activity</h3>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2 }}>
          Last {data.period_days} days ({new Date(data.date_from).toLocaleDateString()} - {new Date(data.date_to).toLocaleDateString()})
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>New Patients</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_patients}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>New Doctors</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_doctors}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>New Exceptions</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_exceptions}</p>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null)
  const [activity, setActivity] = useState<AdminDashboardActivity | null>(null)
  const [health, setHealth] = useState<AdminDashboardHealth | null>(null)
  const [doctorsSummary, setDoctorsSummary] = useState<AdminDashboardDoctorsSummary | null>(null)
  const [patientsSummary, setPatientsSummary] = useState<AdminDashboardPatientsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    async function fetchDashboard() {
      try {
        const [overviewData, activityData, healthData, doctorsData, patientsData] = await Promise.all([
          getAdminDashboardOverview(),
          getAdminDashboardActivity(7),
          getAdminDashboardHealth(),
          getAdminDashboardDoctorsSummary(),
          getAdminDashboardPatientsSummary(),
        ])
        if (!cancelled) {
          setOverview(overviewData)
          setActivity(activityData)
          setHealth(healthData)
          setDoctorsSummary(doctorsData)
          setPatientsSummary(patientsData)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load admin dashboard', err)
        if (!cancelled) setError('Unable to load dashboard data right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading admin dashboard...
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

  if (!overview || !activity || !health) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          Overview of platform performance and operational metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <StatCard
          title="Total Patients"
          value={overview.patients.total}
          subtitle={patientsSummary ? `Active: ${patientsSummary.active}` : undefined}
          icon={ICONS.user}
          color={T.blue}
          trend={patientsSummary ? { value: `+${patientsSummary.new_this_month} this month`, positive: true } : undefined}
        />
        <StatCard
          title="Total Doctors"
          value={overview.doctors.total}
          subtitle={`Verified: ${overview.doctors.verified}`}
          icon={ICONS.steth}
          color={T.green}
          trend={overview.doctors.pending_verification > 0 ? { value: `${overview.doctors.pending_verification} pending`, positive: false } : undefined}
        />
        <StatCard
          title="Total Users"
          value={overview.users.total}
          icon={ICONS.shield}
          color={T.purple}
        />
        <StatCard
          title="Active Exceptions"
          value={overview.exceptions.active}
          icon={ICONS.zap}
          color={overview.exceptions.active > 0 ? T.red : T.amber}
        />
      </div>

      {/* Health & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        <HealthCard data={health} />
        <ActivityCard data={activity} />
      </div>

      {/* Doctors Summary */}
      {doctorsSummary && (
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>
            Doctors by Specialty
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {Object.entries(doctorsSummary.by_specialty).map(([specialty, count]) => (
              <div key={specialty} style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(247,250,252,0.6)',
                border: '1px solid rgba(4,53,77,0.04)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '13px', color: T.slate }}>{specialty}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

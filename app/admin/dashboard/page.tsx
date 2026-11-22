'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import WorkflowDeliveryCard from '@/components/admin/WorkflowDeliveryCard'
import ClinicalNotificationDeliveryCard from '@/components/admin/ClinicalNotificationDeliveryCard'
import {
  clearPortalSession,
  getAdminDashboardOverview,
  getAdminDashboardActivity,
  getAdminDashboardHealth,
  getAdminDashboardDoctorsSummary,
  getAdminDashboardPatientsSummary,
  isAuthError,
  readSessionMarker,
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
      background: "var(--surface-glass)",
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: "1px solid var(--border)",
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</p>
          <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{value}</p>
          {subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate2 }}>{subtitle}</p>
          )}
          {trend && (
            <p style={{ margin: '4px 0 0', fontSize: "13px", fontWeight: 600, color: trend.positive ? T.green : T.red }}>
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
  const t = useTranslations('adminDashboard')
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green, text: 'No Open Operational Alerts' }
      case 'warning':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber, text: 'Attention Needed' }
      case 'critical':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red, text: 'Critical Issues' }
      default:
        return { bg: 'rgba(32,181,223,0.12)', color: T.link, text: status }
    }
  }

  const statusStyle = getStatusColor(data.status)

  return (
    <div style={{
      background: "var(--surface-glass)",
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: "1px solid var(--border)",
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{t('operationalStatus')}</h3>
        <span style={{
          padding: '6px 12px',
          borderRadius: '999px',
          fontSize: "13px",
          fontWeight: 700,
          background: statusStyle.bg,
          color: statusStyle.color
        }}>
          {statusStyle.text}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('pendingVerifications')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.pending_verifications}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('criticalExceptions')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: data.critical_exceptions > 0 ? T.red : T.navy }}>{data.critical_exceptions}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('highPriority')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: data.high_exceptions > 0 ? T.amber : T.navy }}>{data.high_exceptions}</p>
        </div>
      </div>
    </div>
  )
}

function ActivityCard({ data }: { data: AdminDashboardActivity }) {
  const t = useTranslations('adminDashboard')
  return (
    <div style={{
      background: "var(--surface-glass)",
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: "1px solid var(--border)",
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{t('activity')}</h3>
        <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate2 }}>
          Last {data.period_days} days ({new Date(data.date_from).toLocaleDateString()} - {new Date(data.date_to).toLocaleDateString()})
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('newPatients')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_patients}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('newDoctors')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_doctors}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('newExceptions')}</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{data.new_exceptions}</p>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const t = useTranslations('adminDashboard')
  const router = useRouter()
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null)
  const [activity, setActivity] = useState<AdminDashboardActivity | null>(null)
  const [health, setHealth] = useState<AdminDashboardHealth | null>(null)
  const [doctorsSummary, setDoctorsSummary] = useState<AdminDashboardDoctorsSummary | null>(null)
  const [patientsSummary, setPatientsSummary] = useState<AdminDashboardPatientsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/admin/login')
      return
    }

    if (!isAdmin()) {
      router.replace('/auth/admin/login')
      return
    }

    setLoading(true)
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
          clearPortalSession()
          router.replace('/auth/admin/login')
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
  }, [router, retry])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        {t('loadingAdminDashboard')}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: "var(--surface-glass)", border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        <p>{error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)} style={{ padding: 12, borderRadius: 10, cursor: 'pointer' }}>{t('tryAgain')}</button>
      </div>
    )
  }

  if (!overview || !activity || !health) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          {t('adminDashboard')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          {t('overviewOfPlatformPerformanceAnd')}
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
        <StatCard
          title={t('totalPatients')}
          value={overview.patients.total}
          subtitle={patientsSummary ? `${patientsSummary.new_last_7_days} new patients in the last 7 days` : undefined}
          icon={ICONS.user}
          color={T.blue}
        />
        <StatCard
          title={t('totalDoctors')}
          value={overview.doctors.total}
          subtitle={`Verified: ${overview.doctors.verified}`}
          icon={ICONS.steth}
          color={T.green}
          trend={overview.doctors.pending_verification > 0 ? { value: `${overview.doctors.pending_verification} pending`, positive: false } : undefined}
        />
        <StatCard
          title={t('totalUsers')}
          value={overview.users.total}
          icon={ICONS.shield}
          color={T.purple}
        />
        <StatCard
          title={t('activeExceptions')}
          value={overview.exceptions.active}
          icon={ICONS.zap}
          color={overview.exceptions.active > 0 ? T.red : T.amber}
        />
      </div>

      {/* Health & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '16px' }}>
        <HealthCard data={health} />
        <ActivityCard data={activity} />
      </div>

      <WorkflowDeliveryCard />
      <ClinicalNotificationDeliveryCard />

      {/* Doctors Summary */}
      {doctorsSummary?.by_specialty && (
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>
            {t('doctorsBySpecialty')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
            {Object.entries(doctorsSummary.by_specialty).map(([specialty, count]) => (
              <div key={specialty} style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
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

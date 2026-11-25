'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  clearPortalSession,
  getExceptionStats,
  getAdminExceptions,
  assignException,
  resolveException,
  closeException,
  isAuthError,
  readSessionMarker,
  isAdmin,
  type AdminException,
  type AdminExceptionStats,
} from '@/lib/api'

function SeverityBadge({ severity }: { severity: string }) {
  const getSeverityStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'critical':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red }
      case 'high':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber }
      case 'medium':
        return { bg: 'rgba(32,181,223,0.12)', color: T.link }
      case 'low':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green }
      default:
        return { bg: 'rgba(107,114,128,0.12)', color: T.slate }
    }
  }

  const style = getSeverityStyle(severity)

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: "13px",
      fontWeight: 700,
      background: style.bg,
      color: style.color
    }}>
      {severity.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'open':
      case 'active':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red }
      case 'in_progress':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber }
      case 'resolved':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green }
      case 'closed':
        return { bg: 'rgba(107,114,128,0.12)', color: T.slate }
      default:
        return { bg: 'rgba(32,181,223,0.12)', color: T.link }
    }
  }

  const style = getStatusStyle(status)

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: "13px",
      fontWeight: 700,
      background: style.bg,
      color: style.color
    }}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}

function ExceptionCard({ exception, onAssign, onResolve, onClose }: {
  exception: AdminException
  onAssign: (id: string) => void
  onResolve: (id: string) => void
  onClose: (id: string) => void
}) {
  const t = useTranslations('adminExceptions');
  return (
    <div style={{
      background: "var(--surface-glass)",
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '16px',
      border: "1px solid var(--border)",
      boxShadow: Sh.card,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SeverityBadge severity={exception.severity} />
          <StatusBadge status={exception.status} />
          <span style={{ fontSize: "13px", color: T.slate2 }}>
            {new Date(exception.created_at).toLocaleString()}
          </span>
        </div>
        <span style={{ fontSize: "13px", color: T.slate }}>
          #{exception.id.slice(-8)}
        </span>
      </div>

      <div>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{exception.type}</p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>
          Source: {exception.source} ({exception.source_type})
        </p>
        {exception.assigned_to_name && (
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate }}>
            Assigned to: {exception.assigned_to_name}
          </p>
        )}
      </div>

      {exception.resolution_notes && (
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15,158,119,0.08)', border: '1px solid rgba(15,158,119,0.18)' }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.green, marginBottom: '4px' }}>{t('resolution')}</p>
          <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{exception.resolution_notes}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {exception.status === 'open' && (
          <>
            <button
              type="button"
              onClick={() => onAssign(exception.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: T.navy,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t('assign')}
            </button>
            <button
              type="button"
              onClick={() => onResolve(exception.id)}
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
              {t('resolve')}
            </button>
          </>
        )}
        {exception.status === 'resolved' && (
          <button
            type="button"
            onClick={() => onClose(exception.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: T.slate,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t('close')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminExceptionsPage() {
  const t = useTranslations('adminExceptions');
  const router = useRouter()
  const [exceptions, setExceptions] = useState<AdminException[]>([])
  const [stats, setStats] = useState<AdminExceptionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

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

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const [statsData, exceptionsData] = await Promise.all([
          getExceptionStats(),
          getAdminExceptions(statusFilter, severityFilter, typeFilter),
        ])
        if (!Array.isArray(exceptionsData.exceptions) || !statsData.by_status || !statsData.by_severity || !statsData.by_type) throw new Error('Unexpected exceptions service response')
        if (!cancelled) {
          setStats(statsData)
          setExceptions(exceptionsData.exceptions)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/admin/login')
          return
        }
        console.error('Failed to load exceptions', err)
        if (!cancelled) setError(t('unableToLoadExceptionsRight'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, severityFilter, typeFilter, retry, t])

  const handleAssign = async (exceptionId: string) => {
    const adminId = prompt(t('enterAdminUserIdTo'))
    if (!adminId) return

    try {
      await assignException(exceptionId, adminId)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Exception assignment failed', err)
      alert(t('failedToAssignException'))
    }
  }

  const handleResolve = async (exceptionId: string) => {
    const notes = prompt(t('enterResolutionNotes'))
    if (!notes) return

    try {
      await resolveException(exceptionId, notes)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Exception resolution failed', err)
      alert(t('failedToResolveException'))
    }
  }

  const handleClose = async (exceptionId: string) => {
    if (!confirm(t('areYouSureYouWant'))) return

    try {
      await closeException(exceptionId)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Exception close failed', err)
      alert(t('failedToCloseException'))
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        {t('loadingExceptions')}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: "var(--surface-glass)", border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        <p role='alert'>{error}</p>
        <button type='button' className='theme-toggle' onClick={() => setRetry(value => value + 1)}>{t('tryAgain')}</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          {t('exceptionsManagement')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          {t('trackAndResolveOperationalExceptions')}
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: "1px solid var(--border)",
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('total')}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{stats.total}</p>
          </div>
          <div style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: "1px solid var(--border)",
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('open')}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stats.by_status.open > 0 ? T.red : T.navy }}>{stats.by_status.open || 0}</p>
          </div>
          <div style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: "1px solid var(--border)",
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('critical')}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stats.by_severity.critical > 0 ? T.red : T.navy }}>{stats.by_severity.critical || 0}</p>
          </div>
          <div style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: "1px solid var(--border)",
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2, marginBottom: '4px' }}>{t('high')}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stats.by_severity.high > 0 ? T.amber : T.navy }}>{stats.by_severity.high || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">{t('allStatus')}</option>
          <option value="open">{t('open')}</option>
          <option value="in_progress">{t('inProgress')}</option>
          <option value="resolved">{t('resolved')}</option>
          <option value="closed">{t('closed')}</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">{t('allSeverity')}</option>
          <option value="critical">{t('critical')}</option>
          <option value="high">{t('high')}</option>
          <option value="medium">{t('medium')}</option>
          <option value="low">{t('low')}</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">{t('allTypes')}</option>
          <option value="system">{t('system')}</option>
          <option value="user">{t('user')}</option>
          <option value="payment">{t('payment')}</option>
          <option value="api">{t('api')}</option>
        </select>
      </div>

      {/* Exceptions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {exceptions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            {t('noExceptionsFound')}
          </div>
        ) : (
          exceptions.map((exception) => (
            <ExceptionCard
              key={exception.id}
              exception={exception}
              onAssign={handleAssign}
              onResolve={handleResolve}
              onClose={handleClose}
            />
          ))
        )}
      </div>
    </div>
  )
}

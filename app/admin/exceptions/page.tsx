'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getExceptionStats,
  getAdminExceptions,
  getAdminException,
  assignException,
  resolveException,
  closeException,
  isAuthError,
  readAccessToken,
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
        return { bg: 'rgba(32,181,223,0.12)', color: T.blue }
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
      fontSize: '11px',
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

function ExceptionCard({ exception, onAssign, onResolve, onClose }: { 
  exception: AdminException
  onAssign: (id: string) => void
  onResolve: (id: string) => void
  onClose: (id: string) => void
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
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SeverityBadge severity={exception.severity} />
          <StatusBadge status={exception.status} />
          <span style={{ fontSize: '12px', color: T.slate2 }}>
            {new Date(exception.created_at).toLocaleString()}
          </span>
        </div>
        <span style={{ fontSize: '12px', color: T.slate }}>
          #{exception.exception_id.slice(-8)}
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
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.green, marginBottom: '4px' }}>Resolution:</p>
          <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{exception.resolution_notes}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {exception.status === 'open' && (
          <>
            <button
              type="button"
              onClick={() => onAssign(exception.exception_id)}
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
              Assign
            </button>
            <button
              type="button"
              onClick={() => onResolve(exception.exception_id)}
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
              Resolve
            </button>
          </>
        )}
        {exception.status === 'resolved' && (
          <button
            type="button"
            onClick={() => onClose(exception.exception_id)}
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
            Close
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminExceptionsPage() {
  const router = useRouter()
  const [exceptions, setExceptions] = useState<AdminException[]>([])
  const [stats, setStats] = useState<AdminExceptionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

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
        const [statsData, exceptionsData] = await Promise.all([
          getExceptionStats(),
          getAdminExceptions(statusFilter, severityFilter, typeFilter),
        ])
        if (!cancelled) {
          setStats(statsData)
          setExceptions(exceptionsData.exceptions)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load exceptions', err)
        if (!cancelled) setError('Unable to load exceptions right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, severityFilter, typeFilter])

  const handleAssign = async (exceptionId: string) => {
    const adminId = prompt('Enter admin user ID to assign this exception:')
    if (!adminId) return
    
    try {
      await assignException(exceptionId, adminId)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Failed to assign exception', err)
      alert('Failed to assign exception')
    }
  }

  const handleResolve = async (exceptionId: string) => {
    const notes = prompt('Enter resolution notes:')
    if (!notes) return
    
    try {
      await resolveException(exceptionId, notes)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Failed to resolve exception', err)
      alert('Failed to resolve exception')
    }
  }

  const handleClose = async (exceptionId: string) => {
    if (!confirm('Are you sure you want to close this exception?')) return
    
    try {
      await closeException(exceptionId)
      const data = await getAdminExceptions(statusFilter, severityFilter, typeFilter)
      setExceptions(data.exceptions)
    } catch (err) {
      console.error('Failed to close exception', err)
      alert('Failed to close exception')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading exceptions...
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
          Exceptions Management
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          Track and resolve operational exceptions
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.88)',
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>Total</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: T.navy }}>{stats.total}</p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.88)',
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>Open</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stats.by_status.open > 0 ? T.red : T.navy }}>{stats.by_status.open || 0}</p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.88)',
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>Critical</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stats.by_severity.critical > 0 ? T.red : T.navy }}>{stats.by_severity.critical || 0}</p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.88)',
            boxShadow: Sh.card,
            padding: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>High</p>
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
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
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
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
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
          <option value="">All Types</option>
          <option value="system">System</option>
          <option value="user">User</option>
          <option value="payment">Payment</option>
          <option value="api">API</option>
        </select>
      </div>

      {/* Exceptions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {exceptions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            No exceptions found
          </div>
        ) : (
          exceptions.map((exception) => (
            <ExceptionCard
              key={exception.exception_id}
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

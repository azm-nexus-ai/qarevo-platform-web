'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminAuditLogs,
  getActionSummary,
  exportAdminAuditLogs,
  getAuditLog,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminAuditLog,
  type AdminActionSummary,
} from '@/lib/api'

function AuditLogCard({ log }: { log: AdminAuditLog }) {
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
          <span style={{ fontSize: '12px', color: T.slate2 }}>
            {new Date(log.created_at).toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', color: T.slate }}>
            #{log.log_id.slice(-8)}
          </span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: T.blue }}>
          {log.action}
        </span>
      </div>
      
      <div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: T.navy }}>
          {log.admin_user_name || log.admin_user_id}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>
          Target: {log.target_type} {log.target_id && `#${log.target_id.slice(-8)}`}
        </p>
        {log.ip_address && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate }}>
            IP: {log.ip_address}
          </p>
        )}
      </div>

      {log.changes && Object.keys(log.changes).length > 0 && (
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.18)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.blue }}>Changes:</p>
          {Object.entries(log.changes).map(([field, change]) => (
            <div key={field} style={{ marginBottom: '8px', fontSize: '12px', color: T.slate }}>
              <span style={{ fontWeight: 600 }}>{field}:</span> {String(change.old)} → {String(change.new)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [actionSummary, setActionSummary] = useState<AdminActionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
        const [logsData, summaryData] = await Promise.all([
          getAdminAuditLogs(undefined, actionFilter, targetTypeFilter, undefined, dateFrom, dateTo),
          getActionSummary(dateFrom, dateTo),
        ])
        if (!cancelled) {
          setLogs(logsData.logs)
          setActionSummary(summaryData)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load audit logs', err)
        if (!cancelled) setError('Unable to load audit logs right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, actionFilter, targetTypeFilter, dateFrom, dateTo])

  const handleExport = async () => {
    try {
      await exportAdminAuditLogs(dateFrom, dateTo, 'json')
      alert('Audit logs exported successfully')
    } catch (err) {
      console.error('Failed to export audit logs', err)
      alert('Failed to export audit logs')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading audit logs...
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
            Audit Logs
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
            Track all admin actions and system changes
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: T.blue,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Export Logs
        </button>
      </div>

      {actionSummary.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: T.navy }}>
            Action Summary
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {actionSummary.map((item) => (
              <div key={item.action} style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'rgba(32,181,223,0.12)',
                border: '1px solid rgba(32,181,223,0.18)',
                fontSize: '13px',
                color: T.navy,
              }}>
                {item.action}: {item.count}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
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
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
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
          <option value="">All Targets</option>
          <option value="user">User</option>
          <option value="doctor">Doctor</option>
          <option value="patient">Patient</option>
          <option value="admin">Admin</option>
          <option value="config">Config</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            No audit logs found
          </div>
        ) : (
          logs.map((log) => (
            <AuditLogCard key={log.log_id} log={log} />
          ))
        )}
      </div>
    </div>
  )
}

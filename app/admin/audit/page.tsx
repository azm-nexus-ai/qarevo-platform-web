'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import ClinicalAccessAuditPanel from '@/components/admin/ClinicalAccessAuditPanel'
import {
  clearPortalSession,
  getAdminAuditLogs,
  getActionSummary,
  exportAdminAuditLogs,
  isAuthError,
  readSessionMarker,
  isAdmin,
  type AdminAuditLog,
  type AdminActionSummary,
} from '@/lib/api'

function AuditLogCard({ log }: { log: AdminAuditLog }) {
  const t = useTranslations('adminAudit');
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
          <span style={{ fontSize: "13px", color: T.slate2 }}>
            {new Date(log.created_at).toLocaleString()}
          </span>
          <span style={{ fontSize: "13px", color: T.slate }}>
            #{log.id.slice(-8)}
          </span>
        </div>
        <span style={{ fontSize: "13px", fontWeight: 600, color: T.link }}>
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
          <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate }}>
            IP: {log.ip_address}
          </p>
        )}
      </div>

      {log.changes && Object.keys(log.changes).length > 0 && (
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.18)' }}>
          <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.link }}>{t('changes')}</p>
          {Object.entries(log.changes).map(([field, change]) => (
            <div key={field} style={{ marginBottom: '8px', fontSize: "13px", color: T.slate }}>
              <span style={{ fontWeight: 600 }}>{field}:</span> {change && typeof change === 'object' && 'old' in change && 'new' in change ? `${String(change.old)} → ${String(change.new)}` : JSON.stringify(change)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminActionAuditPanel() {
  const t = useTranslations('adminAudit');
  const router = useRouter()
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [actionSummary, setActionSummary] = useState<AdminActionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
        const [logsData, summaryData] = await Promise.all([
          getAdminAuditLogs(undefined, actionFilter, targetTypeFilter, undefined, dateFrom, dateTo),
          getActionSummary(dateFrom, dateTo),
        ])
        if (!Array.isArray(logsData.logs) || !Array.isArray(summaryData.actions)) throw new Error('Unexpected audit service response')
        if (!cancelled) {
          setLogs(logsData.logs)
          setActionSummary(summaryData.actions)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/admin/login')
          return
        }
        console.error('Failed to load audit logs', err)
        if (!cancelled) setError(t('unableToLoadAuditLogs'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, actionFilter, targetTypeFilter, dateFrom, dateTo, retry, t])

  const handleExport = async () => {
    try {
      await exportAdminAuditLogs(dateFrom, dateTo, 'json')
      alert(t('auditLogsExportedSuccessfully'))
    } catch (err) {
      console.error('Audit log export failed', err)
      alert(t('failedToExportAuditLogs'))
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        {t('loadingAuditLogs')}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
            {t('auditLogs')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
            {t('trackAllAdminActionsAnd')}
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
          {t('exportLogs')}
        </button>
      </div>

      {actionSummary.length > 0 && (
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '16px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: T.navy }}>
            {t('actionSummary')}
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
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">{t('allActions')}</option>
          <option value="create">{t('create')}</option>
          <option value="update">{t('update')}</option>
          <option value="delete">{t('delete')}</option>
          <option value="login">{t('login')}</option>
          <option value="logout">{t('logout')}</option>
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
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
          <option value="">{t('allTargets')}</option>
          <option value="user">{t('user')}</option>
          <option value="doctor">{t('doctor')}</option>
          <option value="patient">{t('patient')}</option>
          <option value="admin">{t('admin')}</option>
          <option value="config">{t('config')}</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
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
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            {t('noAuditLogsFound')}
          </div>
        ) : (
          logs.map((log) => (
            <AuditLogCard key={log.id} log={log} />
          ))
        )}
      </div>
    </div>
  )
}


export default function AuditLogsPage() {
  return <div className='space-y-8'><AdminActionAuditPanel /><ClinicalAccessAuditPanel /></div>
}

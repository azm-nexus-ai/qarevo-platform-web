// Admin account management for patient and doctor accounts.
// The API decides what an administrator may see and do; the UI only reflects
// the `can` flags it returns and never shows clinical data.

import { apiGet, apiPost } from '@/lib/api'

export type AccountRole = 'patient' | 'doctor'
export type AccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
export type AccountSummary = {
  user_id: string; role: AccountRole; name: string | null; email: string | null; status: AccountStatus
  registered_at: string | null; last_login_at: string | null; email_verified: boolean
  verification: 'verified' | 'pending' | 'unverified'; active_sessions: number; deletion_pending: boolean
}
export type AccountList = { total: number; limit: number; offset: number; accounts: AccountSummary[] }
export type AccountSession = { id: string; device: string | null; browser: string | null; os: string | null; network: string | null; started_at: string | null; last_seen_at: string | null }
export type RetentionItem = { category: string; handling: string; retention: string | null }
export type AccountDetail = Omit<AccountSummary, 'active_sessions' | 'deletion_pending'> & {
  phone: string | null; phone_verified: boolean; sessions: AccountSession[]
  activity: { event: string; category: string; success: boolean; at: string | null }[]
  admin_history: { action: string; by: string; reason: string | null; at: string | null }[]
  deletion: null | { state: 'PENDING'; requested_at: string; requested_by: string; reason: string; erase_contact_data_after: string; erasure_job: string }
  contact_data_erased_at?: string | null
  retention_plan: RetentionItem[]; retention_confirmed: boolean
  can: { suspend: boolean; reactivate: boolean; request_deletion: boolean; cancel_deletion: boolean }
}
export type AccountQuery = { role: AccountRole; search?: string; status?: string; verification?: string; limit?: number; offset?: number }

const base = '/api/v1/admin/accounts'

export function accountsQueryString(query: AccountQuery): string {
  const params = new URLSearchParams({ role: query.role, limit: String(query.limit ?? 25), offset: String(query.offset ?? 0) })
  const search = (query.search || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (search) params.set('search', search)
  if (query.status) params.set('status', query.status)
  if (query.verification) params.set('verification', query.verification)
  return params.toString()
}

export const listAccounts = (query: AccountQuery, signal?: AbortSignal) => apiGet<AccountList>(`${base}?${accountsQueryString(query)}`, undefined, signal)
export const getAccount = (id: string) => apiGet<AccountDetail>(`${base}/${encodeURIComponent(id)}`)
export const suspendAccount = (id: string, reason: string) => apiPost<AccountDetail>(`${base}/${encodeURIComponent(id)}/suspend`, { reason })
export const reactivateAccount = (id: string, reason: string) => apiPost<AccountDetail>(`${base}/${encodeURIComponent(id)}/reactivate`, { reason })
export const requestAccountDeletion = (id: string, reason: string, confirmEmail: string) =>
  apiPost<AccountDetail>(`${base}/${encodeURIComponent(id)}/deletion`, { reason, confirm_email: confirmEmail })
export const cancelAccountDeletion = (id: string, reason: string) => apiPost<AccountDetail>(`${base}/${encodeURIComponent(id)}/deletion/cancel`, { reason })

export const STATUS_LABELS: Record<AccountStatus, string> = {
  PENDING_VERIFICATION: 'Awaiting verification', ACTIVE: 'Active', SUSPENDED: 'Suspended', DEACTIVATED: 'Deactivated',
}
export const ACTION_LABELS: Record<string, string> = {
  SUSPEND_ACCOUNT: 'Suspended', REACTIVATE_ACCOUNT: 'Reactivated', REQUEST_ACCOUNT_DELETION: 'Deletion requested',
  CANCEL_ACCOUNT_DELETION: 'Deletion cancelled', UPDATE_DOCTOR_STATUS: 'Doctor status changed', VERIFY_DOCTOR: 'Verification decision',
}

/** "LOGIN_SUCCESS" → "Login success". Event payloads are never shown, only their type. */
export function eventLabel(event: string): string {
  const text = event.toLowerCase().replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const REASON_TEXT = { short: 'Give a reason of at least 10 characters. It is stored in the audit trail.', long: 'Keep the reason to 500 characters or fewer.' }
export function reasonProblem(reason: string, text: typeof REASON_TEXT = REASON_TEXT): string | null {
  const length = reason.trim().replace(/\s+/g, ' ').length
  if (length < 10) return text.short
  if (length > 500) return text.long
  return null
}

/** Berlin time in the reader's language; English keeps the British day-month order. */
export function formatBerlin(value: string | null | undefined, withTime = true, locale = 'en-GB'): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date)
}

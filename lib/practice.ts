/** Nonclinical practice contracts. These capabilities never establish clinical authority. */
export const PRACTICE_CAPABILITIES = '/api/v1/practice/capabilities'
export const PRACTICE_AUTH = '/api/v1/auth/practice'
export const practiceControl = 'min-h-11 w-full min-w-0 rounded-xl border border-theme bg-surface px-3 py-2 text-sm text-ink'
export type Practice = { id: string; name: string; status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'SUSPENDED'; version: number; contact_email: string | null; phone: string | null; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null; country: string | null }
export type PracticeMember = { id: string; practice_id: string; user_id: string; role: 'OWNER' | 'CLINICIAN'; status: 'ACTIVE' | 'REVOKED'; version: number; full_name?: string; email?: string; can_revoke: boolean }
export type PracticeInvitation = { id: string; practice_id: string; email: string; role: 'OWNER' | 'CLINICIAN'; status: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED'; version: number; expires_at: string; delivery_status: string }
export type PracticePage<T> = { rows: T[]; total: number; limit: number; offset: number; hasNext: boolean; hasPrevious: boolean; canManage: boolean }
export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export const recordVersion = (value: unknown): value is number => count(value) && value > 0
export function practiceCapability(value: unknown): boolean | null { return object(value) && typeof value.enabled === 'boolean' && value.clinical_routing_enabled === false && value.billing_enabled === false && value.administrative_review_only === true ? value.enabled : null }
export function practice(value: unknown): Practice | null {
  if (!object(value) || !uuid(value.id) || !text(value.name, 160) || !['DRAFT', 'SUBMITTED', 'REVIEWED', 'SUSPENDED'].includes(String(value.status)) || !recordVersion(value.version) || value.clinical_routing_enabled !== false || value.billing_enabled !== false || value.administrative_review_only !== true) return null
  for (const key of ['contact_email', 'phone', 'address_line1', 'address_line2', 'city', 'postcode', 'country']) if (value[key] !== null && typeof value[key] !== 'string') return null
  return value as unknown as Practice
}
export function practiceMember(value: unknown, practiceId: string): PracticeMember | null {
  return object(value) && uuid(value.id) && value.practice_id === practiceId && uuid(value.user_id) && ['OWNER', 'CLINICIAN'].includes(String(value.role)) && ['ACTIVE', 'REVOKED'].includes(String(value.status)) && recordVersion(value.version) && typeof value.can_revoke === 'boolean' ? value as unknown as PracticeMember : null
}
export function practiceInvitation(value: unknown, practiceId: string): PracticeInvitation | null {
  return object(value) && uuid(value.id) && value.practice_id === practiceId && text(value.email, 255) && ['OWNER', 'CLINICIAN'].includes(String(value.role)) && ['PENDING', 'EXPIRED', 'ACCEPTED', 'REVOKED'].includes(String(value.status)) && recordVersion(value.version) && text(value.expires_at, 50) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value.expires_at) && Number.isFinite(Date.parse(value.expires_at)) && text(value.delivery_status, 60) ? value as unknown as PracticeInvitation : null
}
export function practiceWorkspace(value: unknown): { practice: Practice; membership: PracticeMember }[] | null {
  if (!object(value) || !Array.isArray(value.practices) || value.practices.length > 1000) return null
  const rows: { practice: Practice; membership: PracticeMember }[] = [], seen = new Set<string>()
  for (const item of value.practices) {
    if (!object(item)) return null
    const saved = practice(item.practice), member = saved ? practiceMember(item.membership, saved.id) : null
    if (!saved || !member || seen.has(saved.id)) return null
    seen.add(saved.id); rows.push({ practice: saved, membership: member })
  }
  return rows
}
export function practicePage<T extends { id: string }>(value: unknown, key: string, parse: (row: unknown) => T | null): PracticePage<T> | null {
  if (!object(value) || !Array.isArray(value[key]) || !count(value.total) || !count(value.limit) || value.limit < 1 || value.limit > 100 || !count(value.offset) || value.offset > Math.max(0, value.total - 1) || value[key].length > value.limit || value.offset + value[key].length > value.total || typeof value.has_next !== 'boolean' || typeof value.has_previous !== 'boolean' || value.has_next !== (value.offset + value[key].length < value.total) || value.has_previous !== (value.offset > 0) || typeof value.can_manage !== 'boolean') return null
  const rows: T[] = [], seen = new Set<string>()
  for (const input of value[key]) { const row = parse(input); if (!row || !object(row) || typeof row.id !== 'string' || seen.has(row.id)) return null; seen.add(row.id); rows.push(row) }
  return { rows, total: value.total, limit: value.limit, offset: value.offset, hasNext: value.has_next, hasPrevious: value.has_previous, canManage: value.can_manage }
}
export function practiceFields(value?: Practice) { return { name: value?.name ?? '', contact_email: value?.contact_email ?? '', phone: value?.phone ?? '', address_line1: value?.address_line1 ?? '', address_line2: value?.address_line2 ?? '', city: value?.city ?? '', postcode: value?.postcode ?? '', country: value?.country ?? 'DE' } }
export function validatePracticeFields(fields: ReturnType<typeof practiceFields>) {
  const errors: Record<string, string> = {}
  if (fields.name.trim().length < 2 || fields.name.trim().length > 160) errors.name = 'Enter a practice name using 2–160 characters.'
  if (fields.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email)) errors.contact_email = 'Enter a valid contact email address.'
  if (fields.phone && !/^\+[1-9]\d{7,14}$/.test(fields.phone)) errors.phone = 'Use international format, for example +493012345678.'
  if (!/^[A-Za-z]{2}$/.test(fields.country)) errors.country = 'Use a two-letter country code, for example DE.'
  if (fields.postcode && fields.country.toUpperCase() === 'DE' && !/^\d{5}$/.test(fields.postcode)) errors.postcode = 'A German postcode must contain exactly five digits.'
  for (const [key, maximum] of [['address_line1', 255], ['address_line2', 255], ['city', 100], ['postcode', 20], ['contact_email', 255]] as const) if (fields[key].length > maximum) errors[key] = `Use at most ${maximum} characters.`
  return errors
}
export const practiceVersion = (version: number) => { if (!recordVersion(version)) throw new Error('Reload the current record before saving.'); return { 'If-Match': `"${version}"` } }
export function fragmentInvitation(hash: string): string | null { if (!hash.startsWith('#') || hash.length > 600) return null; const params = new URLSearchParams(hash.slice(1)); if (params.getAll('token').length !== 1 || [...params.keys()].some(key => key !== 'token')) return null; const token = params.get('token'); return token && /^[A-Za-z0-9_-]{32,512}$/.test(token) ? token : null }
export function invitationInspection(value: unknown) {
  if (!object(value) || !text(value.practice_name, 160) || !['OWNER', 'CLINICIAN'].includes(String(value.role)) || !text(value.email_hint, 255) || typeof value.existing_account !== 'boolean' || !text(value.expires_at, 50) || !Number.isFinite(Date.parse(value.expires_at))) return null
  return value as { practice_name: string; role: 'OWNER' | 'CLINICIAN'; email_hint: string; existing_account: boolean; expires_at: string }
}
export function deliveryMessage(value: unknown): string {
  if (!object(value) || !object(value.delivery) || !['accepted', 'unconfirmed', 'not_configured'].includes(String(value.delivery.status))) return 'The invitation is saved. Review its delivery state before resending.'
  return value.delivery.status === 'accepted' ? 'The email provider accepted the invitation. Inbox delivery is not confirmed.' : value.delivery.status === 'not_configured' ? 'The invitation is saved, but invitation email is not configured. Contact the platform operator before resending.' : 'The invitation is saved; email delivery could not be confirmed. Review the saved invitation before resending.'
}

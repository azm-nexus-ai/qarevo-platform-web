import type { AdminDoctor, AdminDoctorVerification } from './api'

export type ClinicianRow = AdminDoctor | AdminDoctorVerification
export type ClinicianPage = {
  doctors: ClinicianRow[]; total: number | null; limit: number; offset: number;
  hasNext: boolean; hasPrevious: boolean; paginated: boolean; canReview: boolean;
  statusOptions: { value: string; label: string }[];
}
export type ClinicianPageRequest = { limit: number; offset: number }

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
export const clinicianIdentifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)

export function clinicianRow(value: unknown): ClinicianRow | null {
  if (!object(value) || !clinicianIdentifier(value.provider_id) || !text(value.full_name, 300) || !text(value.email, 254) ||
      !text(value.status, 50) || !text(value.verification_status, 50)) return null
  for (const key of ['email_verified', 'license_verified', 'can_review']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return null
  for (const key of ['phone', 'specialty', 'license_number']) if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') return null
  if (value.clinical_access !== undefined && (!object(value.clinical_access) || !['enabled', 'blocked'].includes(String(value.clinical_access.status)) ||
      !text(value.clinical_access.reason, 200) || !text(value.clinical_access.message, 1500))) return null
  return value as unknown as ClinicianRow
}

/** Missing legacy metadata permits only an explicitly bounded first-page view. */
export function clinicianPage(value: unknown, requested: ClinicianPageRequest): ClinicianPage | null {
  const envelope = object(value) ? value : null, rows = Array.isArray(value) ? value : envelope?.doctors
  if (!Array.isArray(rows) || rows.length > 50) return null
  const doctors: ClinicianRow[] = [], identifiers = new Set<string>()
  for (const value of rows) {
    const row = clinicianRow(value)
    if (!row || identifiers.has(row.provider_id)) return null
    doctors.push(row); identifiers.add(row.provider_id)
  }
  const statusOptions: ClinicianPage['statusOptions'] = []
  if (envelope?.status_options !== undefined) {
    if (!Array.isArray(envelope.status_options) || envelope.status_options.length > 20) return null
    const values = new Set<string>()
    for (const option of envelope.status_options) {
      if (!object(option) || typeof option.value !== 'string' || !/^[A-Z][A-Z_]{0,49}$/.test(option.value) || !text(option.label, 100) || values.has(option.value)) return null
      values.add(option.value); statusOptions.push({ value: option.value, label: option.label })
    }
  }
  if (envelope?.can_review !== undefined && typeof envelope.can_review !== 'boolean') return null
  const paginated = !!envelope && ['has_next', 'has_previous'].some(key => Object.hasOwn(envelope, key))
  if (paginated) {
    if (!count(envelope.total) || !count(envelope.limit) || ![25, 50].includes(envelope.limit) || envelope.limit !== requested.limit ||
        !count(envelope.offset) || envelope.offset > requested.offset || envelope.offset > Math.max(0, envelope.total - 1) || envelope.offset % envelope.limit !== 0 ||
        doctors.length > envelope.limit || envelope.offset + doctors.length > envelope.total ||
        typeof envelope.can_review !== 'boolean' || typeof envelope.has_next !== 'boolean' || typeof envelope.has_previous !== 'boolean' ||
        envelope.has_next !== (envelope.offset + envelope.limit < envelope.total) || envelope.has_previous !== (envelope.offset > 0)) return null
    return { doctors, total: envelope.total, limit: envelope.limit, offset: envelope.offset, paginated: true,
      hasNext: envelope.has_next, hasPrevious: envelope.has_previous, canReview: envelope.can_review, statusOptions }
  }
  if (requested.offset !== 0 || (envelope?.offset !== undefined && envelope.offset !== 0) ||
      (envelope?.limit !== undefined && (!count(envelope.limit) || envelope.limit < 1 || envelope.limit > 50 || doctors.length > envelope.limit)) ||
      (envelope?.total !== undefined && (!count(envelope.total) || envelope.total < doctors.length))) return null
  return { doctors, total: envelope && count(envelope.total) ? envelope.total : null, limit: requested.limit, offset: 0,
    paginated: false, hasNext: false, hasPrevious: false, canReview: false, statusOptions }
}

export function clinicianPagePath(kind: 'all' | 'pending', page: ClinicianPageRequest, search: string, status = '') {
  const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) })
  if (search.trim()) params.set('search', search.trim())
  if (kind === 'all' && status) params.set('status', status)
  return `/api/v1/admin/doctors${kind === 'pending' ? '/pending/page' : ''}?${params.toString()}`
}

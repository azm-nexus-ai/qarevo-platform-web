/** Administrative absence contracts; absence dates never imply appointment cancellation. */
export const TIME_OFF_PAGE_SIZE = 25
export const TIME_OFF_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export type TimeOffStatus = typeof TIME_OFF_STATUSES[number]
export type TimeOff = { id: string; providerId: string; start: string; end: string; reason: string | null; status: TimeOffStatus }
export type TimeOffPage = { records: TimeOff[]; total: number; limit: number; offset: number; canManage: boolean }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
export const timeOffReference = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const instant = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

export function timeOffRecord(value: unknown, providerId: string): TimeOff | null {
  if (!object(value) || !timeOffReference(value.id) || value.provider_id !== providerId || !instant(value.start_datetime) || !instant(value.end_datetime) ||
    Date.parse(value.start_datetime) >= Date.parse(value.end_datetime) || !TIME_OFF_STATUSES.includes(value.status as TimeOffStatus) ||
    (value.reason !== null && (typeof value.reason !== 'string' || value.reason.length > 500))) return null
  return { id: value.id, providerId, start: value.start_datetime, end: value.end_datetime, reason: value.reason as string | null, status: value.status as TimeOffStatus }
}

export function timeOffPage(value: unknown, providerId: string): TimeOffPage | null {
  if (!object(value) || !integer(value.total) || !integer(value.limit) || value.limit < 1 || value.limit > TIME_OFF_PAGE_SIZE || !integer(value.offset) ||
    typeof value.can_manage !== 'boolean' || !Array.isArray(value.time_off) || value.time_off.length > value.limit) return null
  const records: TimeOff[] = [], seen = new Set<string>()
  for (const row of value.time_off) {
    const record = timeOffRecord(row, providerId)
    if (!record || seen.has(record.id)) return null
    seen.add(record.id); records.push(record)
  }
  if (records.length && value.offset + records.length > value.total) return null
  return { records, total: value.total, limit: value.limit, offset: value.offset, canManage: value.can_manage }
}

export function timeOffPath(providerId: string, offset = 0, status = ''): string {
  if (!timeOffReference(providerId) || !integer(offset) || (status && !TIME_OFF_STATUSES.includes(status as TimeOffStatus))) throw new Error('Invalid absence reference or page.')
  return `/api/v1/admin/doctors/${encodeURIComponent(providerId)}/time-off?limit=${TIME_OFF_PAGE_SIZE}&offset=${offset}${status ? `&status=${status}` : ''}`
}

const localText = (date: Date) => `${date.getFullYear().toString().padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
export function localAbsenceInstant(value: string): { iso?: string; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { error: 'Enter a complete date and time.' }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || localText(date) !== value) return { error: 'This date or local time does not exist. Choose another time.' }
  // A repeated DST wall time has more than one possible instant. Do not silently
  // choose a fold; operators must choose an unambiguous boundary instead.
  for (const hours of [-24, 24]) {
    const neighbour = new Date(date.getTime() + hours * 3_600_000)
    const difference = neighbour.getTimezoneOffset() - date.getTimezoneOffset()
    if (difference && localText(new Date(date.getTime() + difference * 60_000)) === value) return { error: 'This local time occurs twice during a clock change. Choose an unambiguous time.' }
  }
  return { iso: date.toISOString() }
}

export function absenceRequest(start: string, end: string, reason: string) {
  const a = localAbsenceInstant(start), b = localAbsenceInstant(end), errors: Record<string, string> = {}
  if (a.error) errors.start = a.error
  if (b.error) errors.end = b.error
  if (a.iso && b.iso && a.iso >= b.iso) errors.end = 'The end must be later than the start.'
  if (reason.trim().length > 500) errors.reason = 'Use at most 500 characters; do not include patient information.'
  return { errors, payload: Object.keys(errors).length || !a.iso || !b.iso ? null : { start_datetime: a.iso, end_datetime: b.iso, reason: reason.trim() || null } }
}

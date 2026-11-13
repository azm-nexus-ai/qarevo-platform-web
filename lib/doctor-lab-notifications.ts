import { consultationSummaryId } from './patient-consultation-summary'

export const DOCTOR_NOTIFICATIONS_PATH = '/api/v1/doctor/notifications'
export type DoctorLabNotice = {
  id: string; patientId: string; requestId: string; fileId: string; uploadedBy: 'patient' | 'care_team'
  createdAt: string; isRead: boolean; readAt: string | null; availability: 'current' | 'superseded' | 'unavailable'
}
export type DoctorNoticePage = { items: DoctorLabNotice[]; hasMore: boolean; nextCursor: string | null }
export type LabResultTarget = { patientId: string; requestId: string; fileId: string }
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|\+00:00)$/.test(value)
export function noticeCursor(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 256 && /^[A-Za-z0-9_.-]+$/.test(value) ? value : null
}
export function doctorLabNotice(value: unknown): DoctorLabNotice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = consultationSummaryId(row.id), patientId = consultationSummaryId(row.patient_id), requestId = consultationSummaryId(row.lab_request_id), fileId = consultationSummaryId(row.file_id)
  if (!id || !patientId || !requestId || !fileId || row.event_type !== 'lab_result_uploaded' || row.source !== 'lab-result' ||
      (row.uploaded_by !== 'patient' && row.uploaded_by !== 'care_team') || !timestamp(row.created_at) || typeof row.is_read !== 'boolean' ||
      (row.read_at !== null && !timestamp(row.read_at)) || !['current', 'superseded', 'unavailable'].some(status => row.availability === status)) return null
  return { id, patientId, requestId, fileId, uploadedBy: row.uploaded_by, createdAt: row.created_at, isRead: row.is_read, readAt: row.read_at as string | null, availability: row.availability as DoctorLabNotice['availability'] }
}
export function doctorNoticePage(value: unknown): DoctorNoticePage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const page = value as Record<string, unknown>
  if (!Array.isArray(page.notifications) || page.notifications.length > 25 || typeof page.has_more !== 'boolean') return null
  const items: DoctorLabNotice[] = [], ids = new Set<string>()
  for (const row of page.notifications) { const notice = doctorLabNotice(row); if (!notice || ids.has(notice.id)) return null; ids.add(notice.id); items.push(notice) }
  const nextCursor = noticeCursor(page.next_cursor)
  if (page.has_more ? !items.length || !nextCursor : page.next_cursor !== null) return null
  return { items, hasMore: page.has_more, nextCursor }
}
export function doctorNoticePath(cursor?: string): string | null {
  if (cursor !== undefined && !noticeCursor(cursor)) return null
  const query = new URLSearchParams({ limit: '25' }); if (cursor) query.set('before', cursor)
  return `${DOCTOR_NOTIFICATIONS_PATH}?${query}`
}
export function labResultTarget(parameters: URLSearchParams): { target: LabResultTarget | null; invalid: boolean } {
  const keys = ['patientId', 'requestId', 'fileId'] as const
  if (!keys.some(key => parameters.has(key))) return { target: null, invalid: false }
  if ([...parameters.keys()].some(key => !keys.includes(key as typeof keys[number])) || keys.some(key => parameters.getAll(key).length !== 1)) return { target: null, invalid: true }
  const patientId = consultationSummaryId(parameters.get('patientId')), requestId = consultationSummaryId(parameters.get('requestId')), fileId = consultationSummaryId(parameters.get('fileId'))
  return patientId && requestId && fileId ? { target: { patientId, requestId, fileId }, invalid: false } : { target: null, invalid: true }
}
export function doctorLabNoticeHref(notice: DoctorLabNotice): string | undefined {
  if (notice.availability !== 'current') return undefined
  const ids = [notice.patientId, notice.requestId, notice.fileId].map(consultationSummaryId)
  return ids.every(Boolean) ? `/doctor/lab-orders?${new URLSearchParams({ patientId: ids[0]!, requestId: ids[1]!, fileId: ids[2]! })}` : undefined
}

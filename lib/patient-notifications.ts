import { consultationSummaryId } from './patient-consultation-summary'
import { publicationHref } from './clinical-publications'

export const PATIENT_NOTIFICATIONS_PATH = '/api/v1/patient/activity/notifications'
export type PatientNotice = {
  id: string; eventType: string; title: string; body: string; href?: string; source: string; sourceId: string | null
  isRead: boolean; readAt: string | null; createdAt: string | null; official: boolean; extra: Record<string, unknown>
}
const publicationKeys = ['consultation_id', 'episode_id', 'published_at', 'record_id', 'revision', 'version']
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const dateValue = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null

/** Only finite patient destinations are supported for legacy account updates. */
export function safePatientNoticeHref(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\x00-\x20\x7f\\]/.test(value)) return undefined
  try {
    const url = new URL(value, 'https://notification.invalid')
    if (url.origin !== 'https://notification.invalid' || url.hash || url.username || url.password) return undefined
    if (url.pathname === '/patient/medical-records') {
      const keys = [...url.searchParams.keys()]
      if (!keys.length) return url.pathname
      const id = keys.length === 1 && keys[0] === 'recordId' ? consultationSummaryId(url.searchParams.get('recordId')) : null
      return id ? `/patient/medical-records?recordId=${id}` : undefined
    }
    return ['/patient/dashboard', '/patient/appointments', '/patient/lab-requests', '/patient/messages', '/patient/settings'].includes(url.pathname) && !url.search ? url.pathname : undefined
  } catch { return undefined }
}
export function patientNotice(value: unknown): PatientNotice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>, id = consultationSummaryId(row.id)
  if (!id || typeof row.is_read !== 'boolean' || typeof row.event_type !== 'string' || typeof row.source !== 'string') return null
  const extra = row.extra_data && typeof row.extra_data === 'object' && !Array.isArray(row.extra_data) ? row.extra_data as Record<string, unknown> : {}
  const official = row.source === 'clinical-publication' && row.event_type === 'clinical_record.published'
  const reserved = row.source === 'clinical-publication' || row.event_type === 'clinical_record.published'
  let href: string | undefined
  if (reserved) {
    const recordId = consultationSummaryId(extra.record_id), consultationId = consultationSummaryId(extra.consultation_id)
    if (!official || Object.keys(extra).sort().join('|') !== publicationKeys.join('|') || !recordId || id !== recordId || !consultationId || !consultationSummaryId(extra.episode_id) ||
        recordId !== consultationSummaryId(row.source_id) || !positiveInteger(extra.revision) || !positiveInteger(extra.version) || !dateValue(extra.published_at) || !/(?:Z|\+00:00)$/.test(String(extra.published_at))) return null
    href = publicationHref('patient', consultationId, recordId)
  } else href = safePatientNoticeHref(row.href)
  return {
    id, eventType: row.event_type, source: row.source, sourceId: typeof row.source_id === 'string' ? row.source_id : null,
    isRead: row.is_read, readAt: dateValue(row.read_at), createdAt: dateValue(row.created_at), official, extra,
    title: official ? extra.revision === 1 ? 'Consultation summary published' : 'Consultation summary updated' : typeof row.title === 'string' && row.title.trim() ? row.title.slice(0, 220) : 'Account update',
    body: official ? 'Your clinician-published consultation summary is available. Open it to read the published care instructions.' : typeof row.body === 'string' ? row.body.slice(0, 2000) : '',
    href,
  }
}
export function patientNotices(value: unknown): { items: PatientNotice[]; invalidCount: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rows = (value as Record<string, unknown>).notifications
  if (!Array.isArray(rows) || rows.length > 50) return null
  const ids = new Set<string>(), items: PatientNotice[] = []
  let invalidCount = 0
  for (const row of rows) {
    const notice = patientNotice(row)
    if (!notice || ids.has(notice.id)) { invalidCount++; continue }
    ids.add(notice.id); items.push(notice)
  }
  return { items, invalidCount }
}

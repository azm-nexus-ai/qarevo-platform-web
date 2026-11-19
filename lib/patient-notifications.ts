import { consultationSummaryId } from './patient-consultation-summary'
import { publicationHref } from './clinical-publications'

export const PATIENT_NOTIFICATIONS_PATH = '/api/v1/patient/activity/notifications'
export const PATIENT_NOTIFICATION_PAGE_SIZE = 50
export type PatientNotice = {
  id: string; eventType: string; title: string; body: string; href?: string; source: string; sourceId: string | null
  isRead: boolean; readAt: string | null; createdAt: string | null; official: boolean; careRecord: boolean; extra: Record<string, unknown>
}
const publicationKeys = ['consultation_id', 'episode_id', 'published_at', 'record_id', 'revision', 'version']
const careRecordKeys = ['action', 'actor_user_id', 'audit_id', 'kind', 'record_reference_hash', 'resource_id']
const canonicalId = (value: unknown) => typeof value === 'string' && consultationSummaryId(value) === value ? value : null
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
  const careEvent = /^(medication_instruction|care_plan)\.(created|updated|deleted)$/.exec(row.event_type)
  const careRecord = row.source === 'clinical-authoring' && Boolean(careEvent)
  const reservedCareRecord = row.source === 'clinical-authoring' || row.event_type.startsWith('medication_instruction.') || row.event_type.startsWith('care_plan.')
  let href: string | undefined
  let title = typeof row.title === 'string' && row.title.trim() ? row.title.slice(0, 220) : 'Account update'
  let body = typeof row.body === 'string' ? row.body.slice(0, 2000) : ''
  if (reserved) {
    const recordId = consultationSummaryId(extra.record_id), consultationId = consultationSummaryId(extra.consultation_id)
    if (!official || Object.keys(extra).sort().join('|') !== publicationKeys.join('|') || !recordId || id !== recordId || !consultationId || !consultationSummaryId(extra.episode_id) ||
        recordId !== consultationSummaryId(row.source_id) || !positiveInteger(extra.revision) || !positiveInteger(extra.version) || !dateValue(extra.published_at) || !/(?:Z|\+00:00)$/.test(String(extra.published_at))) return null
    href = publicationHref('patient', consultationId, recordId)
    title = extra.revision === 1 ? 'Consultation summary published' : 'Consultation summary updated'
    body = 'Your clinician-published consultation summary is available. Open it to read the published care instructions.'
  } else if (reservedCareRecord) {
    const resourceReference = (canonicalId(extra.resource_id) && extra.record_reference_hash === null) ||
      (extra.resource_id === null && typeof extra.record_reference_hash === 'string' && /^[0-9a-f]{64}$/.test(extra.record_reference_hash))
    if (!careRecord || !careEvent || Object.keys(extra).sort().join('|') !== careRecordKeys.join('|') ||
        row.id !== id || canonicalId(row.source_id) !== id || canonicalId(extra.audit_id) !== id || !canonicalId(extra.actor_user_id) ||
        extra.kind !== careEvent[1] || extra.action !== careEvent[2] || !resourceReference) return null
    const noun = extra.kind === 'medication_instruction' ? 'Medication record' : 'Care plan record'
    const verb = extra.action === 'created' ? 'added' : extra.action === 'updated' ? 'updated' : 'removed'
    title = `${noun} ${verb}`
    body = `A clinician ${verb} a ${noun.toLowerCase()}. Open your care page to review your current recorded instructions.`
    href = '/patient/prescription-care-plan'
  } else href = safePatientNoticeHref(row.href)
  return {
    id, eventType: row.event_type, source: row.source, sourceId: typeof row.source_id === 'string' ? row.source_id : null,
    isRead: row.is_read, readAt: dateValue(row.read_at), createdAt: dateValue(row.created_at), official, careRecord, extra,
    title, body, href,
  }
}
export type PatientNoticePage = {
  items: PatientNotice[]; invalidCount: number; paginated: boolean; hasMore: boolean; nextCursor: string | null; unreadCount: number | null
}
const notificationCursor = (value: unknown): value is string => typeof value === 'string' && value.length <= 256 && /^v1\.[A-Za-z0-9_-]+$/.test(value)

export function patientNotificationPath(before: string | null): string {
  const query = new URLSearchParams({ limit: String(PATIENT_NOTIFICATION_PAGE_SIZE) })
  if (before !== null) query.set('before', before)
  return `${PATIENT_NOTIFICATIONS_PATH}?${query}`
}

export function patientNotices(value: unknown): PatientNoticePage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const page = value as Record<string, unknown>, rows = page.notifications
  if (!Array.isArray(rows) || rows.length > PATIENT_NOTIFICATION_PAGE_SIZE) return null
  const paginated = ['has_more', 'next_cursor', 'unread_count'].some(key => Object.hasOwn(page, key))
  if (paginated && (typeof page.has_more !== 'boolean' || !Number.isSafeInteger(page.unread_count) || Number(page.unread_count) < 0 ||
      (page.has_more ? !rows.length || !notificationCursor(page.next_cursor) : page.next_cursor !== null))) return null
  const ids = new Set<string>(), items: PatientNotice[] = []
  let invalidCount = 0
  for (const row of rows) {
    const notice = patientNotice(row)
    if (!notice || ids.has(notice.id)) { invalidCount++; continue }
    ids.add(notice.id); items.push(notice)
  }
  return { items, invalidCount, paginated, hasMore: paginated && page.has_more === true,
    nextCursor: paginated && page.has_more === true ? page.next_cursor as string : null,
    unreadCount: paginated ? page.unread_count as number : null }
}

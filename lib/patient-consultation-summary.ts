import { clinicalFields, type PublishedClinicalRecord } from './clinical-record'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function consultationSummaryId(value: unknown): string | null {
  return typeof value === 'string' && uuid.test(value) ? value.toLowerCase() : null
}

/** The catalog cannot supply an arbitrary navigation destination. */
export function consultationSummaryHref(sourceId: unknown): string | undefined {
  const id = consultationSummaryId(sourceId)
  return id ? `/patient/consultation-summary?consultationId=${encodeURIComponent(id)}` : undefined
}

/** Publication and consultation binding are checked before clinical text is rendered. */
export function publishedConsultationSummary(value: unknown, consultationId: string): PublishedClinicalRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!consultationSummaryId(record.id) || !consultationSummaryId(record.episode_id) ||
      consultationSummaryId(record.consultation_id) !== consultationSummaryId(consultationId) ||
      !consultationSummaryId(consultationId) || typeof record.approved_by !== 'string' || !record.approved_by.trim() ||
      typeof record.published_at !== 'string' || !Number.isFinite(Date.parse(record.published_at)) ||
      !Number.isSafeInteger(record.revision) || (record.revision as number) < 1 ||
      !Number.isSafeInteger(record.version) || (record.version as number) < 1 ||
      (record.language !== 'de' && record.language !== 'en') ||
      clinicalFields.some(field => typeof record[field.key] !== 'string' || (record[field.key] as string).length > field.max) ||
      (record.amendment_reason != null && (typeof record.amendment_reason !== 'string' || record.amendment_reason.length > 500))) return null
  return record as PublishedClinicalRecord
}

export function summaryPublicationTime(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
}

import type { PublishedClinicalRecord } from './clinical-record'
import { consultationSummaryId, publishedConsultationSummary } from './patient-consultation-summary'

export type PublicationPortal = 'patient' | 'doctor'
export type PublicationMetadata = Pick<PublishedClinicalRecord, 'id' | 'episode_id' | 'consultation_id' | 'revision' | 'version' | 'language' | 'approved_by' | 'published_at'>
export type PublicationPage = { items: PublicationMetadata[]; latest_published_revision: number | null; has_more: boolean; next_before_revision: number | null }
export type SelectedPublication = { record: PublishedClinicalRecord; latest_published_revision: number; is_current: boolean }
export const PUBLICATION_PAGE_LIMIT = 20
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0

export function publicationParameters(consultationIds: string[], recordIds: string[]) {
  const consultationId = consultationIds.length === 1 ? consultationSummaryId(consultationIds[0]) : null
  const recordId = recordIds.length === 1 ? consultationSummaryId(recordIds[0]) : null
  return { consultationId, recordId, invalidLink: (consultationIds.length > 0 && !consultationId) || recordIds.length > 1 || (recordIds.length === 1 && !recordId) || (recordIds.length > 0 && !consultationId) }
}
export function publicationHref(portal: PublicationPortal, consultationId: unknown, recordId?: unknown): string | undefined {
  const consultation = consultationSummaryId(consultationId), record = recordId == null ? null : consultationSummaryId(recordId)
  if (!consultation || (recordId != null && !record)) return undefined
  const path = portal === 'doctor' ? '/doctor/clinical-records' : '/patient/consultation-summary'
  return `${path}?consultationId=${consultation}${record ? `&recordId=${record}` : ''}`
}
export function publicationApiPath(portal: PublicationPortal, consultationId: string, options: { recordId?: string; beforeRevision?: number } = {}): string | null {
  const id = consultationSummaryId(consultationId)
  if (!id || (options.recordId !== undefined && !consultationSummaryId(options.recordId)) || (options.beforeRevision !== undefined && !positiveInteger(options.beforeRevision))) return null
  const base = portal === 'doctor' ? `/api/v1/doctor/workspace/${id}/clinical-record/publications` : '/api/v1/patient/consultation-summary/publications'
  const query = new URLSearchParams(portal === 'patient' ? { consultation_id: id } : {})
  if (!options.recordId) {
    query.set('limit', String(PUBLICATION_PAGE_LIMIT))
    if (options.beforeRevision !== undefined) query.set('before_revision', String(options.beforeRevision))
  }
  return `${base}${options.recordId ? `/${consultationSummaryId(options.recordId)}` : ''}${query.size ? `?${query}` : ''}`
}
function metadata(value: unknown, consultationId: string): PublicationMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const id = consultationSummaryId(item.id), episode = consultationSummaryId(item.episode_id), consultation = consultationSummaryId(item.consultation_id)
  if (!id || !episode || consultation !== consultationSummaryId(consultationId) || !consultation || !positiveInteger(item.revision) || !positiveInteger(item.version) ||
      (item.language !== 'de' && item.language !== 'en') || typeof item.approved_by !== 'string' || !item.approved_by.trim() || typeof item.published_at !== 'string' || !Number.isFinite(Date.parse(item.published_at))) return null
  return { id, episode_id: episode, consultation_id: consultation, revision: item.revision, version: item.version, language: item.language, approved_by: item.approved_by, published_at: item.published_at }
}
export function publicationPage(value: unknown, consultationId: string, beforeRevision?: number): PublicationPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const page = value as Record<string, unknown>
  if (!consultationSummaryId(consultationId) || !Array.isArray(page.items) || page.items.length > PUBLICATION_PAGE_LIMIT || typeof page.has_more !== 'boolean' ||
      (page.latest_published_revision !== null && !positiveInteger(page.latest_published_revision)) || (beforeRevision !== undefined && !positiveInteger(beforeRevision))) return null
  const items: PublicationMetadata[] = [], ids = new Set<string>()
  let priorRevision = beforeRevision ?? Infinity
  for (const value of page.items) {
    const item = metadata(value, consultationId)
    if (!item || ids.has(item.id) || item.revision >= priorRevision || !positiveInteger(page.latest_published_revision) || item.revision > page.latest_published_revision) return null
    ids.add(item.id); priorRevision = item.revision; items.push(item)
  }
  if (page.has_more ? !items.length || page.next_before_revision !== items.at(-1)?.revision : page.next_before_revision !== null) return null
  if (items.length && page.latest_published_revision === null) return null
  return { items, latest_published_revision: page.latest_published_revision as number | null, has_more: page.has_more, next_before_revision: page.next_before_revision as number | null }
}
export function selectedPublication(value: unknown, consultationId: string, recordId: string): SelectedPublication | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Record<string, unknown>, record = publishedConsultationSummary(payload.record, consultationId)
  if (!record || consultationSummaryId(record.id) !== consultationSummaryId(recordId) || !positiveInteger(payload.latest_published_revision) || payload.latest_published_revision < record.revision || typeof payload.is_current !== 'boolean' || payload.is_current !== (record.revision === payload.latest_published_revision)) return null
  return { record, latest_published_revision: payload.latest_published_revision, is_current: payload.is_current }
}

import { consultationSummaryId } from './patient-consultation-summary'

export type ClinicalCreateKind = 'medication' | 'care_plan' | 'lab_request'
export type ClinicalCreateIntent = { creationId: string; owner: string; kind: ClinicalCreateKind; body: string }
export type ClinicalCreationReceipt = { creation_id: string; kind: ClinicalCreateKind; record_id: string; replayed: boolean; available: boolean }
const contracts = { medication: { singular: 'medication', plural: 'medications', prefix: 'med-' }, care_plan: { singular: 'care_plan', plural: 'care_plans', prefix: 'cp-' }, lab_request: { singular: 'lab_test', plural: 'test_requests', prefix: '' } } as const
function stable(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
  throw new Error('The creation details could not be prepared. Review the form and try again.')
}
export function sameClinicalCreateIntent(intent: ClinicalCreateIntent, owner: string, kind: ClinicalCreateKind, body: Record<string, unknown>) {
  return intent.owner === owner && intent.kind === kind && intent.body === JSON.stringify(stable(body))
}
/** The body and UUID live only in component memory; no draft or fingerprint is persisted. */
export function clinicalCreateIntent(previous: ClinicalCreateIntent | null, owner: string, kind: ClinicalCreateKind, body: Record<string, unknown>): ClinicalCreateIntent {
  if (!owner) throw new Error('Confirm your clinical session before creating this record.')
  const canonical = JSON.stringify(stable(body))
  return previous?.owner === owner && previous.kind === kind && previous.body === canonical ? previous : { creationId: crypto.randomUUID(), owner, kind, body: canonical }
}
/** A receipt confirms identity and current availability, never restoration of the initial body. */
export function clinicalCreationReceipt(value: unknown, intent: ClinicalCreateIntent): ClinicalCreationReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const response = value as Record<string, unknown>, raw = response.creation_receipt
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>, contract = contracts[intent.kind]
  if (consultationSummaryId(row.creation_id) !== intent.creationId || row.kind !== intent.kind || typeof row.record_id !== 'string' || !row.record_id.startsWith(contract.prefix) || !consultationSummaryId(row.record_id.slice(contract.prefix.length)) || typeof row.replayed !== 'boolean' || typeof row.available !== 'boolean' || row.available === false && row.replayed !== true) return null
  const record = response[contract.singular], list = response[contract.plural]
  if (!Array.isArray(list)) return null
  const matches = list.filter(item => item && typeof item === 'object' && !Array.isArray(item) && item.id === row.record_id).length
  if (row.available ? !record || typeof record !== 'object' || Array.isArray(record) || (record as Record<string, unknown>).id !== row.record_id || matches !== 1 : record !== null || matches !== 0) return null
  return { creation_id: intent.creationId, kind: intent.kind, record_id: row.record_id, replayed: row.replayed, available: row.available }
}

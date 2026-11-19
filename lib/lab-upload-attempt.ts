import { consultationSummaryId } from './patient-consultation-summary'

export type LabUploadAttempt = { owner: string; uploadId: string; file: File; note: string; digest: string }
export type LabUploadReceipt = { upload_id: string; file_id: string; replayed: boolean; current: boolean }

/** One intent stays in memory across identical retries; changed content gets a new UUID. */
export async function labUploadAttempt(previous: LabUploadAttempt | null, owner: string, file: File, note: string): Promise<LabUploadAttempt> {
  if (previous?.owner === owner && previous.file === file && previous.note === note) return previous
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(value => value.toString(16).padStart(2, '0')).join('')
  if (previous?.owner === owner && previous.note === note && previous.digest === digest && previous.file.name === file.name && previous.file.size === file.size && previous.file.type === file.type) return previous
  return { owner, uploadId: crypto.randomUUID(), file, note, digest }
}
export function labUploadReceipt(value: unknown, uploadId: string): LabUploadReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const receipt = value as Record<string, unknown>
  if (consultationSummaryId(receipt.upload_id) !== consultationSummaryId(uploadId) || !consultationSummaryId(uploadId) || consultationSummaryId(receipt.file_id) !== consultationSummaryId(uploadId) || typeof receipt.replayed !== 'boolean' || typeof receipt.current !== 'boolean') return null
  return { upload_id: receipt.upload_id as string, file_id: receipt.file_id as string, replayed: receipt.replayed, current: receipt.current }
}

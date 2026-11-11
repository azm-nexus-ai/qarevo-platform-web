const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const labReference = (value: unknown): string | null => typeof value === 'string' && uuid.test(value) ? value.toLowerCase() : null
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const instant = (value: unknown): string | null => typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null
export type LabReview = { state: 'pending' | 'acknowledged' | 'unavailable'; fileId: string | null; reviewId: string | null; reviewedAt: string | null; providerId: string | null; reviewerName: string | null }
export function labResultReview(value: unknown, expectedFileId: unknown): LabReview {
  const row = object(value), expected = labReference(expectedFileId), fileId = labReference(row.file_id)
  const unavailable: LabReview = { state: 'unavailable', fileId: null, reviewId: null, reviewedAt: null, providerId: null, reviewerName: null }
  if (!expected || fileId !== expected) return unavailable
  if (row.state === 'pending' && row.review_id === null && row.reviewed_at === null && row.reviewer_provider_id === null && row.reviewer_name === null) return { ...unavailable, state: 'pending', fileId }
  const reviewId = labReference(row.review_id), providerId = labReference(row.reviewer_provider_id), reviewedAt = instant(row.reviewed_at)
  if (row.state !== 'acknowledged' || !reviewId || (row.reviewer_provider_id !== null && !providerId) || !reviewedAt || !(row.reviewer_name === null || typeof row.reviewer_name === 'string' && row.reviewer_name.length <= 320)) return unavailable
  return { state: 'acknowledged', fileId, reviewId, providerId, reviewedAt, reviewerName: typeof row.reviewer_name === 'string' && row.reviewer_name.trim() ? row.reviewer_name : null }
}
export type LabReviewTarget = { patientId: string; orderId: string; fileId: string; title: string }
export function labReviewReceipt(value: unknown, expected: LabReviewTarget) {
  const row = object(value), id = labReference(row.id), providerId = labReference(row.provider_id), reviewedAt = instant(row.reviewed_at)
  if (!labReference(expected.patientId) || !labReference(expected.orderId) || !labReference(expected.fileId) || !id || !providerId || !reviewedAt || labReference(row.patient_id) !== labReference(expected.patientId) || labReference(row.lab_request_id) !== labReference(expected.orderId) || labReference(row.file_id) !== labReference(expected.fileId) || typeof row.replayed !== 'boolean' || typeof row.current !== 'boolean') return null
  return { id, providerId, reviewedAt, replayed: row.replayed, current: row.current }
}
export function patientLabRequestHref(value: unknown) { const id = labReference(value); return id ? `/patient/lab-requests?requestId=${encodeURIComponent(id)}` : undefined }
export function patientLabRequestTarget(parameters: URLSearchParams) {
  const values = parameters.getAll('requestId'), id = values.length === 1 ? labReference(values[0]) : null
  return { id, invalid: values.length > 0 && !id }
}

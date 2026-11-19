// Multipart requests must fit the current development hosting request ceiling.
// Larger clinical files need an authorised direct-storage upload ticket.
export const MAX_MEDICAL_UPLOAD_BYTES = 3 * 1024 * 1024
export function medicalUploadError(size: number): string | null {
  if (!Number.isFinite(size) || size <= 0) return 'Choose a non-empty medical document.'
  if (size > MAX_MEDICAL_UPLOAD_BYTES) return 'Choose a file of 3 MB or smaller. Larger uploads are not supported in this development environment.'
  return null
}

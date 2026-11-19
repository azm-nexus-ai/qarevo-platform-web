const VERSION = /^qwv1_[A-Za-z0-9_-]{43}$/
export const MISSING_CLINICAL_VERSION = 'This record has no usable write version. Reload the saved records, then reopen it before saving or deleting.'
export function clinicalWriteVersion(value: unknown): string | null { return typeof value === 'string' && VERSION.test(value) ? value : null }
export function recordWriteVersion(value: unknown): string | null { return value && typeof value === 'object' && !Array.isArray(value) ? clinicalWriteVersion((value as Record<string, unknown>).write_version) : null }
export function clinicalWriteHeaders(value: unknown): { 'If-Match': string } {
  const version = clinicalWriteVersion(value)
  if (!version) throw new Error(MISSING_CLINICAL_VERSION)
  return { 'If-Match': `"${version}"` }
}
export function strongClinicalIfMatch(value: unknown): string | null { return typeof value === 'string' && /^"qwv1_[A-Za-z0-9_-]{43}"$/.test(value) ? value : null }
/** Forward only this explicit header on existing clinician conditional-write routes. */
export function clinicalConditionalRoute(portal: string, method: string, path: string): boolean {
  if (portal !== 'doctor') return false
  if (method === 'PUT') return ['/api/v1/doctor/prescriptions', '/api/v1/doctor/lab-orders'].includes(path) || /^\/api\/v1\/doctor\/care-plans\/[A-Za-z0-9_-]{1,160}\/[A-Za-z0-9_-]{1,160}$/.test(path)
  return method === 'DELETE' && /^\/api\/v1\/doctor\/(?:prescriptions|care-plans|lab-orders)\/[A-Za-z0-9_-]{1,160}\/[A-Za-z0-9_-]{1,160}$/.test(path)
}
export function clinicalRecordChanged(status: number, body: string): boolean {
  if (status !== 412) return false
  try { const parsed = JSON.parse(body); return parsed?.detail?.error_code === 'CLINICAL_RECORD_CHANGED' } catch { return false }
}

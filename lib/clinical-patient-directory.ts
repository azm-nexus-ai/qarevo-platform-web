export const CLINICAL_PATIENT_PAGE_SIZE = 25
export const CLINICAL_PATIENT_SEARCH_MAX = 160
export type ClinicalPatientOption = { id: string; label: string }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value)
function patientOption(value: unknown): ClinicalPatientOption | null {
  const row = object(value)
  if (!identifier(row.patient_id)) return null
  const name = typeof row.name === 'string' && row.name.trim() && row.name.length <= 320 ? row.name : null
  const email = typeof row.email === 'string' && row.email.trim() && row.email.length <= 320 ? row.email : null
  return { id: row.patient_id, label: name || email || 'Assigned patient' }
}
export const CLINICAL_PATIENT_DIRECTORY_SEARCH_PATH = '/api/v1/doctor/patients/search'
export function clinicalPatientDirectoryBody(page: number, query = '') {
  return { page: Number.isSafeInteger(page) && page > 0 ? page : 1, page_size: CLINICAL_PATIENT_PAGE_SIZE, q: query.trim().slice(0, CLINICAL_PATIENT_SEARCH_MAX) }
}
export function clinicalSelectedPatientPath(patientId: string) {
  if (!identifier(patientId)) return null
  return `/api/v1/doctor/patients?${new URLSearchParams({ patient_id: patientId, page: '1', page_size: '1' })}`
}
export function clinicalPatientDirectoryPage(value: unknown, requestedPage: number) {
  const row = object(value)
  const invalid = !Array.isArray(row.patients) || row.patients.length > CLINICAL_PATIENT_PAGE_SIZE || (row.page !== undefined && row.page !== requestedPage) || (row.page_size !== undefined && row.page_size !== CLINICAL_PATIENT_PAGE_SIZE)
  const options = invalid ? [] : (row.patients as unknown[]).map(patientOption)
  const ids = options.flatMap(option => option ? [option.id] : [])
  const malformed = invalid || options.some(option => !option) || new Set(ids).size !== ids.length
  return { patients: malformed ? [] : options as ClinicalPatientOption[], invalid: malformed, hasNext: !malformed && row.has_next === true, hasPrevious: !malformed && requestedPage > 1, page: requestedPage }
}
export function clinicalSelectedPatient(value: unknown, patientId: string): ClinicalPatientOption | null {
  const row = object(value)
  if (!identifier(patientId) || !Array.isArray(row.patients) || row.patients.length !== 1 || (row.page !== undefined && row.page !== 1) || (row.page_size !== undefined && row.page_size !== 1)) return null
  const matches = row.patients.map(patientOption).filter(patient => patient?.id === patientId)
  return matches.length === 1 ? matches[0] : null
}

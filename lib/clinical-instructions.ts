import { ApiError } from './api'

export const MEDICATION_FIELDS = [
  { key: 'name', label: 'Medication Name', required: true, max: 160, placeholder: 'e.g., Amlodipine' },
  { key: 'brand', label: 'Brand', max: 160, placeholder: 'e.g., Generic' },
  { key: 'strength', label: 'Strength', required: true, max: 160, placeholder: 'e.g., 5 mg' },
  { key: 'dosage', label: 'Dosage', required: true, max: 1000, placeholder: 'e.g., 1 tablet' },
  { key: 'frequency', label: 'Frequency', required: true, max: 500, placeholder: 'e.g., Once daily' },
  { key: 'duration', label: 'Duration', required: true, max: 500, placeholder: 'e.g., 30 days' },
  { key: 'instructions', label: 'Instructions', max: 5000, multiline: true, placeholder: 'Special instructions' },
  { key: 'food', label: 'Food instructions', max: 1000, placeholder: 'e.g., Take with food' },
  { key: 'refill', label: 'Refill status', max: 500, placeholder: 'e.g., Refill ready' },
] as const
export const DAYPARTS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const
export type ClinicalQuality = { reviewNeeded: boolean; warnings: { field: string; code: string }[]; unavailableFields: string[]; scheduleState: 'recorded' | 'not_recorded' | 'unavailable' }
export type MedicationInstruction = { id: string | null; name: string | null; brand: string | null; strength: string | null; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; food: string | null; refill: string | null; status: string | null; times: string[]; quality: ClinicalQuality; takenToday: boolean; reportedAt: string | null; recordedOn: string | null; timeZone: string | null; canMarkTaken: boolean }
export type CareInstruction = { id: string | null; title: string | null; status: string | null; description: string | null; progress: number | null; quality: ClinicalQuality }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const clinicalText = (value: unknown, max = 10000): string | null => typeof value === 'string' && value.length <= max ? value : null
export const instructionIdentifier = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value) ? value : null
export const medicationIdentifier = instructionIdentifier
export const scheduleTime = (value: unknown): value is string => typeof value === 'string' && (DAYPARTS.some(part => part === value) || /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value))
function quality(value: unknown, extra: { field: string; code: string }[] = []): ClinicalQuality {
  const raw = object(value), warnings = Array.isArray(raw.warnings) ? raw.warnings.slice(0, 30).flatMap(value => { const item = object(value); return typeof item.field === 'string' && item.field.length <= 80 && typeof item.code === 'string' && item.code.length <= 80 ? [{ field: item.field, code: item.code }] : [] }) : []
  const all = [...warnings, ...extra].filter((item, index, rows) => rows.findIndex(other => other.field === item.field && other.code === item.code) === index)
  return { reviewNeeded: raw.review_needed === true || all.length > 0, warnings: all, unavailableFields: Array.isArray(raw.unavailable_fields) ? raw.unavailable_fields.filter((field): field is string => typeof field === 'string').slice(0, 30) : [], scheduleState: raw.schedule_state === 'recorded' || raw.schedule_state === 'unavailable' ? raw.schedule_state : 'not_recorded' }
}
function validTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80) return null
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return value } catch { return null }
}
export function medicationInstruction(value: unknown): MedicationInstruction {
  const row = object(value), warnings: { field: string; code: string }[] = []
  const scalar = Object.fromEntries(MEDICATION_FIELDS.map(field => { const text = clinicalText(row[field.key], field.max); if ('required' in field && field.required ? text === null || !text.trim() : row[field.key] != null && text === null) warnings.push({ field: field.key, code: text === null ? row[field.key] == null ? 'missing_value' : 'invalid_type' : 'blank_value' }); return [field.key, text] })) as Pick<MedicationInstruction, typeof MEDICATION_FIELDS[number]['key']>
  const validTimes = Array.isArray(row.times) && row.times.length <= 24 && row.times.every(scheduleTime) && new Set(row.times).size === row.times.length
  if (row.times != null && !validTimes) warnings.push({ field: 'times', code: 'invalid_schedule' })
  const recordQuality = quality(row.data_quality, warnings)
  const times = validTimes && recordQuality.scheduleState !== 'unavailable' ? row.times as string[] : []
  recordQuality.scheduleState = !validTimes && row.times != null || recordQuality.scheduleState === 'unavailable' ? 'unavailable' : times.length ? 'recorded' : 'not_recorded'
  const id = instructionIdentifier(row.id), status = clinicalText(row.status, 80), adherence = object(row.adherence)
  if (!id) { recordQuality.reviewNeeded = true; recordQuality.warnings.push({ field: 'id', code: 'invalid_identifier' }) }
  if (status?.trim().toLowerCase() === 'taken today') { recordQuality.reviewNeeded = true; if (!recordQuality.warnings.some(warning => warning.field === 'status' && warning.code === 'historical_adherence_status')) recordQuality.warnings.push({ field: 'status', code: 'historical_adherence_status' }) }
  return { ...scalar, id, status, times, quality: recordQuality, takenToday: row.taken_today === true && adherence.source === 'patient-reported' && adherence.reported_today === true,
    reportedAt: typeof adherence.reported_at === 'string' && Number.isFinite(Date.parse(adherence.reported_at)) ? adherence.reported_at : null,
    recordedOn: typeof adherence.recorded_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(adherence.recorded_on) ? adherence.recorded_on : null,
    timeZone: validTimeZone(adherence.time_zone),
    canMarkTaken: row.can_mark_taken === true && Boolean(id) && instructionActionsAllowed({ id, quality: recordQuality }) && status?.trim().toLowerCase() === 'active' && MEDICATION_FIELDS.filter(field => 'required' in field && field.required).every(field => Boolean(scalar[field.key]?.trim())) }
}
export function careInstruction(value: unknown): CareInstruction {
  const row = object(value), title = clinicalText(row.title, 220), progress = typeof row.progress === 'number' && Number.isInteger(row.progress) && row.progress >= 0 && row.progress <= 100 ? row.progress : null
  return { id: instructionIdentifier(row.id), title, status: clinicalText(row.status, 80), description: clinicalText(row.description, 10000), progress, quality: quality(row.data_quality, [...(!title?.trim() ? [{ field: 'title', code: 'missing_value' }] : []), ...(row.progress != null && progress === null ? [{ field: 'progress', code: 'invalid_type' }] : [])]) }
}
export function instructionList(value: unknown) {
  const valid = (item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  if (!Array.isArray(value)) return { items: [], truncated: false, invalid: true, invalidCount: 0, duplicateIds: [] as string[] }
  const rows = value.slice(0, 200), ids = rows.map(item => instructionIdentifier(object(item).id)).filter((id): id is string => Boolean(id))
  return { items: rows.filter(valid), truncated: value.length > 200, invalid: false, invalidCount: rows.filter(item => !valid(item)).length, duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))] }
}
export function instructionActionsAllowed(record: { id: string | null; quality: ClinicalQuality }) {
  return Boolean(record.id) && !record.quality.unavailableFields.includes('id') && !record.quality.warnings.some(warning => warning.field === 'id')
}

export function clinicalValidationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) return {}
  try { const detail = JSON.parse(error.body).detail; if (!Array.isArray(detail)) return {}; return Object.fromEntries(detail.flatMap(value => { const item = object(value), loc = Array.isArray(item.loc) ? item.loc.filter(value => typeof value === 'string' && value !== 'body') : []; return loc.length && typeof item.msg === 'string' ? [[String(loc[0]), item.msg]] : [] })) } catch { return {} }
}
export function qualityDescription(warning: { field: string; code: string }) {
  const field = MEDICATION_FIELDS.find(item => item.key === warning.field)?.label || ({ times: 'Schedule', status: 'Clinical status', title: 'Title', progress: 'Progress', id: 'Record identifier' } as Record<string, string>)[warning.field] || 'Saved field'
  return `${field}: ${warning.code === 'historical_adherence_status' ? 'an old adherence report is stored as clinical status; clinician review is needed.' : ['missing_value', 'blank_value'].includes(warning.code) ? 'not recorded.' : warning.code === 'unknown_status' ? 'the recorded value needs review.' : 'the historical value requires clinician review.'}`
}

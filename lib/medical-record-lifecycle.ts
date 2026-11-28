import { labUploadAttempt, type LabUploadAttempt } from './lab-upload-attempt'
import { consultationSummaryId } from './patient-consultation-summary'
import { medicalUploadError } from './clinical-upload'
export type MedicalUploadFields = { title: string; record_type: string; description: string; provider_name: string; record_date: string }
export type MedicalUploadAttempt = LabUploadAttempt
export const MEDICAL_DOCUMENT_TYPES = ['Consultation', 'Prescription', 'Lab Result', 'Diagnosis', 'Referral', 'Medical Document'] as const
export const MEDICAL_FILE_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/jpg,image/webp'
const allowedMime = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
export function medicalUploadFields(values: MedicalUploadFields, file: File | null) {
  const fields = { ...values, title: values.title.trim(), provider_name: values.provider_name.trim() }, errors: Partial<Record<keyof MedicalUploadFields | 'file', string>> = {}
  if (!fields.title) errors.title = 'Enter the document name.'
  else if (fields.title.length > 255) errors.title = 'Use 255 characters or fewer for the document name.'
  if (!MEDICAL_DOCUMENT_TYPES.some(type => type === fields.record_type)) errors.record_type = 'Choose a supported medical record type.'
  if (fields.description.length > 5000) errors.description = 'Use 5,000 characters or fewer for the description.'
  if (fields.provider_name.length > 255) errors.provider_name = 'Use 255 characters or fewer for the provider or facility.'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(fields.record_date) ? new Date(fields.record_date + 'T00:00:00Z') : null
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fields.record_date) errors.record_date = 'Enter a valid date of record (YYYY-MM-DD).'
  if (!file) errors.file = 'Choose a medical document to upload.'
  else errors.file = medicalUploadError(file.size) || (!allowedMime.has(file.type) ? 'Choose a PDF, DOC, DOCX, PNG, JPEG or WEBP file.' : undefined)
  return { fields, errors: Object.fromEntries(Object.entries(errors).filter(([, value]) => value)) as typeof errors }
}
/** The same file and canonical submitted metadata reuse the in-memory upload UUID. */
export function medicalRecordUploadAttempt(previous: MedicalUploadAttempt | null, owner: string, file: File, fields: MedicalUploadFields) {
  return labUploadAttempt(previous, owner, file, JSON.stringify(fields))
}
export function medicalRecordUploadReceipt(value: unknown, uploadId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>, expected = consultationSummaryId(uploadId)
  if (!expected || consultationSummaryId(row.upload_id) !== expected || consultationSummaryId(row.file_id) !== expected || typeof row.replayed !== 'boolean' || typeof row.available !== 'boolean') return null
  return { uploadId: expected, fileId: expected, replayed: row.replayed, available: row.available }
}
export function medicalRecordDeleteReceipt(value: unknown, fileId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>, expected = consultationSummaryId(fileId)
  return expected && consultationSummaryId(row.file_id) === expected && row.deleted === true && typeof row.replayed === 'boolean' ? { fileId: expected, replayed: row.replayed } : null
}

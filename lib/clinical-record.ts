export const clinicalFields = [
  { key: 'summary', label: 'Patient summary', max: 5000, hint: 'Explain the consultation and agreed next steps in language the patient understands.' },
  { key: 'history', label: 'History', max: 10000, hint: 'Record the history discussed and relevant limitations.' },
  { key: 'findings', label: 'Findings', max: 10000, hint: 'Record observed findings. State what could not be assessed remotely.' },
  { key: 'assessment', label: 'Clinical assessment', max: 10000, hint: 'Record your assessment and any uncertainty.' },
  { key: 'plan', label: 'Care plan', max: 10000, hint: 'Record the agreed treatment and follow-up. This summary does not issue an electronic prescription.' },
  { key: 'safety_net', label: 'Safety and follow-up advice', max: 5000, hint: 'Record warning signs and when and where the patient should seek further help.' },
] as const
export type ClinicalField = typeof clinicalFields[number]['key']
export type RecordContent = Record<ClinicalField, string> & { language: 'en' | 'de' }
export type PublishedClinicalRecord = RecordContent & {
  id: string; episode_id: string; consultation_id: string; revision: number; version: number
  authored_by: string; approved_by: string | null; published_at: string | null
  created_at: string; updated_at: string; amendment_reason: string | null
}
export type ClinicalRecordState = { draft: PublishedClinicalRecord | null; published: PublishedClinicalRecord | null }
export const emptyRecord: RecordContent = { language: 'en', summary: '', history: '', findings: '', assessment: '', plan: '', safety_net: '' }
export function contentOf(record: PublishedClinicalRecord | null): RecordContent {
  return record ? Object.fromEntries(['language', ...clinicalFields.map(field => field.key)].map(key => [key, record[key as keyof RecordContent]])) as RecordContent : { ...emptyRecord }
}
export function recordErrors(content: RecordContent, publishing: boolean): Partial<Record<ClinicalField, string>> {
  const errors: Partial<Record<ClinicalField, string>> = {}
  for (const field of clinicalFields) {
    const value = content[field.key].trim()
    if (publishing && !value) errors[field.key] = `${field.label} is required before publication.`
    else if (value.length > field.max) errors[field.key] = `${field.label} must be ${field.max.toLocaleString('en')} characters or fewer.`
  }
  return errors
}

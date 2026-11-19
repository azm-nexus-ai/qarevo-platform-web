/** Treating-entity verification contracts shared by the practice, doctor and admin portals.
 * Practices and independent practitioners use the same shapes; only the base path differs. */
import { ApiError } from './api'
import { object, practice, uuid, type Practice } from './practice'

export type EntityType = 'PRACTICE' | 'INDEPENDENT'
export type EntityProfile = {
  entity_type: EntityType; jurisdiction: string; currency: string; time_zone: string; locale: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'; verified_at: string | null; public_insurance_eligible: boolean
}
export type TreatingEntity = Practice & { entity: EntityProfile; bookable: boolean }
export type FieldRule = { key: string; label: string; required: boolean; group: string | null; choices: string[]; max_length: number; hint: string; pattern: string | null }
export type DocumentRule = { key: string; label: string; per_clinician: boolean; required: boolean; required_with: string | null }
export type RequirementSet = { key: string; jurisdiction: string; entity_type: EntityType; effective_from: string; entity_fields: FieldRule[]; clinician_fields: FieldRule[]; documents: DocumentRule[]; pending_input: string; notes: string[] }
export type Clinician = { user_id: string; membership_id: string; full_name: string; email: string }
export type Evidence = { id: string; requirement_key: string; subject_user_id: string | null; original_filename: string; content_type: string; size_bytes: number; sha256: string; created_at: string; removed_at: string | null }
export type LegalStatus = { kind: string; version: string; review_status: string; accepted: boolean; accepted_at: string | null; accepted_locale: string | null; sha256: string | null }
export type SubmissionStatus = 'SUBMITTED' | 'FIRST_APPROVED' | 'APPROVED' | 'REJECTED'
export type Submission = {
  id: string; practice_id: string; entity_type: EntityType; jurisdiction: string; requirement_set: string; status: SubmissionStatus
  version: number; public_insurance_eligible: boolean; submitted_at: string; first_approved_at: string | null
  second_approved_at: string | null; rejected_at: string | null; rejection_reason: string | null; declaration_sha256: string
}
export type MissingDocument = { requirement_key: string; label: string; subject_user_id: string | null; clinician?: string }
export type VerificationOverview = {
  practice: TreatingEntity; requirements: RequirementSet; clinicians: Clinician[]; evidence: Evidence[]; legal: LegalStatus[]
  latest_submission: Submission | null; missing_documents: MissingDocument[]; can_submit: boolean
}
export type LegalDocument = { kind: string; version: string; locale: string; effective_from: string; review_status: string; title: string; body: string; sha256: string }
export type Declaration = {
  requirement_set: string; entity_fields: Record<string, string>
  clinicians: { user_id: string; membership_id: string; full_name: string; fields: Record<string, string> }[]
  evidence: { id: string; requirement_key: string; sha256: string; subject_user_id: string | null }[]
  legal: { kind: string; version: string; sha256: string | null; accepted_locale: string | null; accepted_at: string | null }[]
}
export type SubmissionDetail = Submission & {
  declaration: Declaration; submitted_by_user_id: string | null; first_approved_by_user_id: string | null
  second_approved_by_user_id: string | null; rejected_by_user_id: string | null; first_approval_reason: string | null; second_approval_reason: string | null
}
export type QueueRow = Submission & { practice_name: string; practice_status: string }

export const EVIDENCE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const EVIDENCE_MAX_BYTES = 3 * 1024 * 1024
export const LEGAL_KIND_LABELS: Record<string, string> = {
  PLATFORM_AGREEMENT: 'Platform agreement', DATA_PROCESSING_AGREEMENT: 'Data processing agreement (AVV)',
  PATIENT_TERMS: 'Patient terms of use', PRIVACY_NOTICE: 'Privacy notice',
}
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: 'Waiting for the first review', FIRST_APPROVED: 'Waiting for the second review',
  APPROVED: 'Verified', REJECTED: 'Changes requested',
}

const text = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.length <= max
const stamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const optionalStamp = (value: unknown) => value === null || stamp(value)
const optionalText = (value: unknown, max = 2000) => value === null || text(value, max)
const sha = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const entityType = (value: unknown): value is EntityType => value === 'PRACTICE' || value === 'INDEPENDENT'
const list = <T,>(value: unknown, parse: (item: unknown) => T | null, max = 1000): T[] | null => {
  if (!Array.isArray(value) || value.length > max) return null
  const rows: T[] = []
  for (const item of value) { const row = parse(item); if (row === null) return null; rows.push(row) }
  return rows
}

export function entityProfile(value: unknown): EntityProfile | null {
  if (!object(value) || !entityType(value.entity_type) || !text(value.jurisdiction, 2) || !text(value.currency, 3) || !text(value.time_zone, 64) ||
    !text(value.locale, 16) || !['UNVERIFIED', 'VERIFIED'].includes(String(value.verification_status)) || !optionalStamp(value.verified_at) ||
    typeof value.public_insurance_eligible !== 'boolean') return null
  return value as unknown as EntityProfile
}

export function treatingEntity(value: unknown): TreatingEntity | null {
  const base = practice(value)
  if (!base || !object(value) || typeof value.bookable !== 'boolean') return null
  const entity = entityProfile(value.entity)
  return entity ? { ...base, entity, bookable: value.bookable } : null
}

function fieldRule(value: unknown): FieldRule | null {
  if (!object(value) || !text(value.key, 60) || !text(value.label, 200) || typeof value.required !== 'boolean' || !optionalText(value.group, 60) ||
    !Array.isArray(value.choices) || !value.choices.every(choice => text(choice, 200)) || typeof value.max_length !== 'number' ||
    !text(value.hint, 200) || !optionalText(value.pattern, 200)) return null
  return value as unknown as FieldRule
}

function documentRule(value: unknown): DocumentRule | null {
  return object(value) && text(value.key, 60) && text(value.label, 200) && typeof value.per_clinician === 'boolean' && typeof value.required === 'boolean' &&
    optionalText(value.required_with, 60) ? value as unknown as DocumentRule : null
}

export function requirementSet(value: unknown): RequirementSet | null {
  if (!object(value) || !text(value.key, 60) || !entityType(value.entity_type) || !text(value.jurisdiction, 2) || !text(value.effective_from, 20) ||
    !text(value.pending_input, 60) || !Array.isArray(value.notes)) return null
  const entity_fields = list(value.entity_fields, fieldRule, 50), clinician_fields = list(value.clinician_fields, fieldRule, 50), documents = list(value.documents, documentRule, 50)
  return entity_fields && clinician_fields && documents ? { ...(value as unknown as RequirementSet), entity_fields, clinician_fields, documents } : null
}

function clinician(value: unknown): Clinician | null {
  return object(value) && uuid(value.user_id) && uuid(value.membership_id) && text(value.full_name, 200) && text(value.email, 255) ? value as unknown as Clinician : null
}

export function evidence(value: unknown): Evidence | null {
  if (!object(value) || !uuid(value.id) || !text(value.requirement_key, 60) || !(value.subject_user_id === null || uuid(value.subject_user_id)) ||
    !text(value.original_filename, 255) || !text(value.content_type, 100) || typeof value.size_bytes !== 'number' || value.size_bytes <= 0 ||
    !sha(value.sha256) || !stamp(value.created_at) || !optionalStamp(value.removed_at)) return null
  return value as unknown as Evidence
}

function legalStatus(value: unknown): LegalStatus | null {
  return object(value) && text(value.kind, 40) && text(value.version, 40) && text(value.review_status, 60) && typeof value.accepted === 'boolean' &&
    optionalStamp(value.accepted_at) && optionalText(value.accepted_locale, 8) && (value.sha256 === null || sha(value.sha256)) ? value as unknown as LegalStatus : null
}

export function submission(value: unknown): Submission | null {
  if (!object(value) || !uuid(value.id) || !uuid(value.practice_id) || !entityType(value.entity_type) || !text(value.requirement_set, 60) ||
    !['SUBMITTED', 'FIRST_APPROVED', 'APPROVED', 'REJECTED'].includes(String(value.status)) || typeof value.version !== 'number' || value.version < 1 ||
    typeof value.public_insurance_eligible !== 'boolean' || !stamp(value.submitted_at) || !optionalStamp(value.first_approved_at) ||
    !optionalStamp(value.second_approved_at) || !optionalStamp(value.rejected_at) || !optionalText(value.rejection_reason, 500) || !sha(value.declaration_sha256)) return null
  return value as unknown as Submission
}

function missingDocument(value: unknown): MissingDocument | null {
  return object(value) && text(value.requirement_key, 60) && text(value.label, 200) && (value.subject_user_id === null || uuid(value.subject_user_id)) ? value as unknown as MissingDocument : null
}

export function verificationOverview(value: unknown): VerificationOverview | null {
  if (!object(value) || typeof value.can_submit !== 'boolean') return null
  const saved = treatingEntity(value.practice), requirements = requirementSet(value.requirements)
  const clinicians = list(value.clinicians, clinician), files = list(value.evidence, evidence), legal = list(value.legal, legalStatus, 20)
  const missing = list(value.missing_documents, missingDocument)
  const latest = value.latest_submission === null ? null : submission(value.latest_submission)
  if (!saved || !requirements || !clinicians || !files || !legal || !missing || (value.latest_submission !== null && !latest)) return null
  if (latest && latest.practice_id !== saved.id) return null
  return { practice: saved, requirements, clinicians, evidence: files, legal, latest_submission: latest, missing_documents: missing, can_submit: value.can_submit }
}

export function legalDocument(value: unknown): LegalDocument | null {
  return object(value) && text(value.kind, 40) && text(value.version, 40) && text(value.locale, 8) && text(value.effective_from, 20) &&
    text(value.review_status, 60) && text(value.title, 300) && text(value.body, 100_000) && sha(value.sha256) ? value as unknown as LegalDocument : null
}

export function submissionDetail(value: unknown): SubmissionDetail | null {
  const base = submission(value)
  if (!base || !object(value) || !object(value.declaration)) return null
  const declaration = value.declaration
  if (!object(declaration.entity_fields) || !Array.isArray(declaration.clinicians) || !Array.isArray(declaration.evidence) || !Array.isArray(declaration.legal)) return null
  return value as unknown as SubmissionDetail
}

export function queueRow(value: unknown): QueueRow | null {
  const base = submission(value)
  return base && object(value) && text(value.practice_name, 160) && text(value.practice_status, 20) ? value as unknown as QueueRow : null
}

/** Which documents are still needed, given the details typed so far. */
export function neededDocuments(rules: RequirementSet, fields: Record<string, string>, clinicians: Clinician[], files: Evidence[]) {
  const filled = (key: string) => Boolean(fields[key]?.trim())
  const groups = new Set(rules.entity_fields.filter(rule => rule.group && filled(rule.key)).map(rule => rule.group as string))
  const rows: { rule: DocumentRule; clinician: Clinician | null; uploaded: Evidence[] }[] = []
  for (const rule of rules.documents) {
    const needed = rule.required || (rule.required_with !== null && (filled(rule.required_with) || groups.has(rule.required_with)))
    if (!needed && !files.some(file => file.requirement_key === rule.key)) continue
    const targets = rule.per_clinician ? clinicians : [null]
    for (const target of targets) rows.push({ rule, clinician: target, uploaded: files.filter(file => file.requirement_key === rule.key && (!rule.per_clinician || file.subject_user_id === target?.user_id)) })
  }
  return rows
}

/** Client-side mirror of the server's field rules, so problems show before submission. */
export function fieldErrors(rules: FieldRule[], values: Record<string, string>, prefix: string) {
  const errors: Record<string, string> = {}
  for (const rule of rules) {
    const value = (values[rule.key] ?? '').trim()
    if (!value) { if (rule.required) errors[prefix + rule.key] = `Enter the ${rule.label}.`; continue }
    if (value.length > rule.max_length) errors[prefix + rule.key] = `Use at most ${rule.max_length} characters.`
    else if (rule.pattern && !new RegExp(`^(?:${rule.pattern})$`).test(value)) errors[prefix + rule.key] = `${rule.label}: ${rule.hint || 'check the format.'}`
    else if (rule.choices.length && !rule.choices.includes(value)) errors[prefix + rule.key] = `Choose one of the listed options for ${rule.label}.`
  }
  for (const group of new Set(rules.filter(rule => rule.group).map(rule => rule.group as string))) {
    const members = rules.filter(rule => rule.group === group), provided = members.filter(rule => (values[rule.key] ?? '').trim())
    if (provided.length && provided.length !== members.length) for (const rule of members) if (!(values[rule.key] ?? '').trim()) errors[prefix + rule.key] = `Provide all statutory-insurance details together, or none of them (${rule.label} is missing).`
  }
  return errors
}

export function fileProblem(file: File): string | null {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(file.type)) return 'Upload a PDF, JPEG or PNG file.'
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > EVIDENCE_MAX_BYTES) return 'Upload a file of at most 3 MB.'
  return null
}

export const formatBytes = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`

/** Itemised reasons the server refused a submission, for display next to the form. */
export function submissionProblems(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.status !== 422) return []
  try {
    const parsed = JSON.parse(error.body) as { detail?: unknown }
    const detail = parsed.detail
    if (!object(detail)) return []
    const problems = Array.isArray(detail.problems) ? detail.problems.filter((item): item is string => typeof item === 'string') : []
    const missing = Array.isArray(detail.missing_documents) ? detail.missing_documents.filter(object).map(item => `Upload the ${String(item.label).toLowerCase()}${typeof item.clinician === 'string' ? ' for ' + item.clinician : ''}.`) : []
    const legal = Array.isArray(detail.unaccepted_documents) ? detail.unaccepted_documents.filter((item): item is string => typeof item === 'string').map(kind => `Accept the ${(LEGAL_KIND_LABELS[kind] ?? kind).toLowerCase()}.`) : []
    return [...problems, ...missing, ...legal].slice(0, 30)
  } catch { return [] }
}

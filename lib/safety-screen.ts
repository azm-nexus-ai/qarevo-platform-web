// Red-flag safety screen: patient flow and admin governance client.
// Content is clinical content owned by authorised administrators; this module
// only transports and validates its shape. Outcomes are computed by the API.

import { apiGet, apiPost, apiPut } from '@/lib/api'

export type SafetyRoute = 'EMERGENCY' | 'URGENT' | 'IN_PERSON'
export type SafetyOutcome = SafetyRoute | 'CONTINUE'
export const SAFETY_ROUTES: SafetyRoute[] = ['EMERGENCY', 'URGENT', 'IN_PERSON']
export const ROUTE_LABELS: Record<SafetyRoute, string> = {
  EMERGENCY: 'Emergency (112)',
  URGENT: 'Urgent care (116117)',
  IN_PERSON: 'In-person examination',
}

export type OutcomeGuidance = { title: string; body: string; action_label?: string | null; action_href?: string | null }
export type SafetyQuestion = { id: string; prompt: string; help?: string | null; route_if_yes: SafetyRoute }
export type SafetyContent = {
  intro?: string | null
  questions: SafetyQuestion[]
  outcomes: Partial<Record<SafetyRoute, OutcomeGuidance>>
  continue_message?: string | null
}

export type PatientSafetyScreen =
  | { available: false; required: boolean; enabled?: boolean }
  | {
      available: true; required: boolean; version_id: string; version_number: number; locale: string; title: string
      intro?: string | null; questions: { id: string; prompt: string; help?: string | null }[]
      outcomes: Partial<Record<SafetyRoute, OutcomeGuidance>>; continue_message?: string | null
    }
export type SafetyScreenStatus = { available: boolean; required: boolean; passed: boolean; valid_until: string | null; enabled?: boolean }
export type SafetyScreenResult = {
  response_id: string; outcome: SafetyOutcome; allows_booking: boolean
  guidance: OutcomeGuidance | null; continue_message: string | null; valid_until: string | null
}

export const getPatientSafetyScreen = () => apiGet<PatientSafetyScreen>('/api/v1/patient/safety-screen')
export const getPatientSafetyStatus = () => apiGet<SafetyScreenStatus>('/api/v1/patient/safety-screen/status')
export const submitSafetyAnswers = (versionId: string, answers: Record<string, boolean>) =>
  apiPost<SafetyScreenResult>('/api/v1/patient/safety-screen/responses', { version_id: versionId, answers })

/** Only internal booking pages may be the continuation after a passed screen. */
export function safeBookingReturn(value: string | null | undefined): string {
  const fallback = '/patient/consultation-booking/date-time'
  if (!value || !value.startsWith('/patient/consultation-booking/') || value.startsWith('//') || /[\\\s]/.test(value)) return fallback
  if (value.startsWith('/patient/consultation-booking/safety')) return fallback
  return value
}

// --- admin governance ---------------------------------------------------------------

export type VersionStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED'
export type VersionSummary = {
  id: string; version_number: number; locale: string; status: VersionStatus; title: string; content_sha256: string
  lock_version: number; question_count: number; change_note: string | null; based_on_version_id: string | null
  created_by: string | null; created_at: string | null; updated_by: string | null; updated_at: string | null
  approved_by: string | null; approved_at: string | null; published_by: string | null; published_at: string | null
  retired_by: string | null; retired_at: string | null
}
export type AuditEvent = { action: string; by: string | null; at: string | null; changes: Record<string, unknown> | null; reason: string | null }
export type VersionDetail = VersionSummary & {
  content: SafetyContent; approved_sha256: string | null; audit: AuditEvent[]
  can: { edit: boolean; approve: boolean; publish: boolean; retire: boolean }
}
export type MyPermissions = { permissions: ('AUTHOR' | 'APPROVE')[]; can_manage_permissions: boolean; booking_requires_screen: boolean }
export type Grant = {
  id: string; admin_id: string; admin_name: string; admin_role: string; admin_status: string
  permission: 'AUTHOR' | 'APPROVE'; granted_by: string | null; granted_at: string | null
}

const base = '/api/v1/admin/clinical-safety'
export const getMySafetyPermissions = () => apiGet<MyPermissions>(`${base}/me`)
export const listSafetyVersions = () => apiGet<{ versions: VersionSummary[] }>(`${base}/versions`)
export const getSafetyVersion = (id: string) => apiGet<VersionDetail>(`${base}/versions/${encodeURIComponent(id)}`)
export const createSafetyDraft = (body: { locale: string; title: string; content: SafetyContent; change_note?: string; based_on_version_id?: string }) =>
  apiPost<VersionDetail>(`${base}/versions`, body)
export const updateSafetyDraft = (id: string, body: { lock_version: number; title: string; content: SafetyContent; change_note?: string }) =>
  apiPut<VersionDetail>(`${base}/versions/${encodeURIComponent(id)}`, body)
export const approveSafetyVersion = (id: string, body: { lock_version: number; content_sha256: string; note?: string }) =>
  apiPost<VersionDetail>(`${base}/versions/${encodeURIComponent(id)}/approve`, body)
export const publishSafetyVersion = (id: string, lockVersion: number) =>
  apiPost<VersionDetail>(`${base}/versions/${encodeURIComponent(id)}/publish`, { lock_version: lockVersion })
export const retireSafetyVersion = (id: string, lockVersion: number, reason?: string) =>
  apiPost<VersionDetail>(`${base}/versions/${encodeURIComponent(id)}/retire`, { lock_version: lockVersion, reason })
export const listSafetyGrants = () => apiGet<{ grants: Grant[] }>(`${base}/grants`)
export const grantSafetyPermission = (adminId: string, permission: 'AUTHOR' | 'APPROVE') =>
  apiPost<{ id: string }>(`${base}/grants`, { admin_id: adminId, permission })
export const revokeSafetyPermission = (grantId: string) => apiPost<{ id: string }>(`${base}/grants/${encodeURIComponent(grantId)}/revoke`)

// --- editor helpers (mirror the API's validation so authors see problems early) ------

const SLUG = /^[a-z0-9][a-z0-9-]{1,47}$/
const HREF = /^(tel:\+?[0-9 ]{2,20}|https:\/\/[^\s<>"']{4,300})$/

export function emptySafetyContent(): SafetyContent {
  return { intro: '', questions: [{ id: '', prompt: '', help: '', route_if_yes: 'EMERGENCY' }], outcomes: {}, continue_message: '' }
}

export function questionId(prompt: string, taken: string[]): string {
  const stem = prompt.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'question'
  let candidate = stem.length < 2 ? `q-${stem}` : stem
  for (let n = 2; taken.includes(candidate); n += 1) candidate = `${stem.slice(0, 40)}-${n}`
  return candidate
}

const within = (value: string | null | undefined, low: number, high: number) => {
  const length = (value ?? '').trim().length
  return length >= low && length <= high
}

export function safetyContentErrors(title: string, content: SafetyContent): string[] {
  const problems: string[] = []
  if (!within(title, 3, 160)) problems.push('Title must be 3 to 160 characters.')
  if (content.intro && !within(content.intro, 1, 1000)) problems.push('Introduction must be at most 1,000 characters.')
  if (!content.questions.length || content.questions.length > 30) problems.push('Add 1 to 30 questions.')
  const ids = new Set<string>()
  const used = new Set<SafetyRoute>()
  content.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`
    if (!SLUG.test(question.id)) problems.push(`${label} needs an id of 2–48 lowercase letters, digits or hyphens.`)
    if (ids.has(question.id)) problems.push(`${label} repeats the id “${question.id}”.`)
    ids.add(question.id)
    if (!within(question.prompt, 3, 300)) problems.push(`${label} prompt must be 3 to 300 characters.`)
    if (question.help && !within(question.help, 1, 500)) problems.push(`${label} help must be at most 500 characters.`)
    if (!SAFETY_ROUTES.includes(question.route_if_yes)) problems.push(`${label} needs a route for a yes answer.`)
    else used.add(question.route_if_yes)
  })
  for (const route of SAFETY_ROUTES) {
    const guidance = content.outcomes[route]
    if (!guidance) { if (used.has(route)) problems.push(`Write the patient guidance for ${ROUTE_LABELS[route]}.`); continue }
    if (!within(guidance.title, 3, 120)) problems.push(`${ROUTE_LABELS[route]}: title must be 3 to 120 characters.`)
    if (!within(guidance.body, 3, 1200)) problems.push(`${ROUTE_LABELS[route]}: guidance must be 3 to 1,200 characters.`)
    const hasLabel = Boolean(guidance.action_label?.trim()), hasHref = Boolean(guidance.action_href?.trim())
    if (hasLabel !== hasHref) problems.push(`${ROUTE_LABELS[route]}: give both an action label and a link, or neither.`)
    if (hasHref && !HREF.test(guidance.action_href!.trim())) problems.push(`${ROUTE_LABELS[route]}: the link must be tel:… or https://…`)
  }
  if (content.continue_message && !within(content.continue_message, 1, 500)) problems.push('Continue message must be at most 500 characters.')
  return problems
}

/** Content as the API expects it: blank optional fields omitted, unused outcomes dropped only if empty. */
export function cleanSafetyContent(content: SafetyContent): SafetyContent {
  const blank = (value?: string | null) => (value ?? '').trim() || null
  const outcomes: SafetyContent['outcomes'] = {}
  for (const route of SAFETY_ROUTES) {
    const guidance = content.outcomes[route]
    if (!guidance || (!guidance.title?.trim() && !guidance.body?.trim())) continue
    outcomes[route] = { title: guidance.title.trim(), body: guidance.body.trim(), action_label: blank(guidance.action_label), action_href: blank(guidance.action_href) }
  }
  return {
    intro: blank(content.intro),
    questions: content.questions.map(q => ({ id: q.id.trim(), prompt: q.prompt.trim(), help: blank(q.help), route_if_yes: q.route_if_yes })),
    outcomes,
    continue_message: blank(content.continue_message),
  }
}

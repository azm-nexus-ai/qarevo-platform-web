export const WORKFLOW_DELIVERY_PATH = '/api/v1/admin/workflow-delivery'
export const WORKFLOW_DELIVERY_PAGE_SIZE = 25
export type WorkflowJob = {
  consultationId: string; attempts: number; nextAttemptAt: string; lastErrorCode: string | null
}
export type WorkflowDelivery = {
  status: 'healthy' | 'warning' | 'disabled'; pendingCount: number; failedCount: number
  automaticDelivery: boolean; canRetry: boolean; jobs: WorkflowJob[]
  paginated: boolean; limit: number; offset: number; totalCount: number | null; hasNext: boolean; hasPrevious: boolean
}
export type WorkflowRetry = { status: 'delivered' | 'already_delivered' | 'retry_pending'; delivered: number; failed: number }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const date = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const errorCode = (value: unknown): value is string | null => value === null || value === 'DELIVERY_UNCONFIRMED' || (typeof value === 'string' && /^HTTP_[1-5]\d{2}$/.test(value))

export function workflowDelivery(value: unknown): WorkflowDelivery | null {
  if (!object(value) || !['healthy', 'warning', 'disabled'].includes(String(value.status)) || !count(value.pending_count) || !count(value.failed_count) || value.failed_count > value.pending_count ||
      typeof value.can_retry !== 'boolean' || typeof value.automatic_delivery !== 'boolean' || !Array.isArray(value.jobs) || value.jobs.length > WORKFLOW_DELIVERY_PAGE_SIZE) return null
  const jobs: WorkflowJob[] = [], identifiers = new Set<string>()
  for (const row of value.jobs) {
    if (!object(row) || !uuid(row.consultation_id) || identifiers.has(row.consultation_id) || !count(row.attempts) || !date(row.next_attempt_at) || !errorCode(row.last_error_code)) return null
    identifiers.add(row.consultation_id)
    jobs.push({ consultationId: row.consultation_id, attempts: row.attempts, nextAttemptAt: row.next_attempt_at, lastErrorCode: row.last_error_code })
  }
  if (jobs.length > value.pending_count || (value.status === 'healthy' && value.pending_count !== 0) || (value.status === 'warning' && value.pending_count === 0) ||
      (value.status === 'disabled' && (value.pending_count !== 0 || value.can_retry || value.automatic_delivery))) return null
  const paginated = ['limit', 'offset', 'total_count', 'has_next', 'has_previous'].some(key => Object.hasOwn(value, key))
  if (paginated && (!count(value.limit) || value.limit < 1 || value.limit > WORKFLOW_DELIVERY_PAGE_SIZE || !count(value.offset) || !count(value.total_count) || value.total_count !== value.pending_count ||
      jobs.length > value.limit || value.offset > Math.max(0, value.total_count - 1) || value.offset + jobs.length > value.total_count ||
      typeof value.has_next !== 'boolean' || typeof value.has_previous !== 'boolean' || value.has_previous !== (value.offset > 0) ||
      value.has_next !== (value.offset + value.limit < value.total_count))) return null
  return { status: value.status as WorkflowDelivery['status'], pendingCount: value.pending_count, failedCount: value.failed_count,
    automaticDelivery: value.automatic_delivery, canRetry: value.can_retry, jobs, paginated,
    limit: paginated ? value.limit as number : WORKFLOW_DELIVERY_PAGE_SIZE, offset: paginated ? value.offset as number : 0,
    totalCount: paginated ? value.total_count as number : null, hasNext: paginated && value.has_next === true, hasPrevious: paginated && value.has_previous === true }
}

export function workflowRetry(value: unknown): WorkflowRetry | null {
  if (!object(value) || !['delivered', 'already_delivered', 'retry_pending'].includes(String(value.status)) || !count(value.delivered) || !count(value.failed) || value.delivered + value.failed > 1 ||
      (value.status === 'already_delivered' && (value.delivered !== 0 || value.failed !== 0))) return null
  return { status: value.status as WorkflowRetry['status'], delivered: value.delivered, failed: value.failed }
}

export function workflowDeliveryPath(offset: number): string {
  return `${WORKFLOW_DELIVERY_PATH}?limit=${WORKFLOW_DELIVERY_PAGE_SIZE}&offset=${offset}`
}

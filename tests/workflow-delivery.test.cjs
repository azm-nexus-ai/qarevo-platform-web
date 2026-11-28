const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const compiled = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('lib/workflow-delivery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { module: compiled, exports: compiled.exports })
const h = compiled.exports
const id = '88888888-8888-4888-8888-888888888888'
function job(changes = {}) { return { consultation_id: id, attempts: 2, next_attempt_at: '2030-07-10T08:00:00Z', last_error_code: 'HTTP_503', ...changes } }
function page(changes = {}) { return { status: 'warning', pending_count: 26, failed_count: 1, automatic_delivery: false, can_retry: true,
  jobs: [job()], limit: 25, offset: 0, total_count: 26, has_next: true, has_previous: false, ...changes } }

test('workflow queue pages keep global counts, exact references and effective page metadata', () => {
  const first = h.workflowDelivery(page())
  assert.equal(first.pendingCount, 26); assert.equal(first.failedCount, 1)
  assert.equal(first.jobs[0].consultationId, id); assert.equal(first.jobs[0].lastErrorCode, 'HTTP_503')
  assert.equal(first.hasNext, true); assert.equal(first.canRetry, true)
  const last = h.workflowDelivery(page({ offset: 25, has_previous: true, has_next: false }))
  assert.equal(last.offset, 25); assert.equal(last.totalCount, 26)
  const healthy = h.workflowDelivery(page({ status: 'healthy', pending_count: 0, failed_count: 0, total_count: 0, jobs: [], has_next: false }))
  assert.equal(healthy.jobs.length, 0); assert.equal(healthy.offset, 0)
  assert.equal(h.workflowDeliveryPath(0), '/api/v1/admin/workflow-delivery?limit=25&offset=0')
  assert.equal(h.workflowDeliveryPath(25), '/api/v1/admin/workflow-delivery?limit=25&offset=25')
})

test('legacy workflow queue stays explicitly bounded without invented pagination totals', () => {
  const legacy = page()
  for (const key of ['limit', 'offset', 'total_count', 'has_next', 'has_previous']) delete legacy[key]
  const result = h.workflowDelivery(legacy)
  assert.equal(result.paginated, false); assert.equal(result.totalCount, null)
  assert.equal(result.hasNext, false); assert.equal(result.hasPrevious, false)
  for (const key of ['limit', 'offset', 'total_count', 'has_next', 'has_previous']) assert.equal(h.workflowDelivery({ ...legacy, [key]: page()[key] }), null)
})

test('unsupported workflow state, malformed rows and inconsistent page counts fail closed', () => {
  for (const change of [
    { status: 'delivered' }, { status: null }, { pending_count: -1 }, { pending_count: '26' }, { pending_count: Number.MAX_SAFE_INTEGER + 1 },
    { failed_count: 27 }, { failed_count: .5 }, { can_retry: 'true' }, { automatic_delivery: undefined },
    { status: 'healthy' }, { status: 'warning', pending_count: 0 }, { status: 'disabled' },
    { jobs: [job(), job()] }, { jobs: Array.from({ length: 26 }, () => job()) }, { jobs: [null] },
    ...[
      { consultation_id: '../other' }, { consultation_id: id.toUpperCase().replace('88888888', 'AAAAAAAA') },
      { attempts: -1 }, { attempts: Infinity }, { next_attempt_at: '2030-07-10' }, { next_attempt_at: '2030-07-10T08:00:00' },
      { last_error_code: 'Synthetic private clinical content' }, { last_error_code: 'HTTP_999' }, { last_error_code: '<script>' },
    ].map(fields => ({ jobs: [job(fields)] })),
    { limit: 0 }, { limit: 26 }, { offset: -1 }, { offset: 26 }, { offset: Number.MAX_SAFE_INTEGER + 1 },
    { total_count: 25 }, { has_next: false }, { has_previous: true }, { has_next: 'true' }, { jobs: [job(), job({ consultation_id: '11111111-1111-4111-8111-111111111111' })], limit: 1 },
  ]) assert.equal(h.workflowDelivery(page(change)), null, JSON.stringify(change))
  const disabled = page({ status: 'disabled', pending_count: 0, failed_count: 0, jobs: [], total_count: 0, has_next: false, can_retry: false, automatic_delivery: false })
  assert.equal(h.workflowDelivery(disabled).status, 'disabled')
  assert.equal(h.workflowDelivery(page({ jobs: [job({ last_error_code: 'DELIVERY_UNCONFIRMED' })] })).jobs[0].lastErrorCode, 'DELIVERY_UNCONFIRMED')
})

test('retry parses authoritative status independently of a bounded dispatch counter', () => {
  assert.equal(h.workflowRetry({ status: 'delivered', delivered: 0, failed: 0 }).status, 'delivered')
  assert.equal(h.workflowRetry({ status: 'retry_pending', delivered: 1, failed: 0 }).status, 'retry_pending')
  assert.equal(h.workflowRetry({ status: 'already_delivered', delivered: 0, failed: 0 }).status, 'already_delivered')
  for (const value of [null, {}, { status: 'queued', delivered: 1, failed: 0 }, { status: 'delivered', delivered: true, failed: false },
    { status: 'delivered', delivered: 1, failed: 1 }, { status: 'delivered', delivered: -1, failed: 0 }, { status: 'delivered', delivered: '1', failed: 0 },
    { status: 'already_delivered', delivered: 1, failed: 0 }]) assert.equal(h.workflowRetry(value), null)
})

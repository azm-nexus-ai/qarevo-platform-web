const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')
const compiled = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/doctor-time-off.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: compiled, exports: compiled.exports })
const h = compiled.exports
const provider = '22222222-2222-4222-8222-222222222222', other = '33333333-3333-4333-8333-333333333333'
const row = (changes = {}) => ({ id: '11111111-1111-4111-8111-111111111111', provider_id: provider, start_datetime: '2030-07-10T08:00:00+00:00', end_datetime: '2030-07-10T09:00:00+00:00', reason: null, status: 'PENDING', ...changes })
const page = (changes = {}) => ({ total: 1, limit: 25, offset: 0, time_off: [row()], can_manage: true, ...changes })

test('absence records remain bound to one clinician and canonical decision states', () => {
  for (const status of ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) assert.equal(h.timeOffRecord(row({ status }), provider).status, status)
  for (const change of [{ provider_id: other }, { id: '../other' }, { status: 'ACTIVE' }, { status: 'approved' }, { reason: {} }, { reason: 'a'.repeat(501) }, { start_datetime: '2030-07-10T08:00:00' }, { end_datetime: '2030-07-10T07:00:00Z' }, { end_datetime: '2030-07-10T08:00:00Z' }]) assert.equal(h.timeOffRecord(row(change), provider), null)
})

test('paged absence contracts require real counts and explicit authority', () => {
  assert.equal(h.timeOffPage(page(), provider).canManage, true)
  const last = h.timeOffPage(page({ total: 26, offset: 25, can_manage: false }), provider)
  assert.equal(last.total, 26); assert.equal(last.offset, 25); assert.equal(last.canManage, false)
  // An empty stale offset is explicit and may be recovered after the fresh read.
  assert.equal(h.timeOffPage(page({ total: 0, offset: 25, time_off: [] }), provider).records.length, 0)
  for (const change of [{ total: 0 }, { total: -1 }, { total: '1' }, { offset: Infinity }, { offset: -1 }, { limit: 26 }, { limit: 0 }, { can_manage: 'true' }, { can_manage: undefined }, { time_off: [row(), row()] }, { time_off: [row({ provider_id: other })] }]) assert.equal(h.timeOffPage(page(change), provider), null)
})

test('absence paging URLs accept only bounded references and canonical filters', () => {
  assert.equal(h.timeOffPath(provider, 25, 'CANCELLED'), `/api/v1/admin/doctors/${provider}/time-off?limit=25&offset=25&status=CANCELLED`)
  for (const args of [['../other'], [provider, -1], [provider, Infinity], [provider, 0, 'CANCELLED&provider=other']]) assert.throws(() => h.timeOffPath(...args))
})

test('local input reports missing, invalid and reversed intervals before network submission', () => {
  const original = process.env.TZ; process.env.TZ = 'Europe/Berlin'
  try {
    assert.equal(h.absenceRequest('', '', '').payload, null)
    assert.equal(h.absenceRequest('2030-02-30T09:00', '2030-03-01T10:00', '').payload, null)
    assert.equal(h.absenceRequest('2030-07-10T10:00', '2030-07-10T09:00', '').payload, null)
    assert.equal(h.absenceRequest('2030-07-10T09:00', '2030-07-10T10:00', 'a'.repeat(501)).payload, null)
    const result = h.absenceRequest('2030-07-10T09:00', '2030-07-10T10:00', '  Synthetic leave  ')
    assert.equal(result.payload.start_datetime, '2030-07-10T07:00:00.000Z')
    assert.equal(result.payload.end_datetime, '2030-07-10T08:00:00.000Z')
    assert.equal(result.payload.reason, 'Synthetic leave')
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
})

test('clock-change boundaries never silently normalize a missing or repeated wall time', () => {
  const original = process.env.TZ; process.env.TZ = 'Europe/Berlin'
  try {
    assert.match(h.localAbsenceInstant('2026-03-29T02:30').error, /does not exist/)
    assert.match(h.localAbsenceInstant('2026-10-25T02:30').error, /occurs twice/)
    assert.equal(h.localAbsenceInstant('2026-10-25T03:00').iso, '2026-10-25T02:00:00.000Z')
    assert.equal(h.localAbsenceInstant('2026-03-29T03:00').iso, '2026-03-29T01:00:00.000Z')
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
})

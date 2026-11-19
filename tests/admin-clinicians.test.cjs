const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const compiled = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('lib/admin-clinicians.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { module: compiled, exports: compiled.exports, URLSearchParams })
const h = compiled.exports
const request = { limit: 25, offset: 0 }
const row = (changes = {}) => ({ provider_id: '88888888-8888-4888-8888-888888888888', full_name: 'Synthetic Clinician', email: 'synthetic@example.invalid', status: 'ACTIVE', verification_status: 'VERIFIED', email_verified: true, clinical_access: { status: 'enabled', reason: 'approved', message: 'Clinical access is enabled.' }, ...changes })
const page = (changes = {}) => ({ doctors: [row()], total: 51, limit: 25, offset: 0, has_next: true, has_previous: false, can_review: true, status_options: [{ value: 'ACTIVE', label: 'Active' }], ...changes })

test('clinician roster preserves server totals, permissions, canonical filters and clamped page positions', () => {
  const first = h.clinicianPage(page(), request)
  assert.equal(first.total, 51); assert.equal(first.doctors.length, 1); assert.equal(first.hasNext, true); assert.equal(first.canReview, true)
  assert.equal(first.statusOptions[0].value, 'ACTIVE')
  const last = h.clinicianPage(page({ offset: 50, has_previous: true, has_next: false }), { limit: 25, offset: 50 })
  assert.equal(last.offset, 50); assert.equal(last.hasNext, false)
  const clamped = h.clinicianPage(page({ total: 25, offset: 0, has_next: false }), { limit: 25, offset: 50 })
  assert.equal(clamped.offset, 0); assert.equal(clamped.hasPrevious, false)
  const empty = h.clinicianPage(page({ doctors: [], total: 0, has_next: false, can_review: false }), request)
  assert.equal(empty.total, 0); assert.equal(empty.canReview, false)
})

test('legacy rows have an explicit bounded first page without invented totals or mutation permission', () => {
  const array = h.clinicianPage([row()], request)
  assert.equal(array.total, null); assert.equal(array.paginated, false); assert.equal(array.canReview, false); assert.equal(array.hasNext, false)
  const envelope = h.clinicianPage({ doctors: [row()], total: 20, limit: 50, offset: 0 }, request)
  assert.equal(envelope.total, 20); assert.equal(envelope.canReview, false); assert.equal(envelope.hasNext, false)
  assert.equal(h.clinicianPage([row()], { limit: 25, offset: 25 }), null)
  assert.equal(h.clinicianPage({ doctors: [row()], total: 1, offset: 25 }, request), null)
})

test('malformed rows, totals, page edges and canonical options fail closed', () => {
  for (const fields of [
    { doctors: [null] }, { doctors: [row(), row()] }, { doctors: [row({ provider_id: '../other' })] }, { doctors: [row({ full_name: '' })] },
    { doctors: [row({ can_review: 'true' })] }, { doctors: [row({ clinical_access: { status: 'approved' } })] },
    { total: -1 }, { total: '51' }, { total: 0 }, { total: Number.MAX_SAFE_INTEGER + 1 }, { limit: 0 }, { limit: 50 },
    { offset: -1 }, { offset: 26 }, { offset: 100 }, { has_next: false }, { has_previous: true }, { has_previous: undefined }, { can_review: undefined }, { can_review: 'true' },
    { status_options: null }, { status_options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'ACTIVE', label: 'Duplicate' }] },
    { status_options: [{ value: '../other', label: 'Invalid' }] }, { status_options: [{ value: 'ACTIVE', label: '' }] },
  ]) assert.equal(h.clinicianPage(page(fields), request), null, JSON.stringify(fields))
  assert.equal(h.clinicianPage({ doctors: [row()], total: '1' }, request), null)
  assert.equal(h.clinicianRow(row({ provider_id: 'synthetic-provider' })).provider_id, 'synthetic-provider')
})

test('roster requests trim and encode search and keep status filtering out of the pending queue', () => {
  const all = new URL(h.clinicianPagePath('all', { limit: 50, offset: 50 }, '  Synthetic + Search  ', 'SUSPENDED'), 'http://synthetic.invalid')
  assert.equal(all.pathname, '/api/v1/admin/doctors'); assert.equal(all.searchParams.get('search'), 'Synthetic + Search')
  assert.equal(all.searchParams.get('status'), 'SUSPENDED'); assert.equal(all.searchParams.get('offset'), '50')
  const pending = new URL(h.clinicianPagePath('pending', request, '   ', 'ACTIVE'), 'http://synthetic.invalid')
  assert.equal(pending.pathname, '/api/v1/admin/doctors/pending/page'); assert.equal(pending.searchParams.has('search'), false); assert.equal(pending.searchParams.has('status'), false)
})

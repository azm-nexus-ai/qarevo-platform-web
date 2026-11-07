const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { URLSearchParams, module: compiled, exports: compiled.exports, require: name => dependencies[name] ?? require(name) }, { filename: file })
  return compiled.exports
}
const records = load('lib/clinical-record.ts')
const summaries = load('lib/patient-consultation-summary.ts', { './clinical-record': records })
const h = load('lib/clinical-publications.ts', { './patient-consultation-summary': summaries })
const consultation = '66666666-6666-4666-8666-666666666666'
const otherConsultation = '99999999-9999-4999-8999-999999999999'
const recordId = '77777777-7777-4777-8777-777777777777'
function metadata(revision = 3, overrides = {}) { return { id: recordId, episode_id: '88888888-8888-4888-8888-888888888888', consultation_id: consultation, revision, version: revision + 1, language: 'en', approved_by: 'synthetic-clinician', published_at: '2030-07-10T08:00:00Z', ...overrides } }
function page(items = [metadata()], overrides = {}) { return { items, latest_published_revision: 3, has_more: false, next_before_revision: null, ...overrides } }
function record(revision = 2) { return { ...metadata(revision), summary: 'Synthetic summary', history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: 'Synthetic plan', safety_net: 'Synthetic advice', amendment_reason: 'Synthetic amendment' } }

test('publication route parameters require a single consultation and at most one canonical record UUID', () => {
  assert.equal(h.publicationParameters([consultation], []).invalidLink, false)
  assert.equal(h.publicationParameters([consultation], [recordId]).recordId, recordId)
  for (const [consultations, records] of [[[consultation, otherConsultation], []], [[consultation], [recordId, recordId]], [[consultation], ['https://example.invalid']], [[], [recordId]]]) assert.equal(h.publicationParameters(consultations, records).invalidLink, true)
  assert.equal(h.publicationHref('patient', consultation, recordId), `/patient/consultation-summary?consultationId=${consultation}&recordId=${recordId}`)
  assert.equal(h.publicationHref('doctor', consultation), `/doctor/clinical-records?consultationId=${consultation}`)
  assert.equal(h.publicationHref('patient', consultation, '../private'), undefined)
})

test('history API paths enforce fixed role endpoints and bounded positive keyset cursors', () => {
  assert.equal(h.publicationApiPath('patient', consultation), `/api/v1/patient/consultation-summary/publications?consultation_id=${consultation}&limit=20`)
  assert.equal(h.publicationApiPath('doctor', consultation, { beforeRevision: 3 }), `/api/v1/doctor/workspace/${consultation}/clinical-record/publications?limit=20&before_revision=3`)
  assert.equal(h.publicationApiPath('doctor', consultation, { recordId }), `/api/v1/doctor/workspace/${consultation}/clinical-record/publications/${recordId}`)
  for (const cursor of [0, -1, 2.5, '3', Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(h.publicationApiPath('patient', consultation, { beforeRevision: cursor }), null)
  assert.equal(h.publicationApiPath('patient', consultation, { recordId: 'javascript:example' }), null)
})

test('metadata pages strip private content and reject unpublished, foreign or inconsistent entries', () => {
  const clean = h.publicationPage(page([metadata(3, { summary: 'Synthetic clinical sentinel', draft: { text: 'private' } })]), consultation)
  assert.ok(clean)
  assert.equal(clean.items[0].summary, undefined)
  assert.equal(clean.items[0].draft, undefined)
  for (const overrides of [{ approved_by: null }, { published_at: null }, { consultation_id: otherConsultation }, { revision: 4 }, { language: ['en'] }, { version: 0 }]) assert.equal(h.publicationPage(page([metadata(3, overrides)]), consultation), null)
  assert.equal(h.publicationPage(page(Array.from({ length: 21 }, (_, index) => metadata(22 - index))), consultation), null)
  assert.equal(h.publicationPage(page([metadata(), metadata(2)]), consultation), null)
  assert.equal(h.publicationPage(page([metadata(2), metadata(3, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })]), consultation), null)
})

test('keyset responses must progress below the requested cursor and use the last returned revision', () => {
  assert.ok(h.publicationPage(page([metadata(2)], { has_more: true, next_before_revision: 2 }), consultation, 3))
  for (const payload of [page([metadata(3)]), page([metadata(2)], { has_more: true, next_before_revision: 1 }), page([], { has_more: true, next_before_revision: 2 }), page([metadata(2)], { has_more: false, next_before_revision: 2 })]) assert.equal(h.publicationPage(payload, consultation, 3), null)
  assert.ok(h.publicationPage(page([], { latest_published_revision: null }), consultation))
})

test('selected immutable records must bind exact consultation, record and current/superseded context', () => {
  const selected = { record: record(2), latest_published_revision: 3, is_current: false }
  assert.ok(h.selectedPublication(selected, consultation, recordId))
  assert.ok(h.selectedPublication({ ...selected, latest_published_revision: 2, is_current: true }, consultation, recordId))
  for (const payload of [{ ...selected, is_current: true }, { ...selected, latest_published_revision: 1 }, { ...selected, record: { ...record(), published_at: null } }, { ...selected, record: { ...record(), approved_by: null } }]) assert.equal(h.selectedPublication(payload, consultation, recordId), null)
  assert.equal(h.selectedPublication(selected, otherConsultation, recordId), null)
  assert.equal(h.selectedPublication(selected, consultation, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null)
})

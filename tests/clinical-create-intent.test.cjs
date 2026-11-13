const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), { webcrypto } = require('node:crypto')
function load(path, deps = {}) { const m = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports, crypto: webcrypto, Object, require: name => deps[name] ?? require(name) }); return m.exports }
const clinical = load('lib/clinical-record.ts'), summary = load('lib/patient-consultation-summary.ts', { './clinical-record': clinical }), h = load('lib/clinical-create-intent.ts', { './patient-consultation-summary': summary })
const source = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const body = { patient_id: source, name: 'Synthetic private medication', times: ['Morning', '20:00'], progress: null }
const contracts = { medication: { singular: 'medication', plural: 'medications', id: 'med-' + source }, care_plan: { singular: 'care_plan', plural: 'care_plans', id: 'cp-' + source }, lab_request: { singular: 'lab_test', plural: 'test_requests', id: source } }
function response(intent, changes = {}) { const c = contracts[intent.kind], record = { id: c.id, name: 'Synthetic current edited instruction' }; return { creation_receipt: { creation_id: intent.creationId, kind: intent.kind, record_id: c.id, available: true, replayed: false }, [c.singular]: record, [c.plural]: [record], ...changes } }

test('identical canonical details reuse one UUID across retries and object key order changes', () => {
  const first = h.clinicalCreateIntent(null, 'doctor-session-path-query-patient', 'medication', body)
  const reordered = { progress: null, times: [...body.times], name: body.name, patient_id: source }
  assert.equal(h.clinicalCreateIntent(first, first.owner, first.kind, reordered), first)
  assert.equal(h.sameClinicalCreateIntent(first, first.owner, first.kind, reordered), true)
  assert.match(first.creationId, /^[0-9a-f-]{36}$/)
})
test('changed submitted content, schedule, null intent, kind or original owner are distinct creations', () => {
  const first = h.clinicalCreateIntent(null, 'original-owner', 'medication', body)
  for (const changes of [{ name: 'Different instruction' }, { times: ['20:00', 'Morning'] }, { progress: 0 }, { patient_id: other }]) {
    assert.equal(h.sameClinicalCreateIntent(first, first.owner, first.kind, { ...body, ...changes }), false)
    assert.notEqual(h.clinicalCreateIntent(first, first.owner, first.kind, { ...body, ...changes }).creationId, first.creationId)
  }
  assert.notEqual(h.clinicalCreateIntent(first, 'another-session', first.kind, body).creationId, first.creationId)
  assert.notEqual(h.clinicalCreateIntent(first, first.owner, 'care_plan', body).creationId, first.creationId)
  assert.notEqual(h.clinicalCreateIntent(null, first.owner, first.kind, body).creationId, first.creationId)
  assert.notEqual(h.clinicalCreateIntent(first, first.owner, first.kind, { ...body, progress: undefined }).creationId, first.creationId)
})
test('a captured body is an immutable snapshot even when the source form changes', () => {
  const values = { patient_id: source, title: 'Synthetic original', times: ['Morning'] }, first = h.clinicalCreateIntent(null, 'owner', 'care_plan', values)
  values.title = 'Changed form'; values.times.push('Night')
  assert.equal(JSON.parse(first.body).title, 'Synthetic original'); assert.equal(JSON.parse(first.body).times.join(','), 'Morning')
})
test('malformed non-JSON payloads fail before creating an intent rather than silently changing meaning', () => {
  for (const value of [NaN, Infinity, () => {}, new Date(), new Map()]) assert.throws(() => h.clinicalCreateIntent(null, 'owner', 'medication', { value }), /could not be prepared/)
  assert.throws(() => h.clinicalCreateIntent(null, '', 'medication', body), /Confirm/)
})
for (const kind of Object.keys(contracts)) test(`${kind}: receipt requires exact intent, canonical source identity and current singular/list consistency`, () => {
  const intent = h.clinicalCreateIntent(null, 'owner', kind, body), valid = response(intent)
  assert.equal(h.clinicalCreationReceipt(valid, intent).record_id, contracts[kind].id)
  const bad = [{ ...valid, creation_receipt: { ...valid.creation_receipt, creation_id: other } }, { ...valid, creation_receipt: { ...valid.creation_receipt, kind: 'unrelated' } }, { ...valid, creation_receipt: { ...valid.creation_receipt, record_id: '../unsafe' } }, { ...valid, creation_receipt: { ...valid.creation_receipt, replayed: 'true' } }, { ...valid, creation_receipt: { ...valid.creation_receipt, available: null } }, { ...valid, [contracts[kind].singular]: null }, { ...valid, [contracts[kind].plural]: [] }, { ...valid, [contracts[kind].plural]: [valid[contracts[kind].singular], valid[contracts[kind].singular]] }, { ...valid, [contracts[kind].singular]: { id: other } }]
  for (const malformed of [null, {}, ...bad]) assert.equal(h.clinicalCreationReceipt(malformed, intent), null)
})
for (const kind of Object.keys(contracts)) test(`${kind}: a confirmed deleted replay has no singular or matching live record and never restores the initial body`, () => {
  const intent = h.clinicalCreateIntent(null, 'owner', kind, body), c = contracts[kind], valid = response(intent), deleted = { creation_receipt: { ...valid.creation_receipt, available: false, replayed: true }, [c.singular]: null, [c.plural]: [] }
  assert.equal(h.clinicalCreationReceipt(deleted, intent).available, false)
  assert.equal(h.clinicalCreationReceipt({ ...deleted, creation_receipt: { ...deleted.creation_receipt, replayed: false } }, intent), null)
  assert.equal(h.clinicalCreationReceipt({ ...deleted, [c.singular]: valid[c.singular] }, intent), null)
  assert.equal(h.clinicalCreationReceipt({ ...deleted, [c.plural]: [valid[c.singular]] }, intent), null)
  const result = h.clinicalCreationReceipt({ ...valid, creation_receipt: { ...valid.creation_receipt, replayed: true } }, intent)
  assert.equal(result.replayed, true); assert.doesNotMatch(JSON.stringify(result), /Synthetic|medication instruction|patient_id/)
})

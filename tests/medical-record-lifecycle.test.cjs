const assert = require('node:assert/strict'), test = require('node:test'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), { webcrypto } = require('node:crypto')
function load(path, deps = {}) { const m = { exports: {} }; const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; vm.runInNewContext(code, { module: m, exports: m.exports, crypto: webcrypto, URL, Date, require: name => deps[name] ?? require(name) }); return m.exports }
const clinical = load('lib/clinical-record.ts'), summary = load('lib/patient-consultation-summary.ts', { './clinical-record': clinical }), upload = load('lib/lab-upload-attempt.ts', { './patient-consultation-summary': summary }), limits = load('lib/clinical-upload.ts')
const h = load('lib/medical-record-lifecycle.ts', { './lab-upload-attempt': upload, './patient-consultation-summary': summary, './clinical-upload': limits })
const fields = { title: 'Synthetic document', record_type: 'Prescription', description: 'Synthetic patient-supplied description', provider_name: 'Synthetic reported provider', record_date: '2026-11-11' }
const file = (bytes = 'Synthetic file bytes', name = 'synthetic.pdf', type = 'application/pdf') => new File([bytes], name, { type })
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'

test('generic upload canonical metadata and supported formats preserve the development limit', () => {
  assert.equal(Object.keys(h.medicalUploadFields(fields, file()).errors).length, 0)
  assert.equal(h.medicalUploadFields({ ...fields, title: ' Synthetic document ', provider_name: ' Synthetic reported provider ' }, file()).fields.title, fields.title)
  for (const [type, name] of [['application/pdf', 's.pdf'], ['application/msword', 's.doc'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 's.docx'], ['image/png', 's.png'], ['image/jpeg', 's.jpeg'], ['image/jpg', 's.jpg'], ['image/webp', 's.webp']]) assert.equal(h.medicalUploadFields(fields, file('synthetic', name, type)).errors.file, undefined)
  assert.equal(h.medicalUploadFields(fields, file(Buffer.alloc(limits.MAX_MEDICAL_UPLOAD_BYTES))).errors.file, undefined)
  assert.match(h.medicalUploadFields(fields, file(Buffer.alloc(limits.MAX_MEDICAL_UPLOAD_BYTES + 1))).errors.file, /3 MB/)
  assert.match(h.medicalUploadFields(fields, file('')).errors.file, /non-empty/)
  assert.match(h.medicalUploadFields(fields, file('synthetic', 's.html', 'text/html')).errors.file, /PDF/)
})
test('inline validation identifies every field, impossible dates and exact metadata bounds', () => {
  const invalid = h.medicalUploadFields({ title: ' ', record_type: 'unapproved', description: 'x'.repeat(5001), provider_name: 'x'.repeat(256), record_date: '2026-02-30' }, null).errors
  assert.equal(Object.keys(invalid).sort().join(','), 'description,file,provider_name,record_date,record_type,title')
  assert.match(h.medicalUploadFields({ ...fields, title: 'x'.repeat(256) }, file()).errors.title, /255/)
  for (const date of ['2026-2-01', 'not-date', '2026-01-01T01:00:00Z', '2026-13-01']) assert.ok(h.medicalUploadFields({ ...fields, record_date: date }, file()).errors.record_date)
  assert.equal(Object.keys(h.medicalUploadFields({ ...fields, title: 'x'.repeat(255), description: 'x'.repeat(5000), provider_name: 'x'.repeat(255), record_date: '2028-02-29' }, file()).errors).length, 0)
})
test('identical upload attempts survive uncertain acknowledgments and reselected equivalent bytes', async () => {
  const first = await h.medicalRecordUploadAttempt(null, 'patient-session-route', file(), fields)
  assert.equal((await h.medicalRecordUploadAttempt(first, first.owner, first.file, fields)).uploadId, first.uploadId)
  assert.equal((await h.medicalRecordUploadAttempt(first, first.owner, file(), { ...fields })).uploadId, first.uploadId)
  const canonical = h.medicalUploadFields({ ...fields, title: ' Synthetic document ', provider_name: ' Synthetic reported provider ' }, file()).fields
  assert.equal((await h.medicalRecordUploadAttempt(first, first.owner, file(), canonical)).uploadId, first.uploadId)
})
test('each changed submitted metadata field, byte content, name, MIME or account creates a new intent', async () => {
  const first = await h.medicalRecordUploadAttempt(null, 'patient-session-route', file(), fields)
  for (const changed of [{ title: 'Changed name' }, { record_type: 'Referral' }, { description: 'Changed description' }, { provider_name: 'Changed provider' }, { record_date: '2026-11-12' }]) assert.notEqual((await h.medicalRecordUploadAttempt(first, first.owner, first.file, { ...fields, ...changed })).uploadId, first.uploadId)
  for (const changed of [file('Changed bytes'), file(undefined, 'changed.pdf'), file(undefined, undefined, 'image/png')]) assert.notEqual((await h.medicalRecordUploadAttempt(first, first.owner, changed, fields)).uploadId, first.uploadId)
  assert.notEqual((await h.medicalRecordUploadAttempt(first, 'different-session-route', first.file, fields)).uploadId, first.uploadId)
})
test('upload receipts bind both exact IDs and available differs from lab current semantics', () => {
  const valid = { upload_id: id, file_id: id, replayed: true, available: false }
  assert.equal(h.medicalRecordUploadReceipt(valid, id).available, false)
  for (const invalid of [null, {}, { ...valid, upload_id: other }, { ...valid, file_id: other }, { ...valid, available: null }, { ...valid, replayed: 'true' }, { upload_id: id, file_id: id, replayed: false, current: true }]) assert.equal(h.medicalRecordUploadReceipt(invalid, id), null)
})
test('soft-delete acknowledgments must describe that exact owned file and explicit success', () => {
  const valid = { file_id: id, deleted: true, replayed: true }
  assert.equal(h.medicalRecordDeleteReceipt(valid, id).replayed, true)
  for (const invalid of [null, { message: 'deleted' }, { ...valid, file_id: other }, { ...valid, deleted: 'true' }, { ...valid, replayed: null }]) assert.equal(h.medicalRecordDeleteReceipt(invalid, id), null)
})

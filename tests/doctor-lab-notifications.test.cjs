const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')
function load(file, dependencies = {}) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { crypto: webcrypto, URL, URLSearchParams, module: compiled, exports: compiled.exports, require: name => dependencies[name] ?? require(name) }, { filename: file })
  return compiled.exports
}
const clinical = load('lib/clinical-record.ts'), summary = load('lib/patient-consultation-summary.ts', { './clinical-record': clinical })
const h = load('lib/doctor-lab-notifications.ts', { './patient-consultation-summary': summary })
const upload = load('lib/lab-upload-attempt.ts', { './patient-consultation-summary': summary })
const patient = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222', file = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444'
function notice(overrides = {}) { return { id, event_type: 'lab_result_uploaded', source: 'lab-result', patient_id: patient, lab_request_id: request, file_id: file, uploaded_by: 'patient', created_at: '2030-07-13T08:00:00Z', is_read: false, read_at: null, availability: 'current', ...overrides } }

test('lab notices retain exact typed source identities and never retain filenames or clinical text', () => {
  const value = h.doctorLabNotice(notice({ filename: 'private.pdf', clinical_text: 'private clinical body', href: 'https://untrusted.invalid' }))
  assert.ok(value)
  assert.equal(value.fileId, file)
  assert.equal(value.uploadedBy, 'patient')
  assert.doesNotMatch(JSON.stringify(value), /private|untrusted/)
  for (const change of [{ source: 'manual' }, { event_type: 'clinical_record.published' }, { uploaded_by: 'reviewed' }, { availability: ['current'] }, { file_id: '../private' }, { is_read: 'true' }, { read_at: 'bad-date' }]) assert.equal(h.doctorLabNotice(notice(change)), null)
})

test('only current notice files produce a finite three-UUID lab-order destination', () => {
  const current = h.doctorLabNotice(notice())
  const destination = `/doctor/lab-orders?patientId=${patient}&requestId=${request}&fileId=${file}`
  assert.equal(h.doctorLabNoticeHref(current), destination)
  assert.equal(h.labResultTarget(new URL(destination, 'https://synthetic.invalid').searchParams).target.fileId, file)
  for (const availability of ['superseded', 'unavailable']) assert.equal(h.doctorLabNoticeHref(h.doctorLabNotice(notice({ availability }))), undefined)
  for (const query of [`patientId=${patient}`, `patientId=${patient}&requestId=${request}&fileId=bad`, `patientId=${patient}&requestId=${request}&fileId=${file}&fileId=${file}`, `patientId=${patient}&requestId=${request}&fileId=${file}&clinical=private`]) assert.equal(h.labResultTarget(new URLSearchParams(query)).invalid, true)
})

test('opaque keyset cursors remain bounded and cannot inject a second request parameter', () => {
  assert.equal(h.noticeCursor('v1.c3ludGhldGljX2N1cnNvcg'), 'v1.c3ludGhldGljX2N1cnNvcg')
  assert.equal(h.doctorNoticePath('v1.cursor'), '/api/v1/doctor/notifications?limit=25&before=v1.cursor')
  for (const value of ['', 'v1.cursor&patient_id=other', 'v1.\nprivate', 'x'.repeat(257), {}, null]) assert.equal(h.noticeCursor(value), null)
  assert.equal(h.doctorNoticePage({ notifications: [notice()], has_more: true, next_cursor: 'v1.cursor' }).hasMore, true)
  assert.equal(h.doctorNoticePage({ notifications: [notice(), notice()], has_more: false, next_cursor: null }), null)
  assert.equal(h.doctorNoticePage({ notifications: Array.from({ length: 26 }, () => notice()), has_more: false, next_cursor: null }), null)
  assert.equal(h.doctorNoticePage({ notifications: [], has_more: true, next_cursor: 'v1.cursor' }), null)
})

const fixtureFile = (text = 'Synthetic PDF bytes', name = 'synthetic.pdf', type = 'application/pdf', lastModified = 1) => new File([text], name, { type, lastModified })
test('identical retries retain the same upload UUID, including reselected bytes with changed local mtime', async () => {
  const first = await upload.labUploadAttempt(null, 'synthetic-owner-order', fixtureFile(), 'Synthetic note')
  assert.match(first.uploadId, /^[0-9a-f-]{36}$/)
  assert.equal((await upload.labUploadAttempt(first, first.owner, first.file, first.note)).uploadId, first.uploadId)
  assert.equal((await upload.labUploadAttempt(first, first.owner, fixtureFile(undefined, undefined, undefined, 22), 'Synthetic note')).uploadId, first.uploadId)
})

test('changed file bytes, filename, MIME, note, order or account create a distinct in-memory upload intent', async () => {
  const first = await upload.labUploadAttempt(null, 'synthetic-owner-order', fixtureFile(), 'Synthetic note')
  for (const [owner, file, note] of [[first.owner, fixtureFile('Other PDF bytes'), first.note], [first.owner, fixtureFile(undefined, 'other.pdf'), first.note], [first.owner, fixtureFile(undefined, undefined, 'image/png'), first.note], [first.owner, first.file, 'Changed synthetic note'], [first.owner, first.file, ' Synthetic note '], ['different-owner-order', first.file, first.note]]) assert.notEqual((await upload.labUploadAttempt(first, owner, file, note)).uploadId, first.uploadId)
  assert.notEqual((await upload.labUploadAttempt(null, first.owner, first.file, first.note)).uploadId, first.uploadId)
})

test('receipt validation binds the acknowledged upload and treats current=false as neutral availability only', () => {
  const receipt = { upload_id: id, file_id: id, replayed: true, current: false }
  assert.ok(upload.labUploadReceipt(receipt, id))
  for (const value of [{ ...receipt, upload_id: patient }, { ...receipt, file_id: file }, { ...receipt, file_id: 'bad' }, { ...receipt, replayed: 'true' }, { ...receipt, current: null }, null]) assert.equal(upload.labUploadReceipt(value, id), null)
})

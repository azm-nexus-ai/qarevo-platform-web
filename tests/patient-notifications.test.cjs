const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { URL, URLSearchParams, module: compiled, exports: compiled.exports, require: name => dependencies[name] ?? require(name) }, { filename: file })
  return compiled.exports
}
const records = load('lib/clinical-record.ts')
const summary = load('lib/patient-consultation-summary.ts', { './clinical-record': records })
const publications = load('lib/clinical-publications.ts', { './patient-consultation-summary': summary })
const h = load('lib/patient-notifications.ts', { './patient-consultation-summary': summary, './clinical-publications': publications })
const id = '22222222-2222-4222-8222-222222222222', recordId = id, consultation = '66666666-6666-4666-8666-666666666666'
function official(overrides = {}) { return { id, event_type: 'clinical_record.published', source: 'clinical-publication', source_id: recordId, title: 'Untrusted title', body: 'Synthetic clinical text must not be rendered', href: 'https://untrusted.invalid/private', is_read: false, read_at: null, created_at: '2030-07-13T08:00:00Z', extra_data: { record_id: recordId, episode_id: '88888888-8888-4888-8888-888888888888', consultation_id: consultation, revision: 2, version: 3, published_at: '2030-07-13T08:00:00Z' }, ...overrides } }

test('official notices use fixed copy and a finite owned-publication destination rather than stored href/title/body', () => {
  const notice = h.patientNotice(official())
  assert.ok(notice)
  assert.equal(notice.href, `/patient/consultation-summary?consultationId=${consultation}&recordId=${recordId}`)
  assert.equal(notice.title, 'Consultation summary updated')
  assert.equal(notice.official, true)
  assert.equal(notice.isRead, false)
  assert.doesNotMatch(JSON.stringify(notice), /untrusted.invalid|Untrusted title|Synthetic clinical text/)
  assert.equal(h.patientNotice(official({ extra_data: { ...official().extra_data, revision: 1 } })).title, 'Consultation summary published')
})

test('reserved publication provenance requires all six metadata fields and immutable source binding', () => {
  for (const changes of [{ id: '44444444-4444-4444-8444-444444444444' }, { source: 'manual' }, { event_type: 'manual-note' }, { source_id: consultation }, { extra_data: { ...official().extra_data, private_text: 'must not appear' } }, { extra_data: { ...official().extra_data, record_id: '../record' } }, { extra_data: { ...official().extra_data, revision: 0 } }, { extra_data: { ...official().extra_data, version: '3' } }, { extra_data: { ...official().extra_data, published_at: '2030-07-13T10:00:00+02:00' } }]) assert.equal(h.patientNotice(official(changes)), null)
  const extra = { ...official().extra_data }; delete extra.episode_id
  assert.equal(h.patientNotice(official({ extra_data: extra })), null)
})

test('read receipts and creation dates remain factual and missing time is never invented', () => {
  const notice = h.patientNotice(official({ is_read: true, read_at: '2030-07-13T08:05:00Z', created_at: null }))
  assert.equal(notice.isRead, true)
  assert.equal(notice.readAt, '2030-07-13T08:05:00Z')
  assert.equal(notice.createdAt, null)
  assert.equal(h.patientNotice(official({ is_read: 'true' })), null)
  assert.equal(h.patientNotice(official({ id: '../other-user' })), null)
})

test('legacy account links allow only finite patient paths and exact record UUID query', () => {
  for (const path of ['/patient/dashboard', '/patient/lab-requests', '/patient/messages', '/patient/appointments', '/patient/settings']) assert.equal(h.safePatientNoticeHref(path), path)
  assert.equal(h.safePatientNoticeHref(`/patient/medical-records?recordId=${recordId}`), `/patient/medical-records?recordId=${recordId}`)
  for (const value of ['//evil.invalid', 'https://evil.invalid', 'javascript:example', '/doctor/dashboard', '/admin/dashboard', '/patient/consultation-summary?consultationId='+consultation, '/patient/settings?secret=value', '/patient/messages#private', '/patient/medical-records?recordId=bad', `/patient/medical-records?recordId=${recordId}&recordId=${recordId}`, '/patient/medical-records?note=private', '/patient/messages\n', '/\\evil.invalid', null]) assert.equal(h.safePatientNoticeHref(value), undefined)
  const plain = h.patientNotice(official({ source: 'manual', event_type: 'account.note', href: 'https://untrusted.invalid' }))
  assert.ok(plain); assert.equal(plain.href, undefined); assert.equal(plain.official, false)
})

test('recent notification collections stay bounded and distinguish corrupt rows from an empty inbox', () => {
  assert.equal(h.patientNotices({ notifications: [] }).invalidCount, 0)
  assert.equal(h.patientNotices({ notifications: [official(), null, official()] }).items.length, 1)
  assert.equal(h.patientNotices({ notifications: [official(), null, official()] }).invalidCount, 2)
  assert.equal(h.patientNotices({ notifications: Array.from({ length: 51 }, () => official()) }), null)
  assert.equal(h.patientNotices({}), null)
  const amendedId = '55555555-5555-4555-8555-555555555555'
  const amended = official({ id: amendedId, source_id: amendedId, extra_data: { ...official().extra_data, record_id: amendedId } })
  assert.equal(h.patientNotices({ notifications: [official(), amended] }).items.length, 2)
})

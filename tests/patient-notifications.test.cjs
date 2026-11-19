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
function careRecord(overrides = {}) { return official({ event_type: 'medication_instruction.updated', source: 'clinical-authoring', source_id: id, extra_data: { audit_id: id, actor_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'medication_instruction', action: 'updated', resource_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', record_reference_hash: null }, ...overrides }) }

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

test('all six audit-bound care record notices derive fixed copy and the generic current-care destination', () => {
  for (const [kind, noun] of [['medication_instruction', 'Medication record'], ['care_plan', 'Care plan record']]) {
    for (const [action, verb] of [['created', 'added'], ['updated', 'updated'], ['deleted', 'removed']]) {
      const notice = h.patientNotice(careRecord({ event_type: `${kind}.${action}`, extra_data: { ...careRecord().extra_data, kind, action } }))
      assert.ok(notice)
      assert.equal(notice.title, `${noun} ${verb}`)
      assert.equal(notice.body, `A clinician ${verb} a ${noun.toLowerCase()}. Open your care page to review your current recorded instructions.`)
      assert.equal(notice.href, '/patient/prescription-care-plan')
      assert.equal(notice.careRecord, true)
      assert.equal(notice.official, false)
      assert.doesNotMatch(JSON.stringify(notice), /untrusted.invalid|Untrusted title|Synthetic clinical text/)
    }
  }
  const legacy = h.patientNotice(careRecord({ extra_data: { ...careRecord().extra_data, resource_id: null, record_reference_hash: 'a'.repeat(64) } }))
  assert.ok(legacy)
  assert.equal(legacy.href, '/patient/prescription-care-plan')
})

test('reserved care provenance rejects mismatched, incomplete, noncanonical and clinical-content metadata', () => {
  const extra = careRecord().extra_data
  for (const changes of [
    { source: 'manual' }, { event_type: 'account.note' }, { event_type: 'medication_instruction.stopped' }, { event_type: 'care_plan.updated' },
    { id: consultation }, { source_id: consultation },
    ...[
      { audit_id: consultation }, { actor_user_id: '../actor' }, { actor_user_id: extra.actor_user_id.toUpperCase() },
      { kind: 'care_plan' }, { action: 'deleted' }, { resource_id: extra.resource_id.toUpperCase() },
      { resource_id: null }, { record_reference_hash: 'a'.repeat(64) },
      { resource_id: null, record_reference_hash: 'A'.repeat(64) }, { resource_id: null, record_reference_hash: 'a'.repeat(63) },
      { clinical_text: 'Synthetic private instruction' },
    ].map(fields => ({ extra_data: { ...extra, ...fields } })),
    { extra_data: [] }, { extra_data: null },
  ]) assert.equal(h.patientNotice(careRecord(changes)), null)
  for (const key of Object.keys(extra)) {
    const missing = { ...extra }; delete missing[key]
    assert.equal(h.patientNotice(careRecord({ extra_data: missing })), null)
  }
})

test('downgraded unverified care activity stays an account update without a care link', () => {
  const notice = h.patientNotice(careRecord({ event_type: 'patient_reported_activity', source: 'patient-reported', source_id: null, title: 'Account update', body: 'This account activity could not be verified as a clinician record change.', href: null, extra_data: {} }))
  assert.ok(notice)
  assert.equal(notice.careRecord, false)
  assert.equal(notice.official, false)
  assert.equal(notice.href, undefined)
  assert.equal(notice.title, 'Account update')
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
  for (const value of ['//evil.invalid', 'https://evil.invalid', 'javascript:example', '/doctor/dashboard', '/admin/dashboard', '/patient/consultation-summary?consultationId='+consultation, '/patient/prescription-care-plan', '/patient/prescription-care-plan?recordId='+recordId, '/patient/settings?secret=value', '/patient/messages#private', '/patient/medical-records?recordId=bad', `/patient/medical-records?recordId=${recordId}&recordId=${recordId}`, '/patient/medical-records?note=private', '/patient/messages\n', '/\\evil.invalid', null]) assert.equal(h.safePatientNoticeHref(value), undefined)
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

test('notification pages validate complete bounded metadata and never invent legacy totals', () => {
  const modern = { notifications: [official()], has_more: true, next_cursor: 'v1.cGFnZQ', unread_count: 73 }
  assert.deepEqual(JSON.parse(JSON.stringify(h.patientNotices(modern))), {
    items: JSON.parse(JSON.stringify(h.patientNotices({ notifications: [official()] }).items)), invalidCount: 0,
    paginated: true, hasMore: true, nextCursor: 'v1.cGFnZQ', unreadCount: 73,
  })
  const legacy = h.patientNotices({ notifications: [official()] })
  assert.equal(legacy.paginated, false); assert.equal(legacy.unreadCount, null); assert.equal(legacy.hasMore, false); assert.equal(legacy.nextCursor, null)
  for (const change of [
    { has_more: undefined }, { has_more: 'true' }, { next_cursor: undefined }, { next_cursor: null },
    { next_cursor: '' }, { next_cursor: 'v2.cGFnZQ' }, { next_cursor: 'v1.bad cursor' }, { next_cursor: 'v1.' + 'a'.repeat(254) },
    { unread_count: undefined }, { unread_count: -1 }, { unread_count: .5 }, { unread_count: '73' }, { unread_count: Infinity }, { unread_count: Number.MAX_SAFE_INTEGER + 1 },
    { notifications: [] }, { has_more: false },
  ]) assert.equal(h.patientNotices({ ...modern, ...change }), null)
  for (const key of ['has_more', 'next_cursor', 'unread_count']) assert.equal(h.patientNotices({ notifications: [], [key]: modern[key] }), null)
  assert.equal(h.patientNotices({ notifications: [], has_more: false, next_cursor: null, unread_count: 0 }).unreadCount, 0)
  assert.equal(h.patientNotices({ ...modern, notifications: [null] }).hasMore, true)
})

test('notification cursors stay opaque in API query parameters', () => {
  assert.equal(h.patientNotificationPath(null), h.PATIENT_NOTIFICATIONS_PATH + '?limit=50')
  assert.equal(h.patientNotificationPath('v1.cGFnZQ'), h.PATIENT_NOTIFICATIONS_PATH + '?limit=50&before=v1.cGFnZQ')
})

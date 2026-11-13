const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, dependencies = {}) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: name => dependencies[name] ?? require(name) }, { filename: file })
  return compiled.exports
}
const clinical = load('lib/clinical-record.ts')
const helpers = load('lib/patient-consultation-summary.ts', { './clinical-record': clinical })
const id = '66666666-6666-4666-8666-666666666666'
function published(overrides = {}) {
  return { id: '77777777-7777-4777-8777-777777777777', episode_id: '88888888-8888-4888-8888-888888888888', consultation_id: id,
    revision: 2, version: 4, approved_by: 'synthetic-clinician', published_at: '2030-07-10T08:00:00Z', language: 'en',
    summary: 'Synthetic summary', history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: 'Synthetic plan', safety_net: 'Synthetic advice', amendment_reason: 'Synthetic correction', ...overrides }
}

test('summary destinations are generated from canonical UUIDs and never trusted catalog URLs', () => {
  const upper = 'ABCDEFAB-1234-4321-9876-ABCDEFABCDEF'
  assert.equal(helpers.consultationSummaryId(upper), upper.toLowerCase())
  assert.equal(helpers.consultationSummaryHref(id), `/patient/consultation-summary?consultationId=${id}`)
  for (const unsafe of [null, 3, {}, '', ` ${id}`, `${id} `, `${id}\n`, `${id}?secret=example`, '../doctor', 'https://example.test', 'javascript:alert(1)', '%2e%2e', [id]]) {
    assert.equal(helpers.consultationSummaryId(unsafe), null)
    assert.equal(helpers.consultationSummaryHref(unsafe), undefined)
  }
})

test('only a published record bound to this consultation can reach the reader', () => {
  const record = published()
  assert.equal(helpers.publishedConsultationSummary(record, id), record)
  assert.equal(helpers.publishedConsultationSummary(published({ consultation_id: 'ABCDEFAB-1234-4321-9876-ABCDEFABCDEF' }), id), null)
  for (const overrides of [{ approved_by: null }, { approved_by: '' }, { approved_by: '  ' }, { published_at: null }, { published_at: 'bad date' }, { id: 'bad-id' }, { episode_id: '' }, { revision: 0 }, { revision: 1.1 }, { version: -1 }, { language: 'ar' }, { language: ['en'] }, { summary: null }, { amendment_reason: 1 }]) {
    assert.equal(helpers.publishedConsultationSummary(published(overrides), id), null, JSON.stringify(overrides))
  }
  for (const value of [null, [], '', 4, { draft: record }]) assert.equal(helpers.publishedConsultationSummary(value, id), null)
  assert.equal(helpers.publishedConsultationSummary(record, 'invalid'), null)
})

test('record fields and amendment text obey the existing clinical schema bounds', () => {
  for (const field of clinical.clinicalFields) {
    assert.ok(helpers.publishedConsultationSummary(published({ [field.key]: 'x'.repeat(field.max) }), id))
    assert.equal(helpers.publishedConsultationSummary(published({ [field.key]: 'x'.repeat(field.max + 1) }), id), null)
  }
  assert.ok(helpers.publishedConsultationSummary(published({ amendment_reason: 'x'.repeat(500) }), id))
  assert.equal(helpers.publishedConsultationSummary(published({ amendment_reason: 'x'.repeat(501) }), id), null)
  assert.ok(helpers.publishedConsultationSummary(published({ amendment_reason: null, history: '' }), id))
})

test('unavailable publication times remain unavailable rather than receiving an invented timestamp', () => {
  for (const value of [null, '', 'not a time', 3]) assert.equal(helpers.summaryPublicationTime(value), null)
  assert.equal(typeof helpers.summaryPublicationTime('2030-07-10T08:00:00Z'), 'string')
})

const records = load('components/patient/ClinicalRecords.tsx', {
  '@/components/ui/SupportReference': { default: () => null },
  './PatientPortalPrimitives': {
    PortalCard: ({ children, ...props }) => React.createElement('section', props, children),
    PortalButton: ({ children, ...props }) => React.createElement('button', props, children),
    PortalLinkButton: ({ children, href }) => React.createElement('a', { href }, children),
  },
})
test('shared clinical states retain actionable errors and safely render escaped multiline records', () => {
  const error = renderToStaticMarkup(React.createElement(records.RecordLoadState, { loading: false, error: true, errorMessage: 'Synthetic service unavailable', retry() {} }, 'hidden'))
  assert.match(error, /role="alert"/)
  assert.match(error, /Synthetic service unavailable/)
  assert.match(error, /Try again/)
  assert.doesNotMatch(error, /hidden/)
  const text = renderToStaticMarkup(React.createElement(records.RecordFields, { record: { summary: '<script>example</script>\nnext line', plan: '' }, fields: [['summary', 'Summary'], ['plan', 'Care plan']] }))
  assert.match(text, /&lt;script&gt;example&lt;\/script&gt;/)
  assert.doesNotMatch(text, /<script>|Care plan/)
  const empty = renderToStaticMarkup(React.createElement(records.EmptyRecords, { title: 'No summary', description: 'Not yet published', showDashboardLink: false }))
  assert.doesNotMatch(empty, /Back to dashboard/)
})

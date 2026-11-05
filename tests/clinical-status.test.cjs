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
const statuses = load('lib/clinical-status.ts')
const {medicalUploadError,MAX_MEDICAL_UPLOAD_BYTES} = load('lib/clinical-upload.ts')
const Badge = load('components/ui/ClinicalStatusBadge.tsx', {
  '@/lib/clinical-status': statuses,
  '@/components/patient/PatientPortalPrimitives': {
    PortalBadge: ({children, tone}) => React.createElement('span', { 'data-semantic-tone': tone }, children),
  },
}).default

test('canonical consultation states and supported legacy aliases retain exact meanings', () => {
  for (const [value, label] of [['SCHEDULED', 'Scheduled'], [' started ', 'In progress'], ['in_progress', 'In progress'], ['ENDED', 'Ended'], ['completed', 'Completed'], ['CANCELLED', 'Cancelled']]) {
    assert.equal(statuses.clinicalStatus(value, 'consultation').label, label)
  }
})

test('unknown or absent status remains visible and neutral rather than implying success', () => {
  for (const value of ['', null, undefined, {}, 1]) {
    const result = statuses.clinicalStatus(value, 'medication')
    assert.equal(result.label, 'Status unavailable')
    assert.equal(result.tone, 'neutral')
  }
  assert.equal(statuses.clinicalStatus('EXTERNAL_REVIEW', 'medication').label, 'EXTERNAL REVIEW')
  assert.equal(statuses.clinicalStatus('EXTERNAL_REVIEW', 'medication').tone, 'neutral')
})

test('medication, care-plan and diagnostic lifecycles are domain-specific', () => {
  assert.equal(statuses.clinicalStatus('Active', 'medication').tone, 'success')
  assert.equal(statuses.clinicalStatus('Active', 'care-plan').tone, 'info')
  assert.equal(statuses.clinicalStatus('Completed', 'medication').tone, 'neutral')
  assert.equal(statuses.clinicalStatus('Completed', 'care-plan').tone, 'success')
  assert.equal(statuses.clinicalStatus('on-hold', 'medication').tone, 'warning')
  assert.equal(statuses.clinicalStatus('Results Available', 'lab-request').label, 'Results available')
  assert.equal(statuses.clinicalStatus('STARTED', 'episode').tone, 'neutral')
})

test('shared badge renders readable status with a semantic tone in either theme', () => {
  const html = renderToStaticMarkup(React.createElement(Badge, {status: 'Stopped', domain: 'medication'}))
  assert.match(html, /Stopped/)
  assert.match(html, /data-status-tone="neutral"/)
  assert.doesNotMatch(html, /#[0-9a-f]{3,8}|rgb\(/i)
})

test('medical attachment limit fits the current multipart BFF ceiling and rejects empty/oversized files', () => {
  assert.equal(MAX_MEDICAL_UPLOAD_BYTES,3*1024*1024)
  assert.equal(medicalUploadError(MAX_MEDICAL_UPLOAD_BYTES),null)
  assert.match(medicalUploadError(MAX_MEDICAL_UPLOAD_BYTES+1),/3 MB or smaller/)
  assert.match(medicalUploadError(0),/non-empty/)
})

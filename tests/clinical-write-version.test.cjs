const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
const m = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/clinical-write-version.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports }); const h = m.exports
const token = 'qwv1_' + 'a'.repeat(43), quoted = '"' + token + '"'
test('only an exact opaque version becomes one strong double-quoted If-Match value', () => {
  assert.equal(h.clinicalWriteVersion(token), token); assert.equal(h.recordWriteVersion({ write_version: token }), token)
  assert.equal(h.clinicalWriteHeaders(token)['If-Match'], quoted); assert.equal(h.strongClinicalIfMatch(quoted), quoted)
  for (const value of [null, {}, undefined, '', token.slice(0, -1), token + 'x', ' ' + token, token + '\n', quoted, 'qwv1_' + '/'.repeat(43)]) {
    assert.equal(h.clinicalWriteVersion(value), null); assert.throws(() => h.clinicalWriteHeaders(value), /Reload/)
  }
  for (const value of [token, 'W/' + quoted, '*', quoted + ',' + quoted, quoted + ', ' + quoted, '""', ' ' + quoted, quoted + '\n']) assert.equal(h.strongClinicalIfMatch(value), null)
})
test('the BFF conditional-header allowlist is limited to existing doctor PUT/DELETE routes', () => {
  const routes = [['PUT', '/api/v1/doctor/prescriptions'], ['PUT', '/api/v1/doctor/lab-orders'], ['PUT', '/api/v1/doctor/care-plans/patient/cp-record'], ...['prescriptions', 'care-plans', 'lab-orders'].map(kind => ['DELETE', '/api/v1/doctor/' + kind + '/patient/record'])]
  for (const [method, path] of routes) { assert.equal(h.clinicalConditionalRoute('doctor', method, path), true); for (const portal of ['patient', 'admin', 'unknown']) assert.equal(h.clinicalConditionalRoute(portal, method, path), false) }
  for (const [method, path] of [['POST', '/api/v1/doctor/prescriptions'], ['PATCH', '/api/v1/doctor/lab-orders'], ['PUT', '/api/v1/security/password'], ['DELETE', '/api/v1/doctor/lab-orders/patient/record/result'], ['POST', '/api/v1/doctor/lab-orders/patient/record/result/review'], ['PUT', '/api/v1/doctor/care-plans/patient/record?version=unsafe']]) assert.equal(h.clinicalConditionalRoute('doctor', method, path), false)
})
test('only the finite clinical-change conflict is classified without rendering arbitrary response fields', () => {
  const body = JSON.stringify({ detail: { error_code: 'CLINICAL_RECORD_CHANGED', message: 'Fixed safe error' } })
  assert.equal(h.clinicalRecordChanged(412, body), true)
  for (const [status, value] of [[409, body], [412, 'not-json'], [412, '{}'], [412, JSON.stringify({ detail: { error_code: 'SESSION_CHANGED' } })]]) assert.equal(h.clinicalRecordChanged(status, value), false)
})

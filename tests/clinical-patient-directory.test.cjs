const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm')
const compiled = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/clinical-patient-directory.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: compiled.exports, module: compiled, URLSearchParams })
const helper = compiled.exports
const patient = { patient_id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic Alpha', email: 'synthetic@example.test' }
test('directory searches use a fixed endpoint and bounded private JSON read bodies', () => {
  const body = helper.clinicalPatientDirectoryBody(2, ' Name & phone ')
  assert.equal(helper.CLINICAL_PATIENT_DIRECTORY_SEARCH_PATH, '/api/v1/doctor/patients/search')
  assert.equal(body.page_size, 25); assert.equal(body.page, 2); assert.equal(body.q, 'Name & phone')
  assert.equal(helper.clinicalPatientDirectoryBody(-1, 'x'.repeat(1000)).q.length, 160)
  assert.equal(helper.clinicalPatientDirectoryBody(-1).page, 1)
  const exact = new URL(helper.clinicalSelectedPatientPath(patient.patient_id), 'https://synthetic.test')
  assert.equal(exact.searchParams.get('patient_id'), patient.patient_id); assert.equal(exact.searchParams.get('page_size'), '1'); assert.equal(exact.searchParams.has('q'), false)
  assert.equal(helper.clinicalSelectedPatientPath('../foreign?patient=1'), null)
})
test('directory response rejects foreign page metadata, unbounded rows, duplicate IDs and malformed identities', () => {
  const normal = { patients: [patient], page: 2, page_size: 25, has_next: true }
  assert.equal(helper.clinicalPatientDirectoryPage(normal, 2).patients[0].label, 'Synthetic Alpha')
  assert.equal(helper.clinicalPatientDirectoryPage(normal, 2).hasNext, true)
  assert.equal(helper.clinicalPatientDirectoryPage(normal, 1).invalid, true)
  for (const rows of [[patient, patient], [null], [{ patient_id: 'unsafe/id' }], Array.from({ length: 26 }, (_, i) => ({ ...patient, patient_id: 'id-' + i }))]) assert.equal(helper.clinicalPatientDirectoryPage({ patients: rows }, 1).invalid, true)
})
test('selected relationship lookup is independent of search/page and requires exactly one matching identity', () => {
  const response = { patients: [patient] }, before = JSON.stringify(response)
  assert.equal(helper.clinicalSelectedPatient(response, patient.patient_id).id, patient.patient_id)
  assert.equal(helper.clinicalSelectedPatient(response, 'different-patient'), null)
  assert.equal(helper.clinicalSelectedPatient({ patients: [patient, patient] }, patient.patient_id), null)
  assert.equal(helper.clinicalSelectedPatient({ patients: [patient, { ...patient, patient_id: 'other-patient' }] }, patient.patient_id), null)
  assert.equal(helper.clinicalSelectedPatient({ patients: [patient], page_size: 25 }, patient.patient_id), null)
  assert.equal(helper.clinicalSelectedPatient({ patients: [patient], page: 2 }, patient.patient_id), null)
  assert.equal(helper.clinicalSelectedPatient(null, patient.patient_id), null)
  assert.equal(JSON.stringify(response), before)
})

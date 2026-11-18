const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'safety-screen.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
const stubApi = { apiGet: () => undefined, apiPost: () => undefined, apiPut: () => undefined }
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: name => (name === '@/lib/api' ? stubApi : require(name)), JSON })
const { safeBookingReturn, safetyContentErrors, cleanSafetyContent, questionId, emptySafetyContent } = loaded.exports

const valid = () => ({
  intro: 'Synthetic introduction',
  questions: [
    { id: 'synthetic-a', prompt: 'Synthetic emergency question?', help: '', route_if_yes: 'EMERGENCY' },
    { id: 'synthetic-b', prompt: 'Synthetic in-person question?', help: '', route_if_yes: 'IN_PERSON' },
  ],
  outcomes: {
    EMERGENCY: { title: 'Synthetic emergency', body: 'Synthetic guidance', action_label: 'Call 112', action_href: 'tel:112' },
    IN_PERSON: { title: 'Synthetic in person', body: 'Synthetic guidance', action_label: '', action_href: '' },
  },
  continue_message: '',
})

test('only internal booking pages are accepted as the continuation', () => {
  assert.equal(safeBookingReturn('/patient/consultation-booking/date-time?physicianId=x'), '/patient/consultation-booking/date-time?physicianId=x')
  for (const value of [null, '', 'https://evil.example', '//evil.example', '/patient/dashboard', '/patient/consultation-booking/safety?next=x', '/patient/consultation-booking/ x', '/patient/consultation-booking\\x']) {
    assert.equal(safeBookingReturn(value), '/patient/consultation-booking/date-time')
  }
})

test('valid content passes and blank optional fields are dropped', () => {
  const cleaned = cleanSafetyContent(valid())
  assert.deepEqual([...safetyContentErrors('Synthetic screen', cleaned)], [])
  assert.equal(cleaned.continue_message, null)
  assert.equal(cleaned.outcomes.IN_PERSON.action_href, null)
  assert.equal(cleaned.questions[0].help, null)
})

test('editor reports the problems the API would refuse', () => {
  const content = valid()
  delete content.outcomes.IN_PERSON
  content.outcomes.EMERGENCY.action_href = 'javascript:alert(1)'
  content.questions.push({ ...content.questions[0] })
  const problems = safetyContentErrors('No', cleanSafetyContent(content)).join('\n')
  assert.match(problems, /Title must be/)
  assert.match(problems, /repeats the id/)
  assert.match(problems, /In-person examination/)
  assert.match(problems, /tel:/)
})

test('question ids are derived from the prompt and kept unique', () => {
  assert.equal(questionId('Chest Pain or Pressure?', []), 'chest-pain-or-pressure')
  assert.equal(questionId('Chest pain or pressure', ['chest-pain-or-pressure']), 'chest-pain-or-pressure-2')
  assert.match(questionId('?', []), /^q-|^question/)
  assert.equal(emptySafetyContent().questions.length, 1)
})

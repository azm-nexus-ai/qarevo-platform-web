const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, dependencies = {}) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: name => dependencies[name] ?? require(name) }, { filename: file })
  return compiled.exports
}
class ApiError extends Error { constructor(status, body) { super(body); this.status = status; this.body = body } }
const helpers = load('lib/clinical-instructions.ts', { './api': { ApiError } })
const records = load('lib/clinical-record.ts')
const summaries = load('lib/patient-consultation-summary.ts', { './clinical-record': records })
const forms = load('lib/clinical-authoring.ts', { './clinical-instructions': helpers, './patient-consultation-summary': summaries })
const medication = (extra = {}) => ({ id: 'med-11111111-1111-4111-8111-111111111111', name: 'Synthetic medication', strength: 'Synthetic strength', dosage: 'Synthetic dose', frequency: 'Synthetic frequency', duration: 'Synthetic duration', brand: '', instructions: '', food: '', refill: '', status: 'Active', times: ['Morning'], ...extra })

test('historical null/object/missing schedules never crash or invent a replacement schedule', () => {
  for (const times of [undefined, null, {}, 'Morning', [1], ['Morning', {}], ['25:00'], ['Morning', 'Morning']]) {
    const record = helpers.medicationInstruction(medication({ times }))
    assert.equal(record.times.length, 0)
    assert.notEqual(record.quality.scheduleState, 'recorded')
  }
  assert.equal(helpers.medicationInstruction(medication({ times: ['Morning', '08:00'] })).times.join(', '), 'Morning, 08:00')
  assert.equal(helpers.medicationInstruction(medication({ times: ['Morning'], data_quality: { schedule_state: 'unavailable' } })).times.length, 0)
})

test('missing clinical values stay missing, unknown status stays neutral text, and legacy adherence status is not a report', () => {
  const value = helpers.medicationInstruction({ id: 'legacy-id', name: 'Synthetic legacy medication', status: 'Taken today' })
  assert.equal(value.dosage, null); assert.equal(value.strength, null); assert.equal(value.times.length, 0)
  assert.equal(value.status, 'Taken today'); assert.equal(value.takenToday, false); assert.equal(value.canMarkTaken, false)
  assert.ok(value.quality.warnings.some(warning => warning.code === 'historical_adherence_status'))
  const plan = helpers.careInstruction({ title: 'Synthetic plan', progress: null, status: 'Watchful waiting' })
  assert.equal(plan.progress, null); assert.equal(plan.status, 'Watchful waiting')
  assert.equal(helpers.careInstruction({ progress: '42' }).progress, null)
})

test('adherence requires explicit patient-reported metadata and never changes the recorded clinical status', () => {
  const original = medication({ can_mark_taken: true, taken_today: true, adherence: { source: 'patient-reported', reported_today: true, reported_at: '2030-07-13T08:00:00Z' } })
  const before = JSON.stringify(original), value = helpers.medicationInstruction(original)
  assert.equal(value.status, 'Active'); assert.equal(value.takenToday, true); assert.equal(value.canMarkTaken, true)
  assert.equal(JSON.stringify(original), before)
  assert.equal(helpers.medicationInstruction(medication({ can_mark_taken: true, status: 'Stopped' })).canMarkTaken, false)
  assert.equal(helpers.medicationInstruction(medication({ taken_today: true })).takenToday, false)
})

test('new medications require exactly the five clinical fields; optional instructions may stay blank', () => {
  const empty = forms.emptyAuthoringForm('medication')
  const missing = forms.authoringChanges('medication', empty, empty, false)
  assert.deepEqual(Object.keys(missing.errors).sort(), ['dosage', 'duration', 'frequency', 'name', 'strength'])
  const valid = { ...empty, values: { ...empty.values, name: ' Name ', strength: ' strength ', dosage: ' dose ', frequency: ' frequency ', duration: ' duration ' }, times: ['Morning'], clockTimes: '08:00' }
  const result = forms.authoringChanges('medication', valid, empty, false)
  assert.equal(Object.keys(result.errors).length, 0); assert.equal(result.payload.name, 'Name')
  assert.equal(result.payload.instructions, ''); assert.equal(result.payload.times.join(', '), 'Morning, 08:00')
})

test('edits send only changed fields and optional clears, without resending normalized historical gaps', () => {
  const baseline = forms.savedAuthoringForm('medication', { id: 'legacy', name: 'Synthetic old name', times: { invalid: true }, instructions: 'Synthetic existing note' })
  const form = { ...baseline, values: { ...baseline.values, instructions: '' } }
  const result = forms.authoringChanges('medication', form, baseline, true)
  assert.equal(Object.keys(result.errors).length, 0)
  assert.deepEqual(Object.keys(result.payload), ['instructions']); assert.equal(result.payload.instructions, '')
  const requiredClear = { ...baseline, values: { ...baseline.values, name: '  ' } }
  assert.equal(forms.authoringChanges('medication', requiredClear, baseline, true).errors.name, 'Medication Name is required.')
  const plan = forms.savedAuthoringForm('care-plan', { title: 'Synthetic plan', progress: 20, status: 'Monitoring', description: 'Details' })
  assert.equal(forms.authoringChanges('care-plan', { ...plan, values: { ...plan.values, progress: '' } }, plan, true).payload.progress, null)
})

test('invalid, repeated or excessive schedules and invalid progress receive exact inline errors', () => {
  const empty = forms.emptyAuthoringForm('medication')
  for (const clockTimes of ['9:00', '25:00', 'Morning', '08:00, 08:00']) assert.ok(forms.authoringChanges('medication', { ...empty, times: ['Morning'], clockTimes }, empty, false).errors.times)
  const plan = forms.emptyAuthoringForm('care-plan')
  for (const progress of ['1.5', '-1', '101', 'not numeric']) assert.ok(forms.authoringChanges('care-plan', { ...plan, values: { ...plan.values, progress } }, plan, false).errors.progress)
})

test('Pydantic field errors remain exact and map nested schedule errors to the visible field', () => {
  const errors = helpers.clinicalValidationErrors(new ApiError(422, JSON.stringify({ detail: [{ loc: ['body', 'dosage'], msg: 'Synthetic exact dose validation' }, { loc: ['body', 'times', 0], msg: 'Synthetic exact schedule validation' }] })))
  assert.equal(errors.dosage, 'Synthetic exact dose validation'); assert.equal(errors.times, 'Synthetic exact schedule validation')
  assert.equal(Object.keys(helpers.clinicalValidationErrors(new ApiError(503, '{}'))).length, 0)
})

test('read adapters bound large or malformed lists without mutating the saved payload', () => {
  const raw = Array.from({ length: 205 }, (_, index) => medication({ id: 'legacy-' + index }))
  const before = JSON.stringify(raw), list = helpers.instructionList(raw)
  assert.equal(list.items.length, 200); assert.equal(list.truncated, true); assert.equal(JSON.stringify(raw), before)
  assert.equal(helpers.instructionList({ invalid: true }).invalid, true)
  assert.equal(helpers.instructionList([null, {}, 'invalid']).invalidCount, 2)
})

const statuses = load('lib/clinical-status.ts')
const cards = load('components/clinical/InstructionRecords.tsx', {
  '@/lib/clinical-instructions': helpers,
  '@/components/ui/ClinicalStatusBadge': { default: ({ status, domain }) => React.createElement('span', { 'data-tone': statuses.clinicalStatus(status, domain).tone }, statuses.clinicalStatus(status, domain).label) },
  '@/components/patient/PatientPortalPrimitives': { PortalCard: ({ children, ...props }) => React.createElement('section', props, children), PortalButton: ({ children, tone, ...props }) => React.createElement('button', props, children) },
})
test('record cards safely show gaps and escaped text without fabricated dosage, schedule or progress', () => {
  const html = renderToStaticMarkup(React.createElement(cards.MedicationRecordCard, { medication: helpers.medicationInstruction({ name: '<script>synthetic</script>', times: {}, status: 'Stopped' }) }))
  assert.match(html, /Not recorded/); assert.match(html, /Schedule unavailable/); assert.match(html, /data-tone="neutral"/); assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>|Once daily|1 tablet/)
  const plan = renderToStaticMarkup(React.createElement(cards.CarePlanRecordCard, { plan: helpers.careInstruction({ title: 'Synthetic', progress: null }) }))
  assert.doesNotMatch(plan, /<progress|0%/)
})

test('optional missing values are not false quality warnings; blank plan progress remains unknown while zero is explicit', () => {
  const med = helpers.medicationInstruction(medication({ brand: null, instructions: null, food: null, refill: null }))
  assert.equal(med.quality.reviewNeeded, false)
  assert.equal(helpers.careInstruction({ id: 'cp-valid', title: 'Synthetic', status: 'Active', description: null, progress: null }).quality.reviewNeeded, false)
  const empty = forms.emptyAuthoringForm('care-plan')
  assert.equal(empty.values.progress, '')
  const blank = forms.authoringChanges('care-plan', { ...empty, values: { ...empty.values, title: 'Synthetic plan' } }, empty, false)
  assert.equal(blank.payload.progress, null)
  const zero = forms.authoringChanges('care-plan', { ...empty, values: { ...empty.values, title: 'Synthetic plan', progress: '0' } }, empty, false)
  assert.equal(zero.payload.progress, 0)
})
test('episode association is creation-only and duplicate identifiers cannot receive corrective writes', () => {
  const baseline = forms.savedAuthoringForm('medication', medication())
  const changed = { ...baseline, values: { ...baseline.values, episode_id: '11111111-1111-4111-8111-111111111111', instructions: 'Changed note' } }
  const result = forms.authoringChanges('medication', changed, baseline, true)
  assert.deepEqual(Object.keys(result.payload), ['instructions'])
  assert.equal(helpers.instructionList([medication(), medication()]).duplicateIds.length, 1)
  assert.equal(helpers.instructionActionsAllowed(helpers.medicationInstruction(medication({ data_quality: { warnings: [{ field: 'id', code: 'invalid_identifier' }] } }))), false)
})
test('server-approved safe legacy identifiers retain report eligibility and patient-zone metadata', () => {
  const med = helpers.medicationInstruction(medication({ id: 'med-historic', can_mark_taken: true, taken_today: true, adherence: { source: 'patient-reported', reported_today: true, recorded_on: '2030-07-13', time_zone: 'Europe/Berlin' } }))
  assert.equal(med.canMarkTaken, true); assert.equal(med.recordedOn, '2030-07-13'); assert.equal(med.timeZone, 'Europe/Berlin')
  assert.equal(helpers.medicationInstruction(medication({ adherence: { time_zone: 'invalid-zone' } })).timeZone, null)
})

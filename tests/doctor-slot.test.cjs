const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file) {
  const compiled = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { Intl, Date, Number, Math, module: compiled, exports: compiled.exports, require }, { filename: file })
  return compiled.exports
}
const slot = load('lib/doctor-slot.ts')

test('the earliest slot is formatted in the patient language and time zone', () => {
  const doctor = { nextAvailable: 'Fri, Dec 04, 9:00 AM (Europe/Berlin)', nextAvailableAt: '2026-12-04T08:00:00+00:00' }
  const german = slot.nextSlotText(doctor, 'de', 'Keine', 'Europe/Berlin')
  assert.match(german, /Fr\.?/)
  assert.match(german, /09:00/)
  assert.doesNotMatch(german, /AM|Europe/)
  assert.match(slot.nextSlotText(doctor, 'en', 'None', 'Europe/Berlin'), /Fri.*09:00/)
})

test('no free slot never shows the English API label', () => {
  assert.equal(slot.nextSlotText({ nextAvailable: 'Not available', nextAvailableAt: null }, 'de', 'Keine freien Termine'), 'Keine freien Termine')
  assert.equal(slot.nextSlotText({ nextAvailable: 'Not available' }, 'de', 'Keine freien Termine'), 'Keine freien Termine')
  assert.equal(slot.nextSlotText({ nextAvailable: 'Tue, 10:00' }, 'de', 'Keine'), 'Tue, 10:00')
})

test('the lowest offer price ignores unpriced offers and is shown in euros', () => {
  assert.equal(slot.lowestOfferPrice({ services: [{ price: 0 }, { price: 120 }, { price: 80 }] }), 80)
  assert.equal(slot.lowestOfferPrice({ services: [{ price: 0 }] }), null)
  assert.equal(slot.lowestOfferPrice({}), null)
  assert.match(slot.formatEuro(80, 'de'), /^80\s?€$/)
  assert.equal(slot.formatEuro(80, 'en'), '€80')
})

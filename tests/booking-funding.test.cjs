const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'booking-funding.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, Intl, Number })
const { bookingFunding, selfPayPricingBasis } = loaded.exports

test('saved statutory or private insurance with an insurer sets the episode route', () => {
  assert.deepEqual(
    { ...bookingFunding({ insurance_type: 'GKV', insurance_provider_name: ' Synthetic Kasse ' }) },
    { route: 'GKV', episodeInsuranceType: 'statutory', insurer: 'Synthetic Kasse', needsSelfPayConfirmation: false, label: 'Statutory insurance (GKV)' },
  )
  assert.equal(bookingFunding({ insurance_type: 'pkv', insurance_provider_name: 'Synthetic PKV' }).episodeInsuranceType, 'private')
})

test('no insurer, an incomplete record or a self-pay preference needs confirmation', () => {
  for (const value of [null, undefined, {}, { insurance_type: 'GKV' }, { insurance_type: 'SELF_PAY' }, { insurance_type: 'self-pay', insurance_provider_name: 'x' }, { insurance_type: 42 }]) {
    const funding = bookingFunding(value)
    assert.equal(funding.route, 'SELF_PAY')
    assert.equal(funding.episodeInsuranceType, 'self_pay')
    assert.equal(funding.needsSelfPayConfirmation, true)
  }
})

test('the doctor’s accepted options never decide the route', () => {
  assert.equal(bookingFunding({ insurance_type: 'Self pay' }).route, 'SELF_PAY')
  assert.equal(bookingFunding({ insurance_type: 'Private', insurance_provider_name: 'Doctor option' }).route, 'SELF_PAY')
})

test('pricing basis shows a published fee and never invents one', () => {
  assert.match(selfPayPricingBasis(50), /50,00\s€/)
  for (const fee of [0, -1, NaN, null, '50']) assert.match(selfPayPricingBasis(fee), /has not yet published a price/)
  assert.match(selfPayPricingBasis(0), /GOÄ/)
})

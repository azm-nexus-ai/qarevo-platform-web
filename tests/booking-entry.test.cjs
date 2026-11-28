const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const target = {exports: {}}
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/booking.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText
vm.runInNewContext(code, {module: target, exports: target.exports, URLSearchParams})
const booking = target.exports
const provider = '11111111-1111-4111-8111-111111111111'
const episode = '22222222-2222-4222-8222-222222222222'

test('generic booking entry leads to doctor discovery and retains bounded intake references only', () => {
  const source = new URLSearchParams({episode_id: episode, intake_submitted: 'true', service: 'video', notes: 'private-notes', chief_complaint: 'private-history', physicianImageUrl: 'data:image/png;base64,' + 'A'.repeat(50000)})
  const destination = new URL(booking.bookingEntryDestination(source), 'https://qarevo.example')
  assert.equal(destination.pathname, '/patient/find-doctor')
  assert.equal(destination.searchParams.get('episode_id'), episode)
  assert.equal(destination.searchParams.get('intake_submitted'), 'true')
  assert.equal(destination.searchParams.get('service'), 'video')
  assert.ok(destination.href.length < 300)
  assert.doesNotMatch(destination.href, /private|chief_complaint|notes|data%3A|physicianImage/)
})

for (const source of [new URLSearchParams(), new URLSearchParams({provider_id: ''}), new URLSearchParams({physicianId: '../invalid'}), new URLSearchParams({provider_id: 'x'.repeat(100)}), new URLSearchParams({provider_id: provider, physicianId: 'different-doctor'})]) {
  test(`missing, malformed or conflicting booking provider is not selectable: ${source.toString().slice(0, 60)}`, () => {
    assert.equal(booking.readBookingProviderId(source), '')
    assert.equal(new URL(booking.bookingEntryDestination(source), 'https://qarevo.example').pathname, '/patient/find-doctor')
  })
}

test('valid booking aliases preserve provider, service, date, slot and existing intake reference', () => {
  for (const alias of ['physicianId', 'provider_id']) {
    const source = new URLSearchParams({[alias]: provider, episode_id: episode, intake_submitted: 'true', service_type: 'follow-up', date: '2030-07-10', slot: '9:00 AM'})
    const destination = new URL(booking.bookingEntryDestination(source), 'https://qarevo.example')
    assert.equal(destination.pathname, '/patient/consultation-booking/date-time')
    for (const key of ['provider_id', 'physicianId']) assert.equal(destination.searchParams.get(key), provider)
    assert.equal(destination.searchParams.get('episode_id'), episode)
    assert.equal(destination.searchParams.get('service'), 'follow-up')
    assert.equal(destination.searchParams.get('slot'), '9:00 AM')
  }
})

test('choosing another doctor discards the previous identity and slot while retaining care references', () => {
  const source = new URLSearchParams({provider_id: provider, physicianId: provider, episode_id: episode, intake_submitted: 'true', date: '2030-07-10', slot: '9:00 AM', start_at: '2030-07-10T07:00:00Z', end_at: '2030-07-10T07:30:00Z'})
  const destination = new URL(booking.buildDoctorDiscoveryHref(source, 'video'), 'https://qarevo.example')
  assert.equal(destination.searchParams.get('episode_id'), episode)
  assert.equal(destination.searchParams.get('intake_submitted'), 'true')
  for (const key of ['provider_id', 'physicianId', 'slot', 'start_at', 'end_at']) assert.equal(destination.searchParams.has(key), false)
})

test('selected doctor identity is sourced from its matching authenticated response, never demo data', () => {
  const selected = new URLSearchParams({provider_id: provider})
  assert.equal(booking.getBookingPhysician(selected, {id: 'other', name: 'Wrong doctor'}).name, 'Loading physician...')
  assert.equal(booking.getBookingPhysician(selected, {id: provider, name: 'Actual doctor'}).name, 'Actual doctor')
  assert.equal(booking.getBookingPhysician(new URLSearchParams({physicianId: 'sophia-reed'})).name, 'Loading physician...')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const target = { exports: {} }
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/clinical-order-dates.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { module: target, exports: target.exports, Date, Error })
const { orderDateFromIso, orderDateToIso } = target.exports

function withTimezone(zone, run) {
  const previous = process.env.TZ
  process.env.TZ = zone
  try { run() } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
}
for (const [zone, local] of [['Europe/Berlin', '2026-11-05T15:30'], ['America/New_York', '2026-11-05T09:30'], ['Asia/Kolkata', '2026-11-05T20:00']]) {
  test(`lab order datetime round trip preserves its instant in ${zone}`, () => withTimezone(zone, () => {
    const original = '2026-11-05T14:30:22.123Z'
    assert.equal(orderDateFromIso(original), local)
    assert.equal(orderDateToIso(local, original), original)
    assert.equal(orderDateToIso(local), '2026-11-05T14:30:00.000Z')
  }))
}
test('an unchanged repeated DST hour retains its original later occurrence', () => withTimezone('Europe/Berlin', () => {
  const later = '2026-10-25T01:30:35.000Z'
  assert.equal(orderDateFromIso(later), '2026-10-25T02:30')
  assert.equal(orderDateToIso('2026-10-25T02:30', later), later)
}))
test('nonexistent DST time and invalid inputs give an explicit validation error', () => withTimezone('Europe/Berlin', () => {
  assert.throws(() => orderDateToIso('2026-03-29T02:30'), /valid local date and time/)
  assert.throws(() => orderDateToIso('invalid'), /valid local date and time/)
  assert.equal(orderDateFromIso('invalid'), '')
  assert.equal(orderDateToIso(''), '')
}))

test('a new ambiguous DST time requires an explicit unambiguous choice', () => withTimezone('Europe/Berlin', () => {
  assert.throws(() => orderDateToIso('2026-10-25T02:30'), /occurs twice/)
}))

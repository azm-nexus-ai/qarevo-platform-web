const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const compiled = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/calendar-file.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module: compiled, exports: compiled.exports, require, TextEncoder, Date, Number, Error }, { filename: 'lib/calendar-file.ts' })
const { calendarFile } = compiled.exports
const base = { uid: 'appt-1', start: '2026-12-04T09:00:00Z', end: '2026-12-04T09:30:00Z', title: 'Video-Sprechstunde: Dr. Synthetic, Beispiel', description: 'Termin bei Qarevo Health.\nBitte 5 Minuten früher da sein; danke', url: 'https://example.test/patient/appointment-details?appointmentId=appt-1', now: new Date('2026-11-28T12:00:00Z') }

test('an appointment becomes a valid iCalendar event in UTC with a 30-minute reminder', () => {
  const file = calendarFile(base)
  assert.match(file, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/)
  assert.match(file, /\r\nDTSTART:20261204T090000Z\r\nDTEND:20261204T093000Z\r\n/)
  assert.match(file, /\r\nUID:appt-1@qarevo\.health\r\n/)
  assert.match(file, /\r\nTRIGGER:-PT30M\r\n/)
  assert.ok(file.endsWith('END:VCALENDAR\r\n'))
})

test('text is escaped and long lines are folded to 75 octets', () => {
  const file = calendarFile(base), unfolded = file.replace(/\r\n /g, '')
  assert.ok(unfolded.includes('SUMMARY:Video-Sprechstunde: Dr. Synthetic\\, Beispiel'))
  assert.ok(unfolded.includes('früher da sein\; danke'))
  assert.ok(unfolded.includes('Qarevo Health.\\nBitte'))
  for (const line of file.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line)
})

test('an end before the start is refused', () => {
  assert.throws(() => calendarFile({ ...base, end: '2026-12-04T08:00:00Z' }), /Invalid appointment time/)
})

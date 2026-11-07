const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/profile-events.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function browserTab(id, channels, messages, unavailable = false) {
  class TestChannel {
    constructor(name) {
      if (unavailable) throw new Error('BroadcastChannel blocked')
      this.name = name
      this.closed = false
      channels.add(this)
    }
    postMessage(data) {
      messages.push(structuredClone(data))
      for (const other of channels) if (other !== this && !other.closed && other.name === this.name) other.onmessage?.({ data: structuredClone(data) })
    }
    close() { this.closed = true; channels.delete(this) }
  }
  const exports = {}
  vm.runInNewContext(source, { exports, window: new EventTarget(), Event, BroadcastChannel: TestChannel, crypto: { randomUUID: () => id } })
  return exports
}

test('profile changes invalidate their own portal once per tab and broadcast no identity or image data', () => {
  const channels = new Set(), messages = []
  const first = browserTab('tab-a', channels, messages), second = browserTab('tab-b', channels, messages)
  let firstPatient = 0, secondPatient = 0, doctor = 0
  const stopFirst = first.subscribeProfileChanges('patient', () => firstPatient++)
  const stopSecond = second.subscribeProfileChanges('patient', () => secondPatient++)
  const stopDoctor = second.subscribeProfileChanges('doctor', () => doctor++)
  assert.equal(channels.size, 2)
  first.notifyProfileChanged('patient')
  assert.equal(firstPatient, 1)
  assert.equal(secondPatient, 1)
  assert.equal(doctor, 0)
  assert.equal(first.profileRevision('patient'), 1)
  assert.equal(second.profileRevision('patient'), 1)
  assert.equal(second.profileRevision('doctor'), 0)
  assert.deepEqual(messages, [{ portal: 'patient', senderId: 'tab-a' }])
  second.notifyProfileChanged('doctor')
  assert.equal(firstPatient, 1)
  assert.equal(secondPatient, 1)
  assert.equal(doctor, 1)
  assert.equal(first.profileRevision('doctor'), 1)
  assert.equal(second.profileRevision('doctor'), 1)
  stopFirst(); stopSecond(); stopDoctor()
  assert.equal(channels.size, 0)
})

test('profile changes still update their local portal when cross-tab broadcasting is unavailable', () => {
  const channels = new Set(), messages = []
  const tab = browserTab('tab-a', channels, messages, true)
  let changes = 0
  const stop = tab.subscribeProfileChanges('patient', () => changes++)
  assert.doesNotThrow(() => tab.notifyProfileChanged('patient'))
  assert.equal(changes, 1)
  assert.deepEqual(messages, [])
  stop()
})

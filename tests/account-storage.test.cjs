const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')

const compile = name => ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '..', 'lib', name), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
const storageCode = compile('account-storage.ts')
const apiCode = compile('api.ts')
const slotModule = { exports: {} }
vm.runInNewContext(compile('booking-slot.ts'), { module: slotModule, exports: slotModule.exports, Date, Error })

test('clinical publication identifies every missing field and preserves bounded drafts', () => {
  const recordModule = { exports: {} }
  vm.runInNewContext(compile('clinical-record.ts'), { module: recordModule, exports: recordModule.exports })
  const { recordErrors, emptyRecord, contentOf } = recordModule.exports
  assert.equal(Object.keys(recordErrors(emptyRecord, true)).length, 6)
  assert.equal(Object.keys(recordErrors(emptyRecord, false)).length, 0)
  assert.match(recordErrors({ ...emptyRecord, summary: 'x'.repeat(5001) }, false).summary, /5,000/)
  assert.equal(contentOf(null).summary, '')
})

test('booking retains server UTC instants and refuses missing, ambiguous or malformed slots', () => {
  const { resolveBookingSlot } = slotModule.exports
  const slot = { label: '9:00 AM', start_at: '2030-07-10T07:00:00+00:00', end_at: '2030-07-10T07:30:00+00:00', time_zone: 'Europe/Berlin', duration_minutes: 30 }
  assert.equal(resolveBookingSlot([slot], '9:00 AM').start_at, '2030-07-10T07:00:00+00:00')
  assert.throws(() => resolveBookingSlot([], '9:00 AM'), /no longer available/)
  assert.throws(() => resolveBookingSlot([slot, slot], '9:00 AM'), /no longer available/)
  assert.throws(() => resolveBookingSlot([slot], '9:00 AM', 'forged'), /no longer available/)
  assert.throws(() => resolveBookingSlot([{ ...slot, start_at: '2030-07-10T09:00:00' }], '9:00 AM'), /could not be verified/)
})

function storage() {
  const data = {}
  Object.defineProperties(data, {
    getItem: { value(key) { return Object.hasOwn(data, key) ? data[key] : null } },
    setItem: { value(key, value) { data[key] = String(value) } },
    removeItem: { value(key) { delete data[key] } },
  })
  return data
}

const lockManagers = new WeakMap()
function locksFor(localStorage) {
  if (!lockManagers.has(localStorage)) {
    const tails = new Map()
    lockManagers.set(localStorage, {
      request(name, options, callback) {
        const next = (tails.get(name) || Promise.resolve()).catch(() => {}).then(() => {
          if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')
          return callback()
        })
        tails.set(name, next)
        return next
      },
    })
  }
  return lockManagers.get(localStorage)
}

function tab(localStorage = storage(), fetch = async () => new Response('{}'), overrides = {}) {
  const events = []
  const window = {
    localStorage,
    sessionStorage: storage(),
    dispatchEvent(event) { events.push(event.type) },
  }
  const shared = {
    window, fetch, Headers, Response, Event, URL, URLSearchParams,
    crypto: webcrypto, console, AbortController, AbortSignal, setTimeout, clearTimeout,
    navigator: { locks: locksFor(localStorage) },
    process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://qarevo.invalid' } },
    ...overrides,
  }
  const core = { exports: {} }
  vm.runInNewContext(storageCode, { ...shared, module: core, exports: core.exports })
  const api = { exports: {} }
  vm.runInNewContext(apiCode, {
    ...shared, module: api, exports: api.exports,
    require(name) {
      if (name === '@/lib/account-storage' || name === './account-storage') return core.exports
      throw new Error('Unexpected import: ' + name)
    },
  })
  return { ...window, events, core: core.exports, api: api.exports }
}

function login(t, id) {
  t.api.storeAuthTokens({
    user_id: id, role: 'PATIENT',
    access_token: 'access-' + id, refresh_token: 'refresh-' + id,
  })
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('legacy personal, health, consent, signup, flow and booking drafts are discarded', () => {
  const t = tab()
  const keys = ['qarevo.onboarding.personal-information.v1', 'qarevo.onboarding.health-profile.v1',
    'qarevo.onboarding.insurance-privacy-consent.v1', 'qarevo.auth.signup.v1',
    'qarevo.auth.flow.v1', 'qarevo_booking_state']
  for (const key of keys) t.localStorage.setItem(key, 'previous patient data')
  t.localStorage.setItem('theme', 'dark')
  login(t, 'A')
  for (const key of keys) assert.equal(t.localStorage.getItem(key), null)
  assert.equal(t.localStorage.getItem('theme'), 'dark')
})

test('same-account draft survives a new reader and token renewal', () => {
  const t = tab()
  login(t, 'A')
  const draft = t.core.createAccountDraftStorage()
  draft.setItem('personal', 'A only')
  t.api.storeAuthTokens({ user_id: 'A', access_token: 'renewed-A', refresh_token: 'renewed-refresh-A' })
  assert.equal(t.core.createAccountDraftStorage().getItem('personal'), 'A only')
})

test('account switch rejects stale reads and writes and clears prior drafts', () => {
  const t = tab()
  login(t, 'A')
  const stale = t.core.createAccountDraftStorage()
  stale.setItem('health', 'A only')
  login(t, 'B')
  assert.equal(stale.getItem('health'), null)
  assert.throws(() => stale.setItem('health', 'stale write'), /session changed/i)
  assert.equal(t.core.createAccountDraftStorage().getItem('health'), null)
  assert.equal(Object.keys(t.sessionStorage).length, 0)
})

test('drafts are tab-specific and another tab cannot adopt the new identity', () => {
  const first = tab()
  login(first, 'A')
  first.core.createAccountDraftStorage().setItem('health', 'first tab only')
  const second = tab(first.localStorage)
  const stale = second.core.createAccountDraftStorage()
  assert.equal(stale.getItem('health'), null)
  stale.setItem('health', 'second tab A')
  login(first, 'B')
  assert.throws(() => second.core.assertCurrentAccount(), /another tab/i)
  assert.equal(stale.getItem('health'), null)
  assert.throws(() => stale.setItem('health', 'stale second tab'), /session changed/i)
  assert.throws(() => second.api.readAccessToken(), /another tab/i)
})

test('logout clears private state and anonymous writes fail', () => {
  const t = tab()
  login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'A only')
  t.sessionStorage.setItem('qarevo.auth.signup.v1', '{"email":"test@example.invalid"}')
  t.api.clearAuthTokens()
  assert.equal(Object.keys(t.sessionStorage).length, 0)
  assert.equal(t.localStorage.getItem('qarevo_access_token'), null)
  assert.throws(() => t.core.createAccountDraftStorage().setItem('health', 'anonymous'), /session changed/i)
})

test('a later login of the same account does not revive an old draft writer', () => {
  const t = tab()
  login(t, 'A')
  const stale = t.core.createAccountDraftStorage()
  t.api.clearAuthTokens()
  login(t, 'A')
  assert.throws(() => stale.setItem('health', 'old session'), /session changed/i)
})

test('late success response cannot cross an account change', async () => {
  const response = deferred()
  const t = tab(undefined, () => response.promise)
  login(t, 'A')
  const request = t.api.apiGet('/private')
  login(t, 'B')
  response.resolve(new Response('{"patient":"A"}'))
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readAccessToken(), 'access-B')
})

test('late JSON body cannot cross an account change', async () => {
  const body = deferred()
  const reading = deferred()
  const response = new Response('{}')
  response.json = () => { reading.resolve(); return body.promise }
  const t = tab(undefined, async () => response)
  login(t, 'A')
  const request = t.api.apiGet('/private')
  await reading.promise
  login(t, 'B')
  body.resolve({ patient: 'A' })
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readAccessToken(), 'access-B')
})

test('late error body cannot expire a newer account', async () => {
  const body = deferred()
  const reading = deferred()
  const response = new Response('', { status: 401 })
  response.text = () => { reading.resolve(); return body.promise }
  const t = tab(undefined, async () => response)
  login(t, 'A')
  const request = t.api.apiPost('/api/v1/auth/login', {})
  await reading.promise
  login(t, 'B')
  body.resolve('{"detail":"Invalid credentials"}')
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readAccessToken(), 'access-B')
})

test('late refresh cannot restore the old account', async () => {
  const response = deferred()
  const refreshing = deferred()
  let count = 0
  const t = tab(undefined, async () => {
    if (++count === 1) return new Response('{}', { status: 401 })
    refreshing.resolve()
    return response.promise
  })
  login(t, 'A')
  const request = t.api.apiGet('/private')
  await refreshing.promise
  login(t, 'B')
  response.resolve(new Response(JSON.stringify({
    user_id: 'A', access_token: 'late-A', refresh_token: 'late-refresh-A',
  })))
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readAccessToken(), 'access-B')
})

test('late logout cannot clear a newer account', async () => {
  const response = deferred()
  const t = tab(undefined, () => response.promise)
  login(t, 'A')
  const request = t.api.logoutCurrentUser()
  assert.equal(t.api.readAccessToken(), null)
  login(t, 'B')
  response.resolve(new Response('{}'))
  await request
  assert.equal(t.api.readAccessToken(), 'access-B')
})

test('retry uses the renewed access token and keeps the account draft', async () => {
  let count = 0
  const t = tab(undefined, async (url, init) => {
    count++
    if (count === 1) return new Response('{}', { status: 401 })
    if (count === 2) return new Response(JSON.stringify({
      user_id: 'A', access_token: 'renewed-A', refresh_token: 'renewed-refresh-A',
    }))
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer renewed-A')
    return new Response('{"ok":true}')
  })
  login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'keep me')
  assert.equal((await t.api.apiGet('/private')).ok, true)
  assert.equal(count, 3)
  assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep me')
})

test('login failures and explicit temporary credentials do not trigger session refresh', async () => {
  let count = 0
  const t = tab(undefined, async () => { count++; return new Response('{}', { status: 401 }) })
  login(t, 'A')
  await assert.rejects(t.api.apiPost('/api/v1/auth/login', {}), error => error.status === 401)
  await assert.rejects(t.api.apiPost('/private', {}, { Authorization: 'Bearer temporary' }), error => error.status === 401)
  assert.equal(count, 2)
  assert.equal(t.api.readAccessToken(), 'access-A')
})

const renewed = () => new Response(JSON.stringify({
  user_id: 'A', access_token: 'renewed-A', refresh_token: 'renewed-refresh-A',
}))

test('parallel reads and writes share one rotation and retry with unchanged method/body', async () => {
  let rotations = 0
  const retries = []
  const t = tab(undefined, async (url, init) => {
    if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }
    if (new Headers(init.headers).get('Authorization') === 'Bearer access-A') return new Response('', { status: 401 })
    retries.push({ method: init.method || 'GET', body: init.body })
    return new Response('{"ok":true}')
  })
  login(t, 'A')
  await Promise.all([t.api.apiGet('/private'), t.api.apiPost('/private', { draft: 'keep' }), t.api.apiGet('/private')])
  assert.equal(rotations, 1)
  assert.equal(retries.length, 3)
  assert.deepEqual(retries.find(item => item.method === 'POST'), { method: 'POST', body: '{"draft":"keep"}' })
})

test('two tabs serialize a single-use token and retain each tab draft', async () => {
  let rotations = 0
  const fetch = async (url, init) => {
    if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }
    return new Response('{"ok":true}', { status: new Headers(init.headers).get('Authorization') === 'Bearer renewed-A' ? 200 : 401 })
  }
  const first = tab(undefined, fetch)
  login(first, 'A')
  const second = tab(first.localStorage, fetch)
  first.core.createAccountDraftStorage().setItem('health', 'first')
  second.core.createAccountDraftStorage().setItem('health', 'second')
  await Promise.all([first.api.apiGet('/private'), second.api.apiGet('/private')])
  assert.equal(rotations, 1)
  assert.equal(first.core.createAccountDraftStorage().getItem('health'), 'first')
  assert.equal(second.core.createAccountDraftStorage().getItem('health'), 'second')
})

test('a delayed 401 uses an already-renewed token without rotating again', async () => {
  const late = deferred()
  let rotations = 0
  const t = tab(undefined, async (url, init) => {
    if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }
    if (new Headers(init.headers).get('Authorization') === 'Bearer renewed-A') return new Response('{}')
    if (url.endsWith('/late')) return late.promise
    return new Response('', { status: 401 })
  })
  login(t, 'A')
  const delayedRequest = t.api.apiGet('/late')
  await t.api.apiGet('/private')
  late.resolve(new Response('', { status: 401 }))
  await delayedRequest
  assert.equal(rotations, 1)
})

for (const failure of ['network', 429, 500, 503, 422]) {
  test(`refresh ${failure} preserves session and drafts, backs off across tabs, and can recover`, async () => {
    let rotations = 0
    let now = Date.now()
    class Clock extends Date { static now() { return now } }
    const fetch = async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        if (++rotations > 1) return renewed()
        if (failure === 'network') throw new TypeError('Offline')
        return new Response('{}', { status: failure, headers: { 'Retry-After': '10' } })
      }
      return new Response('{}', { status: new Headers(init.headers).get('Authorization') === 'Bearer renewed-A' ? 200 : 401 })
    }
    const t = tab(undefined, fetch, { Date: Clock })
    login(t, 'A')
    const second = tab(t.localStorage, fetch, { Date: Clock })
    t.core.createAccountDraftStorage().setItem('health', 'keep')
    const temporary = error => error.name === 'SessionRefreshError' && !t.api.isAuthError(error)
    await assert.rejects(t.api.apiGet('/private'), temporary)
    await assert.rejects(second.api.apiGet('/private'), temporary)
    assert.equal(rotations, 1)
    assert.equal(t.api.readRefreshToken(), 'refresh-A')
    assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep')
    assert.equal(t.events.includes('qarevo:auth-session-expired'), false)
    now += 11_000
    await t.api.apiGet('/private')
    assert.equal(rotations, 2)
    assert.equal(t.api.readRefreshToken(), 'renewed-refresh-A')
    assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep')
  })
}

for (const status of [401, 403]) {
  test(`definitive refresh rejection ${status} clears credentials and drafts`, async () => {
    const t = tab(undefined, async url => new Response('{}', { status: url.endsWith('/auth/refresh') ? status : 401 }))
    login(t, 'A')
    t.core.createAccountDraftStorage().setItem('health', 'clear on expiry')
    await assert.rejects(t.api.apiGet('/private'))
    assert.equal(t.api.readAccessToken(), null)
    assert.equal(t.api.readRefreshToken(), null)
    assert.equal(Object.keys(t.sessionStorage).length, 0)
    assert.equal(t.events.filter(event => event === 'qarevo:auth-session-expired').length, 1)
  })
}

for (const body of ['not JSON', '{}', '{"access_token":"new","refresh_token":" "}', '{"access_token":"new","refresh_token":"new-r","user_id":"B"}']) {
  test(`invalid refresh payload cannot corrupt credentials: ${body}`, async () => {
    const t = tab(undefined, async url => url.endsWith('/auth/refresh') ? new Response(body) : new Response('', { status: 401 }))
    login(t, 'A')
    await assert.rejects(t.api.apiGet('/private'), error => error.name === 'SessionRefreshError')
    assert.equal(t.api.readAccessToken(), 'access-A')
    assert.equal(t.api.readRefreshToken(), 'refresh-A')
  })
}

test('a renewal timeout preserves the session and releases the in-flight request', async () => {
  const started = deferred()
  let timeout
  const t = tab(undefined, async (url, init) => {
    if (!url.endsWith('/auth/refresh')) return new Response('', { status: 401 })
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      started.resolve()
    })
  }, { setTimeout(callback) { timeout = callback; return 1 }, clearTimeout() {} })
  login(t, 'A')
  const request = t.api.apiGet('/private')
  const rejection = assert.rejects(request, error => error.name === 'SessionRefreshError')
  await started.promise
  timeout()
  await rejection
  assert.equal(t.api.readRefreshToken(), 'refresh-A')
  await assert.rejects(t.api.apiGet('/private'), error => error.name === 'SessionRefreshError')
})

test('unsupported lock coordination fails safely without sending a rotating token', async () => {
  let requests = 0
  const t = tab(undefined, async () => { requests++; return new Response('', { status: 401 }) }, { navigator: {} })
  login(t, 'A')
  await assert.rejects(t.api.apiGet('/private'), /current browser/i)
  assert.equal(requests, 1)
  assert.equal(t.api.readRefreshToken(), 'refresh-A')
})

test('a protected request retries only once even if the renewed token is rejected', async () => {
  let requests = 0
  let rotations = 0
  const t = tab(undefined, async url => {
    if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }
    requests++
    return new Response('', { status: 401 })
  })
  login(t, 'A')
  await assert.rejects(t.api.apiGet('/private'), error => t.api.isAuthError(error))
  assert.equal(rotations, 1)
  assert.equal(requests, 2)
})

test('network failure during logout still removes credentials and drafts', async () => {
  let posted
  const t = tab(undefined, async (url, init) => { posted = JSON.parse(init.body); throw new Error('Offline') })
  login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'Private')
  await assert.rejects(t.api.logoutCurrentUser(), /Offline/)
  assert.equal(posted.refresh_token, 'refresh-A')
  assert.equal(t.api.readAccessToken(), null)
  assert.equal(t.api.readRefreshToken(), null)
  assert.equal(Object.keys(t.sessionStorage).length, 0)
})

function hydration() {
  const mod = { exports: {} }
  vm.runInNewContext(compile('hydrate-account-draft.ts'), { module: mod, exports: mod.exports })
  return mod.exports.hydrateAccountDraft
}
const settled = () => new Promise(resolve => setImmediate(resolve))

test('saved server profile is restored when no tab draft exists', async () => {
  let result, ready = false
  hydration()({ getItem: () => null }, 'profile', async () => ({ name: 'Saved Patient' }), data => { result = data }, error => { throw error }, () => { ready = true })
  await settled()
  assert.equal(result.name, 'Saved Patient')
  assert.equal(ready, true)
})

test('unsaved tab draft takes precedence over server profile', async () => {
  let result, calls = 0
  hydration()({ getItem: () => '{"name":"Unsaved Patient"}' }, 'profile', async () => { calls++; return {} }, data => { result = data }, error => { throw error }, () => {})
  await settled()
  assert.equal(calls, 0)
  assert.equal(result.name, 'Unsaved Patient')
})

test('cancelled hydration cannot overwrite a different screen or account', async () => {
  const pending = deferred()
  let applied = false, ready = false
  const stop = hydration()({ getItem: () => null }, 'profile', () => pending.promise, () => { applied = true }, error => { throw error }, () => { ready = true })
  stop()
  pending.resolve({ name: 'Old Patient' })
  await settled()
  assert.equal(applied, false)
  assert.equal(ready, false)
})

test('malformed and non-object drafts fall back to saved server data', async () => {
  for (const raw of ['invalid JSON', 'true', '[]', 'null']) {
    let result
    hydration()({ getItem: () => raw }, 'profile', async () => ({ name: 'Saved Patient' }), data => { result = data }, error => { throw error }, () => {})
    await settled()
    assert.equal(result.name, 'Saved Patient')
  }
})

function videoHarness({ holdMicrophone = null, failMicrophone = false } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile('video-connection.ts'), { module, exports: module.exports, Promise, Set, Error })
  let markMicrophoneStarted
  const microphoneStarted = new Promise(resolve => { markMicrophoneStarted = resolve })
  const calls = []
  const events = []
  let observer, presence
  const av = {
    addObserver(value) { observer = value }, removeObserver() { calls.push('remove-observer') },
    realtimeSubscribeToAttendeeIdPresence(value) { presence = value },
    realtimeUnsubscribeToAttendeeIdPresence() { calls.push('unsubscribe') },
    async bindAudioElement() {}, unbindAudioElement() { calls.push('unbind-audio') },
    start() { calls.push('start'); observer.audioVideoDidStart() }, stop() { calls.push('stop') },
    startLocalVideoTile() { calls.push('camera-start') }, stopLocalVideoTile() { calls.push('camera-stop') },
    bindVideoElement() {}, realtimeMuteLocalAudio() { calls.push('mute') }, realtimeUnmuteLocalAudio() { return true },
  }
  class Devices {
    async listAudioInputDevices() { return [{ deviceId: 'synthetic-mic' }] }
    async listVideoInputDevices() { return [{ deviceId: 'synthetic-camera' }] }
    async startAudioInput() { calls.push('microphone-start'); markMicrophoneStarted(); await holdMicrophone; if (failMicrophone) throw new Error('Permission denied') }
    async stopAudioInput() { calls.push('microphone-stop') }
    async startVideoInput() { calls.push('video-input-start') }
    async stopVideoInput() { calls.push('video-input-stop') }
    async destroy() { calls.push('devices-destroy') }
  }
  const sdk = {
    NoOpLogger: class {}, DefaultDeviceController: Devices, MeetingSessionConfiguration: class {},
    DefaultMeetingSession: class { audioVideo = av; async destroy() { calls.push('session-destroy') } },
    MeetingSessionStatusCode: { MeetingEnded: 5 },
  }
  return {
    calls, events, microphoneStarted, get observer() { return observer }, get presence() { return presence },
    create: () => module.exports.createVideoConnection({ meeting_id: 'synthetic', attendee_id: 'local', join_token: 'never-persist', media_placement: {} }, {}, {
      state: (...args) => events.push(['state', ...args]), tile: value => events.push(['tile', value]), removeTile: value => events.push(['remove', value]), participants: value => events.push(['participants', value]), warning: value => events.push(['warning', value]),
    }, async () => sdk),
  }
}

test('video connects from SDK events and releases devices on leave without ending clinical care', async () => {
  const harness = videoHarness()
  const connection = await harness.create()
  await connection.start(true)
  assert.ok(harness.events.some(event => event[0] === 'state' && event[1] === 'connected'))
  harness.presence('local', true)
  harness.presence('other', true)
  harness.presence('other', true)
  assert.deepEqual(harness.events.filter(event => event[0] === 'participants'), [['participants', 1], ['participants', 1]])
  await connection.setCamera(false)
  connection.setMicrophone(false)
  await connection.stop(); await connection.stop()
  assert.ok(harness.calls.includes('microphone-stop'))
  assert.ok(harness.calls.includes('video-input-stop'))
  assert.equal(harness.calls.filter(call => call === 'session-destroy').length, 1)
  const count = harness.events.length
  harness.observer.audioVideoDidStart()
  harness.presence('stale', true)
  assert.equal(harness.events.length, count)
})

test('leaving while microphone permission is pending cannot start a late connection', async () => {
  let release
  const holdMicrophone = new Promise(resolve => { release = resolve })
  const harness = videoHarness({ holdMicrophone })
  const connection = await harness.create()
  const starting = connection.start(false)
  await harness.microphoneStarted
  assert.ok(harness.calls.includes('microphone-start'))
  await connection.stop()
  release()
  await starting
  assert.ok(!harness.calls.includes('start'))
  assert.ok(harness.calls.filter(call => call === 'microphone-stop').length >= 2)
})

test('denied microphone access cleans up the session without claiming connection success', async () => {
  const harness = videoHarness({ failMicrophone: true })
  const connection = await harness.create()
  await assert.rejects(connection.start(false), /Permission denied/)
  assert.ok(!harness.calls.includes('start'))
  assert.ok(harness.calls.includes('devices-destroy'))
})

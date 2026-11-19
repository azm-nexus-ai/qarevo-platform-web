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
class BrowserCustomEvent extends Event {
  constructor(name, options = {}) { super(name); this.detail = options.detail }
}
function tab(localStorage = storage(), fetchImpl = async () => new Response('{}'), overrides = {}) {
  const events = []
  const eventListeners = new Map()
  const window = {
    localStorage,
    sessionStorage: storage(),
    location: { origin: 'https://web.qarevo.example', hostname: 'web.qarevo.example', pathname: '/patient/dashboard' },
    dispatchEvent(event) { events.push(event.type); for (const listener of eventListeners.get(event.type) || []) listener(event) },
    addEventListener(name, listener) { if (!eventListeners.has(name)) eventListeners.set(name, new Set()); eventListeners.get(name).add(listener) },
    removeEventListener(name, listener) { eventListeners.get(name)?.delete(listener) },
  }
  const fetch = async (url, init) => {
    if (new URL(url).pathname === '/api/v1/browser-csrf') return Response.json({ csrf_token: 'synthetic-csrf-check' })
    return fetchImpl(url, init)
  }
  const shared = {
    window, fetch, Headers, Response, Event, CustomEvent: BrowserCustomEvent, URL, URLSearchParams,
    crypto: webcrypto, console, AbortController, AbortSignal, setTimeout, clearTimeout,
    navigator: { locks: locksFor(localStorage) },
    process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://qarevo.invalid' } },
    ...overrides,
  }
  const portal = { exports: {} }
  vm.runInNewContext(compile('portal-scope.ts'), { ...shared, module: portal, exports: portal.exports })
  const core = { exports: {} }
  vm.runInNewContext(storageCode, {
    ...shared, module: core, exports: core.exports,
    require(name) { if (name === './portal-scope') return portal.exports; throw new Error('Unexpected import: ' + name) },
  })
  const profile = { exports: {} }
  vm.runInNewContext(compile('profile-events.ts'), { ...shared, module: profile, exports: profile.exports })
  const conditional = { exports: {} }
  vm.runInNewContext(compile('clinical-write-version.ts'), { ...shared, module: conditional, exports: conditional.exports })
  const api = { exports: {} }
  vm.runInNewContext(apiCode, {
    ...shared, module: api, exports: api.exports,
    require(name) {
      if (name === '@/lib/account-storage' || name === './account-storage') return core.exports
      if (name === '@/lib/portal-scope' || name === './portal-scope') return portal.exports
      if (name === '@/lib/profile-events') return profile.exports
      if (name === './clinical-write-version') return conditional.exports
      throw new Error('Unexpected import: ' + name)
    },
  })
  return { ...window, events, core: core.exports, portal: portal.exports, profile: profile.exports, api: api.exports }
}
const roles = { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN' }
function identity(id = 'A', portal = 'patient', session = `session-${id}`) {
  return { user_id: id, role: roles[portal], session_id: session, provider_id: portal === 'doctor' ? `profile-${id}` : null }
}
function login(t, id, { portal = t.portal.currentPortal(), session = `session-${id}` } = {}) {
  const current = identity(id, portal, session)
  t.api.storeBrowserSession({ browser_session: current }, portal)
  return current
}
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const renewed = (id = 'A', portal = 'patient', session = `session-${id}`) => Response.json({ browser_session: identity(id, portal, session) })

// Credentials are represented exclusively by server-owned closure state in these
// tests. JavaScript sees only the stable, non-secret session marker.
function cookieServer({ firstFailure = null } = {}) {
  let rotated = false, rotations = 0
  return {
    get rotations() { return rotations },
    get rotated() { return rotated },
    async fetch(url, init) {
      const headers = new Headers(init.headers)
      assert.equal(headers.get('Authorization'), null)
      assert.equal(headers.get('X-Qarevo-Refresh-Token'), null)
      assert.equal(init.credentials, 'same-origin')
      if (url.endsWith('/auth/refresh')) {
        assert.deepEqual(JSON.parse(init.body), {})
        if (++rotations === 1 && firstFailure) return firstFailure()
        rotated = true
        return renewed()
      }
      return Response.json({ ok: true }, { status: rotated ? 200 : 401 })
    },
  }
}

test('legacy personal, health, consent, signup, flow and booking drafts are discarded', () => {
  const t = tab()
  const keys = ['qarevo.onboarding.personal-information.v1', 'qarevo.onboarding.health-profile.v1',
    'qarevo.onboarding.insurance-privacy-consent.v1', 'qarevo.auth.signup.v1', 'qarevo.auth.flow.v1', 'qarevo_booking_state']
  for (const key of keys) t.localStorage.setItem(key, 'previous patient data')
  t.localStorage.setItem('qarevo:patient:theme', 'dark')
  for (const key of ['qarevo_access_token', 'qarevo_refresh_token', 'doctor_temp_token']) {
    t.localStorage.setItem(key, 'retired-secret'); t.sessionStorage.setItem(key, 'retired-secret')
  }
  login(t, 'A')
  for (const key of keys) assert.equal(t.localStorage.getItem(key), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:theme'), 'dark')
  assert.doesNotMatch(JSON.stringify([t.localStorage, t.sessionStorage]), /retired-secret/)
})

function signupContext(t, clock = Date) {
  const mod = { exports: {} }
  vm.runInNewContext(compile('signup-context.ts'), {
    module: mod, exports: mod.exports, window: t, Date: clock,
    require(name) { if (name === './portal-scope') return t.portal; throw new Error('Unexpected signup import: ' + name) },
  })
  return mod.exports
}

test('active verification email survives legacy draft cleanup and stays isolated to its portal and tab', () => {
  const t = tab(), signup = signupContext(t)
  signup.storeSignupEmail('NEW@example.test')
  signup.storeSignupEmail('clinician@example.test', 'doctor')
  t.sessionStorage.setItem('qarevo.auth.signup.v1', '{"email":"previous@example.test"}')
  t.core.createAccountDraftStorage().getItem('booking')
  assert.equal(signup.readSignupEmail(), 'new@example.test')
  assert.equal(t.sessionStorage.getItem('qarevo.auth.signup.v1'), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:signup:v2'), null)
  const second = tab(t.localStorage)
  assert.equal(signupContext(second).readSignupEmail(), '')
  t.api.clearPortalSession('doctor')
  assert.equal(signup.readSignupEmail('doctor'), '')
  assert.equal(signup.readSignupEmail('patient'), 'new@example.test')
  login(t, 'A')
  assert.equal(signup.readSignupEmail(), '', 'successful authentication retires the unverified destination')
})

test('verification email context expires and rejects malformed or overlong storage values', () => {
  let now = Date.now()
  class Clock extends Date { static now() { return now } }
  const t = tab(), signup = signupContext(t, Clock)
  signup.storeSignupEmail('new@example.test')
  now += 30 * 60 * 1000 + 1
  assert.equal(signup.readSignupEmail(), '')
  assert.equal(t.sessionStorage.getItem('qarevo:patient:signup:v2'), null)
  for (const value of ['not JSON', '{"email":true}', JSON.stringify({ email: 'a'.repeat(255) + '@example.test', expires_at: now + 60_000 })]) {
    t.sessionStorage.setItem('qarevo:patient:signup:v2', value)
    assert.equal(signup.readSignupEmail(), '')
  }
  assert.throws(() => signup.storeSignupEmail('not an email'), /valid verification email/)
})

test('browser stores only role-scoped identity metadata and never API credentials', () => {
  const t = tab()
  const meta = identity()
  t.api.storeBrowserSession({ browser_session: meta, access_token: 'must-not-store-access', refresh_token: 'must-not-store-refresh', temp_token: 'must-not-store-mfa' })
  assert.equal(t.api.readSessionMarker(), 'session-A')
  assert.deepEqual(JSON.parse(t.localStorage.getItem('qarevo:patient:identity')), meta)
  assert.doesNotMatch(JSON.stringify([t.localStorage, t.sessionStorage]), /must-not-store/)
  assert.throws(() => t.api.storeBrowserSession({ access_token: 'legacy-only' }), /secure session/)
})

test('same-account draft survives a new reader and cookie renewal with a stable marker', () => {
  const t = tab(); login(t, 'A')
  t.core.createAccountDraftStorage().setItem('personal', 'A only')
  t.api.storeBrowserSession({ browser_session: identity() })
  assert.equal(t.core.createAccountDraftStorage().getItem('personal'), 'A only')
})

test('account switch rejects stale reads and writes and clears prior drafts', () => {
  const t = tab(); login(t, 'A')
  const stale = t.core.createAccountDraftStorage(); stale.setItem('health', 'A only')
  login(t, 'B')
  assert.equal(stale.getItem('health'), null)
  assert.throws(() => stale.setItem('health', 'stale write'), /session changed/i)
  assert.equal(t.core.createAccountDraftStorage().getItem('health'), null)
  assert.equal(Object.keys(t.sessionStorage).length, 0)
})

test('drafts are tab-specific and a stale tab cannot adopt a changed identity', () => {
  const first = tab(); login(first, 'A')
  first.core.createAccountDraftStorage().setItem('health', 'first tab only')
  const second = tab(first.localStorage)
  const stale = second.core.createAccountDraftStorage()
  assert.equal(stale.getItem('health'), null)
  stale.setItem('health', 'second tab A')
  second.core.assertCurrentAccount()
  login(first, 'B')
  assert.throws(() => second.core.assertCurrentAccount(), /another tab/i)
  assert.equal(stale.getItem('health'), null)
  assert.throws(() => stale.setItem('health', 'stale second tab'), /session changed/i)
  assert.throws(() => second.api.readSessionMarker(), /another tab/i)
})

test('logout clears this portal private state and anonymous writes fail', () => {
  const t = tab(); login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'A only')
  t.sessionStorage.setItem('qarevo.auth.signup.v1', '{"email":"synthetic@example.test"}')
  t.api.clearPortalSession()
  assert.equal(Object.keys(t.sessionStorage).length, 0)
  assert.equal(t.localStorage.getItem('qarevo:patient:identity'), null)
  assert.throws(() => t.core.createAccountDraftStorage().setItem('health', 'anonymous'), /session changed/i)
})

test('a new session of the same account cannot revive an old draft writer', () => {
  const t = tab(); login(t, 'A')
  const stale = t.core.createAccountDraftStorage()
  t.api.clearPortalSession(); login(t, 'A', { session: 'new-family-A' })
  assert.throws(() => stale.setItem('health', 'old session'), /session changed/i)
})

test('patient, doctor and admin identities, drafts and logout remain independent', () => {
  const local = storage(), patient = tab(local), doctor = tab(local), admin = tab(local)
  doctor.location.pathname = '/doctor/workspace'; admin.location.pathname = '/admin/dashboard'
  login(patient, 'P'); login(doctor, 'D'); login(admin, 'O')
  patient.core.createAccountDraftStorage().setItem('draft', 'patient private')
  doctor.core.createAccountDraftStorage().setItem('draft', 'doctor private')
  admin.core.createAccountDraftStorage().setItem('draft', 'admin private')
  for (const portal of ['patient', 'doctor', 'admin']) local.setItem(`qarevo:${portal}:theme`, portal === 'doctor' ? 'light' : 'dark')
  patient.api.clearPortalSession()
  assert.equal(patient.api.readSessionMarker(), null)
  assert.equal(doctor.api.readSessionMarker(), 'session-D')
  assert.equal(admin.api.readSessionMarker(), 'session-O')
  assert.equal(doctor.core.createAccountDraftStorage().getItem('draft'), 'doctor private')
  assert.equal(admin.core.createAccountDraftStorage().getItem('draft'), 'admin private')
  assert.equal(local.getItem('qarevo:doctor:theme'), 'light')
  assert.equal(local.getItem('qarevo:patient:theme'), 'dark')
})

test('late success response cannot cross an account change', async () => {
  const response = deferred(); const t = tab(undefined, () => response.promise); login(t, 'A')
  const request = t.api.apiGet('/private'); login(t, 'B')
  response.resolve(Response.json({ patient: 'A' }))
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('late success body cannot cross an account change after headers are accepted', async () => {
  const body = deferred(), reading = deferred(), response = new Response('{}')
  response.text = () => { reading.resolve(); return body.promise }
  const t = tab(undefined, async () => response); login(t, 'A')
  const request = t.api.apiGet('/private'); await reading.promise; login(t, 'B')
  body.resolve('{"patient":"A"}')
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('late error body cannot expire a newer account', async () => {
  const body = deferred(), reading = deferred(), response = new Response('', { status: 401 })
  response.text = () => { reading.resolve(); return body.promise }
  const t = tab(undefined, async () => response); login(t, 'A')
  const request = t.api.apiPost('/api/v1/auth/login', {}); await reading.promise; login(t, 'B')
  body.resolve('{"detail":"Invalid credentials"}')
  await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('late refresh response cannot restore an older account', async () => {
  const response = deferred(), refreshing = deferred()
  const t = tab(undefined, async url => { if (!url.endsWith('/auth/refresh')) return new Response('{}', { status: 401 }); refreshing.resolve(); return response.promise })
  login(t, 'A'); const request = t.api.apiGet('/private'); await refreshing.promise; login(t, 'B')
  response.resolve(renewed()); await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('late refresh JSON body cannot restore an older account', async () => {
  const body = deferred(), reading = deferred(), response = new Response('{}')
  response.json = () => { reading.resolve(); return body.promise }
  const t = tab(undefined, async url => url.endsWith('/auth/refresh') ? response : new Response('{}', { status: 401 }))
  login(t, 'A'); const request = t.api.apiGet('/private'); await reading.promise; login(t, 'B')
  body.resolve({ browser_session: identity() }); await assert.rejects(request, /session changed/i)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('cookie-arrival race: a delayed A refresh completes before queued B login can issue its cookies', async () => {
  const release = deferred(), refreshing = deferred()
  const cookieJar = { owner: 'A', renewed: false }
  let loginStarted = false
  const fetch = async (url, init) => {
    const marker = new Headers(init.headers).get('X-Qarevo-Session')
    if (url.endsWith('/auth/refresh')) {
      refreshing.resolve(); await release.promise
      // Model browser Set-Cookie processing before JavaScript receives headers.
      cookieJar.owner = 'A'; cookieJar.renewed = true
      return renewed()
    }
    if (url.endsWith('/auth/login')) {
      loginStarted = true; cookieJar.owner = 'B'
      return Response.json({ browser_session: identity('B') }, { headers: { 'X-Qarevo-Session-Id': 'session-B' } })
    }
    if (marker !== `session-${cookieJar.owner}`) return Response.json({ detail: { error_code: 'SESSION_CHANGED' } }, { status: 409 })
    return Response.json({ patient: cookieJar.owner }, { status: cookieJar.renewed ? 200 : 401, headers: { 'X-Qarevo-Session-Id': `session-${cookieJar.owner}` } })
  }
  const first = tab(undefined, fetch); login(first, 'A')
  const second = tab(first.localStorage, fetch)
  const previousRequest = first.api.apiGet('/private').then(() => null, error => error)
  await refreshing.promise
  const signIn = second.api.loginPatient({ email: 'synthetic-b@example.test', password: 'test-only' })
  try {
    await settled()
    assert.equal(loginStarted, false, 'new sign-in must share the portal cookie-mutation lock')
  } finally { release.resolve() }
  await signIn
  const previousFailure = await previousRequest
  if (previousFailure) assert.match(previousFailure.message, /session changed|another tab/i)
  assert.equal(cookieJar.owner, 'B')
  assert.equal(second.api.readSessionMarker(), 'session-B', 'new metadata must be committed before releasing the lock')
})

for (const path of ['/api/v1/security/password', '/api/v1/security/sessions/revoke-all']) {
  test(`credential mutation ${path} can renew expired access without re-entering its own WebLock`, async () => {
    let held = false, entries = 0
    const locks = { async request(name, options, callback) {
      assert.equal(held, false, 'Web Locks are not re-entrant; renewal must reuse the held portal lock')
      assert.equal(name, 'qarevo:patient:session-refresh')
      entries++; held = true
      try { return await callback() } finally { held = false }
    } }
    const server = cookieServer()
    const t = tab(undefined, server.fetch, { navigator: { locks } })
    login(t, 'A')
    assert.equal((await t.api.apiPost(path, { synthetic: true })).ok, true)
    assert.equal(server.rotations, 1)
    assert.equal(entries, 1)
    assert.equal(t.api.readSessionMarker(), null, 'successful security change ends only this portal session')
  })
}

test('held security mutation renews without awaiting an external renewal queued behind its own lock', async () => {
  const entered = deferred(), release = deferred()
  let calls = 0, rotations = 0
  const t = tab(undefined, async url => {
    if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }
    if (url.endsWith('/security/password')) {
      if (++calls === 1) { entered.resolve(); await release.promise; return new Response('', { status: 401 }) }
      return Response.json({ ok: true })
    }
    return new Response('', { status: 401 })
  })
  login(t, 'A')
  const mutation = t.api.apiPost('/api/v1/security/password', { synthetic: true })
  await entered.promise
  const external = t.api.apiGet('/private').then(() => null, error => error)
  try { await settled() } finally { release.resolve() }
  assert.equal((await mutation).ok, true)
  assert.equal(rotations, 1)
  const failure = await external
  assert.match(failure.message, /session changed|another tab/i)
  assert.equal(t.api.readSessionMarker(), null)
})

test('queued physician security mutation keeps its captured portal when navigation changes to patient', async () => {
  const entered = deferred(), release = deferred()
  let rotated = false, securityCalls = 0
  const t = tab(undefined, async (url, init) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get('X-Qarevo-Portal'), 'doctor')
    assert.equal(headers.get('X-Qarevo-Session'), 'session-D')
    if (url.endsWith('/auth/refresh')) { entered.resolve(); await release.promise; rotated = true; return renewed('D', 'doctor') }
    if (url.endsWith('/security/password')) { securityCalls++; return Response.json({ ok: true }) }
    return Response.json({ ok: true }, { status: rotated ? 200 : 401 })
  })
  t.location.pathname = '/doctor/workspace'
  login(t, 'D'); login(t, 'P', { portal: 'patient' })
  const oldRead = t.api.apiGet('/api/v1/doctor/workspace').then(() => null, error => error)
  await entered.promise
  const mutation = t.api.apiPost('/api/v1/security/password', { synthetic: true })
  t.location.pathname = '/patient/dashboard'
  release.resolve()
  assert.equal((await mutation).ok, true)
  const oldFailure = await oldRead
  if (oldFailure) assert.match(oldFailure.message, /session changed|another tab/i)
  assert.equal(securityCalls, 1)
  assert.equal(t.api.readSessionMarker(), 'session-P')
  assert.equal(t.localStorage.getItem('qarevo:doctor:identity'), null)
})

test('late logout cannot clear a newer local identity', async () => {
  const response = deferred(), started = deferred()
  const t = tab(undefined, () => { started.resolve(); return response.promise }); login(t, 'A')
  const request = t.api.logoutCurrentUser(); assert.equal(t.api.readSessionMarker(), null)
  await started.promise; login(t, 'B'); response.resolve(Response.json({}))
  await request; assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('logout captures the original portal/session before local listeners navigate', async () => {
  let captured
  const t = tab(undefined, async (url, init) => {
    captured = { url, init }
    assert.equal(new Headers(init.headers).get('X-Qarevo-Portal'), 'patient')
    assert.equal(new Headers(init.headers).get('X-Qarevo-Session'), 'session-A')
    assert.equal(init.keepalive, true)
    assert.deepEqual(JSON.parse(init.body), {})
    return Response.json({})
  })
  login(t, 'A')
  t.addEventListener('qarevo:account-changed', () => { t.location.pathname = '/doctor/workspace' })
  await t.api.logoutCurrentUser()
  assert.ok(captured.url.endsWith('/auth/logout'))
  assert.equal(t.localStorage.getItem('qarevo:patient:identity'), null)
})

test('queued logout hides private state immediately and retains a signed-out tombstone until verified sign-in', async () => {
  const unlock = deferred(), queued = deferred(), posted = deferred(), response = deferred()
  let started = false
  const locks = { async request(name, options, callback) {
    assert.equal(name, 'qarevo:patient:session-refresh')
    queued.resolve(); await unlock.promise; return callback()
  } }
  const t = tab(undefined, async (_url, init) => {
    started = true
    const headers = new Headers(init.headers)
    assert.equal(headers.get('X-Qarevo-Portal'), 'patient')
    assert.equal(headers.get('X-Qarevo-Session'), 'session-A')
    assert.deepEqual(JSON.parse(init.body), {})
    posted.resolve(); return response.promise
  }, { navigator: { locks } })
  login(t, 'A'); login(t, 'D', { portal: 'doctor' })
  const draft = t.core.createAccountDraftStorage(); draft.setItem('health', 'Private before logout')
  const logout = t.api.logoutCurrentUser()
  assert.equal(t.api.readSessionMarker(), null)
  assert.equal(draft.getItem('health'), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'), 'session-A')
  assert.equal(t.localStorage.getItem('qarevo:patient:logout-pending'), 'session-A')
  await queued.promise; assert.equal(started, false)
  t.location.pathname = '/doctor/workspace'
  unlock.resolve(); await posted.promise
  assert.equal(t.localStorage.getItem('qarevo:patient:logout-pending'), 'session-A')
  assert.equal(t.api.readSessionMarker(), 'session-D')
  response.resolve(Response.json({})); await logout
  assert.equal(t.localStorage.getItem('qarevo:patient:logout-pending'), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'), 'session-A')
  assert.equal(t.api.readSessionMarker(), 'session-D')
  t.location.pathname = '/patient/dashboard'
  login(t, 'B')
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'), null)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('failed logout clears the pending state but keeps the signed-out tombstone to refuse cookie bootstrap', async () => {
  const t = tab(undefined, async () => { throw new Error('Synthetic offline logout') })
  login(t, 'A')
  await assert.rejects(t.api.logoutCurrentUser(), /offline logout/)
  assert.equal(t.localStorage.getItem('qarevo:patient:logout-pending'), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'), 'session-A')
  assert.equal(t.api.readSessionMarker(), null)
})

test('a stale A tab cannot adopt and revoke another tab’s newer B session during logout', async () => {
  let requests = 0
  const t = tab(undefined, async () => { requests++; return Response.json({}) })
  login(t, 'A')
  t.core.assertCurrentAccount()
  // Browser storage changes before the stale tab receives its storage event.
  t.localStorage.setItem('qarevo:patient:identity', JSON.stringify(identity('B')))
  await assert.rejects(t.api.logoutCurrentUser(), /another tab|session changed/i)
  assert.equal(requests, 0)
  assert.equal(JSON.parse(t.localStorage.getItem('qarevo:patient:identity')).session_id, 'session-B')
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'), null)
  assert.equal(t.localStorage.getItem('qarevo:patient:logout-pending'), null)
})

test('retry uses refreshed HttpOnly state and preserves a stable marker and account draft', async () => {
  const server = cookieServer(), t = tab(undefined, server.fetch); login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'keep me')
  assert.equal((await t.api.apiGet('/private')).ok, true)
  assert.equal(server.rotations, 1)
  assert.equal(t.api.readSessionMarker(), 'session-A')
  assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep me')
})

test('explicit sign-in failures do not rotate cookies and browser Authorization is stripped', async () => {
  let count = 0
  const t = tab(undefined, async (_url, init) => { count++; assert.equal(new Headers(init.headers).get('Authorization'), null); return new Response('{}', { status: 401 }) })
  login(t, 'A')
  await assert.rejects(t.api.apiPost('/api/v1/auth/login', {}, { Authorization: 'Bearer must-strip' }), error => error.status === 401)
  assert.equal(count, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
})

test('an explicit new sign-in may establish a different verified session without accepting a late old response', async () => {
  const t = tab(undefined, async () => Response.json({ browser_session: identity('B') }, { headers: { 'X-Qarevo-Session-Id': 'session-B' } }))
  login(t, 'A')
  const result = await t.api.loginPatient({ email: 'synthetic-b@example.test', password: 'test-only' })
  t.api.storeBrowserSession(result)
  assert.equal(t.api.readSessionMarker(), 'session-B')
})

test('parallel reads and writes share one cookie rotation and retain unchanged method/body', async () => {
  let rotated = false, rotations = 0
  const retries = []
  const t = tab(undefined, async (url, init) => {
    if (url.endsWith('/auth/refresh')) { rotations++; rotated = true; return renewed() }
    if (!rotated) return new Response('', { status: 401 })
    retries.push({ method: init.method || 'GET', body: init.body }); return Response.json({ ok: true })
  })
  login(t, 'A')
  await Promise.all([t.api.apiGet('/private'), t.api.apiPost('/private', { draft: 'keep' }), t.api.apiGet('/private')])
  assert.equal(rotations, 1); assert.equal(retries.length, 3)
  assert.deepEqual(retries.find(item => item.method === 'POST'), { method: 'POST', body: '{"draft":"keep"}' })
})

test('two tabs serialize one cookie rotation and retain each tab draft', async () => {
  const server = cookieServer(), first = tab(undefined, server.fetch); login(first, 'A')
  const second = tab(first.localStorage, server.fetch)
  first.core.createAccountDraftStorage().setItem('health', 'first'); second.core.createAccountDraftStorage().setItem('health', 'second')
  await Promise.all([first.api.apiGet('/private'), second.api.apiGet('/private')])
  assert.equal(server.rotations, 1)
  assert.equal(first.core.createAccountDraftStorage().getItem('health'), 'first')
  assert.equal(second.core.createAccountDraftStorage().getItem('health'), 'second')
})

test('a pending physician renewal cannot block patient renewal or overwrite another portal', async () => {
  const local = storage(), hold = deferred(), doctorStarted = deferred()
  const renewedPortals = new Set(), rotations = { patient: 0, doctor: 0 }
  const fetch = async (url, init) => {
    const portal = new Headers(init.headers).get('X-Qarevo-Portal')
    if (url.endsWith('/auth/refresh')) {
      rotations[portal]++
      if (portal === 'doctor') { doctorStarted.resolve(); await hold.promise }
      renewedPortals.add(portal)
      return renewed(portal === 'doctor' ? 'D' : 'P', portal)
    }
    return Response.json({ ok: true }, { status: renewedPortals.has(portal) ? 200 : 401 })
  }
  const patient = tab(local, fetch), doctor = tab(local, fetch)
  doctor.location.pathname = '/doctor/workspace'
  login(patient, 'P'); login(doctor, 'D')
  const pendingDoctor = doctor.api.apiGet('/api/v1/doctor/workspace')
  await doctorStarted.promise
  assert.equal((await patient.api.apiGet('/api/v1/patient/dashboard')).ok, true)
  assert.equal(patient.api.readSessionMarker(), 'session-P')
  assert.equal(doctor.api.readSessionMarker(), 'session-D')
  hold.resolve(); await pendingDoctor
  assert.deepEqual(rotations, { patient: 1, doctor: 1 })
})

test('request headers cannot override the captured portal/session or supply browser credentials', async () => {
  const t = tab(undefined, async (_url, init) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get('X-Qarevo-Portal'), 'patient')
    assert.equal(headers.get('X-Qarevo-Session'), 'session-A')
    assert.equal(headers.get('Authorization'), null)
    assert.equal(headers.get('X-Qarevo-Refresh-Token'), null)
    return Response.json({})
  })
  login(t, 'A')
  await t.api.apiGet('/private', { 'X-Qarevo-Portal': 'admin', 'X-Qarevo-Session': 'forged', Authorization: 'Bearer forbidden', 'X-Qarevo-Refresh-Token': 'forbidden' })
})

test('a delayed 401 observes an existing cookie renewal without rotating again', async () => {
  const late = deferred(); let rotated = false, rotations = 0
  const t = tab(undefined, async url => {
    if (url.endsWith('/auth/refresh')) { rotations++; rotated = true; return renewed() }
    if (rotated) return Response.json({})
    if (url.endsWith('/late')) return late.promise
    return new Response('', { status: 401 })
  })
  login(t, 'A'); const delayed = t.api.apiGet('/late'); await t.api.apiGet('/private')
  late.resolve(new Response('', { status: 401 })); await delayed
  assert.equal(rotations, 1)
})

for (const failure of ['network', 429, 500, 503, 422]) {
  test(`refresh ${failure} preserves identity and drafts, shares backoff and can recover`, async () => {
    let now = Date.now(); class Clock extends Date { static now() { return now } }
    const server = cookieServer({ firstFailure: () => { if (failure === 'network') throw new TypeError('Offline'); return new Response('{}', { status: failure, headers: { 'Retry-After': '10' } }) } })
    const t = tab(undefined, server.fetch, { Date: Clock }); login(t, 'A')
    const second = tab(t.localStorage, server.fetch, { Date: Clock })
    t.core.createAccountDraftStorage().setItem('health', 'keep')
    const temporary = error => error.name === 'SessionRefreshError' && !t.api.isAuthError(error)
    await assert.rejects(t.api.apiGet('/private'), temporary); await assert.rejects(second.api.apiGet('/private'), temporary)
    assert.equal(server.rotations, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
    assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep')
    assert.equal(t.events.includes('qarevo:auth-session-expired'), false)
    now += 11_000; await t.api.apiGet('/private'); assert.equal(server.rotations, 2)
    assert.equal(t.api.readSessionMarker(), 'session-A'); assert.equal(t.core.createAccountDraftStorage().getItem('health'), 'keep')
  })
}

for (const status of [401, 403]) {
  test(`definitive refresh rejection ${status} clears only the active portal identity/drafts`, async () => {
    const t = tab(undefined, async url => new Response('{}', { status: url.endsWith('/auth/refresh') ? status : 401 })); login(t, 'A')
    login(t, 'D', { portal: 'doctor' }); t.core.createAccountDraftStorage().setItem('health', 'clear on expiry')
    await assert.rejects(t.api.apiGet('/private'))
    assert.equal(t.api.readSessionMarker(), null)
    assert.ok(t.localStorage.getItem('qarevo:doctor:identity'))
    assert.equal(Object.keys(t.sessionStorage).length, 0)
    assert.equal(t.events.filter(event => event === 'qarevo:auth-session-expired').length, 1)
  })
}

for (const body of ['not JSON', '{}', '{"browser_session":null}', JSON.stringify({ browser_session: identity('B') }), JSON.stringify({ browser_session: identity('A', 'doctor') })]) {
  test(`invalid renewal payload cannot corrupt identity and is treated as transient: ${body}`, async () => {
    const t = tab(undefined, async url => url.endsWith('/auth/refresh') ? new Response(body) : new Response('', { status: 401 })); login(t, 'A')
    await assert.rejects(t.api.apiGet('/private'), error => error.name === 'SessionRefreshError')
    assert.equal(t.api.readSessionMarker(), 'session-A')
    assert.ok(Number(t.localStorage.getItem('qarevo:patient:refresh-retry')) > Date.now())
  })
}

test('a renewal timeout preserves identity and releases the in-flight operation', async () => {
  const started = deferred(); let timeout
  const t = tab(undefined, async (url, init) => {
    if (!url.endsWith('/auth/refresh')) return new Response('', { status: 401 })
    return new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }); started.resolve() })
  }, { setTimeout(callback) { timeout = callback; return 1 }, clearTimeout() {} })
  login(t, 'A'); const request = t.api.apiGet('/private')
  const rejection = assert.rejects(request, error => error.name === 'SessionRefreshError')
  await started.promise; timeout(); await rejection
  assert.equal(t.api.readSessionMarker(), 'session-A')
  await assert.rejects(t.api.apiGet('/private'), error => error.name === 'SessionRefreshError')
})

test('unsupported lock coordination fails safely without requesting cookie rotation', async () => {
  let requests = 0
  const t = tab(undefined, async () => { requests++; return new Response('', { status: 401 }) }, { navigator: {} }); login(t, 'A')
  await assert.rejects(t.api.apiGet('/private'), /current browser/i)
  assert.equal(requests, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
})

test('a protected request retries only once if refreshed server credentials are rejected', async () => {
  let requests = 0, rotations = 0
  const t = tab(undefined, async url => { if (url.endsWith('/auth/refresh')) { rotations++; return renewed() }; requests++; return new Response('', { status: 401 }) })
  login(t, 'A'); await assert.rejects(t.api.apiGet('/private'), error => t.api.isAuthError(error))
  assert.equal(rotations, 1); assert.equal(requests, 2)
})

test('network failure during logout still removes local identity/drafts without exposing refresh secrets', async () => {
  let posted
  const t = tab(undefined, async (_url, init) => { posted = JSON.parse(init.body); throw new Error('Offline') }); login(t, 'A')
  t.core.createAccountDraftStorage().setItem('health', 'Private')
  await assert.rejects(t.api.logoutCurrentUser(), /Offline/)
  assert.deepEqual(posted, {}); assert.equal(t.api.readSessionMarker(), null)
  assert.equal(Object.keys(t.sessionStorage).length, 0)
})

test('BFF session mismatch response is rejected before exposing any private body', async () => {
  let read = false
  const response = Response.json({ patient: 'B' }, { headers: { 'X-Qarevo-Session-Id': 'session-B' } })
  response.text = async () => { read = true; return '{"patient":"B"}' }
  const t = tab(undefined, async () => response); login(t, 'A')
  await assert.rejects(t.api.apiGet('/private'), /session changed/i)
  assert.equal(read, false); assert.equal(t.api.readSessionMarker(), 'session-A')
})

test('stale-tab 409 never refreshes or clears the newer cookie-bound identity', async () => {
  let calls = 0
  const t = tab(undefined, async () => { calls++; return Response.json({ detail: { error_code: 'SESSION_CHANGED' } }, { status: 409 }) }); login(t, 'A')
  await assert.rejects(t.api.apiPost('/private', {}), /session changed/i)
  assert.equal(calls, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
})


test('clinical conflict details survive HTTP 409 without renewing or clearing a valid session', async () => {
  let calls = 0
  const detail = 'This lab request can no longer be planned or rescheduled here. Contact your care team; existing results and clinical progress are preserved.'
  const t = tab(undefined, async () => { calls++; return Response.json({ detail }, { status: 409 }) }); login(t, 'A')
  await assert.rejects(t.api.apiPost('/api/v1/patient/lab-requests/synthetic/book', {}), error => {
    assert.ok(error instanceof t.api.ApiError)
    assert.equal(error.status, 409)
    assert.equal(t.api.getApiErrorDetail(error), detail)
    assert.doesNotMatch(error.message, /session changed/i)
    return true
  })
  assert.equal(calls, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
})

test('malformed and non-JSON conflicts retain internal bodies and sessions while UI copy stays safe', async () => {
  for (const body of ['{"detail":', 'The requested appointment slot is no longer available.']) {
    let calls = 0
    const t = tab(undefined, async () => { calls++; return new Response(body, { status: 409 }) }); login(t, 'A')
    await assert.rejects(t.api.apiGet('/private'), error => {
      assert.ok(error instanceof t.api.ApiError)
      assert.equal(error.status, 409)
      assert.equal(error.body, body)
      assert.equal(t.api.getApiErrorDetail(error), 'The service returned an unexpected response. Please retry.')
      assert.doesNotMatch(error.message, /session changed/i)
      return true
    })
    assert.equal(calls, 1); assert.equal(t.api.readSessionMarker(), 'session-A')
  }
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
  const compiledModule = { exports: {} }
  vm.runInNewContext(compile('video-connection.ts'), { module: compiledModule, exports: compiledModule.exports, Promise, Set, Error })
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
    create: () => compiledModule.exports.createVideoConnection({ meeting_id: 'synthetic', attendee_id: 'local', join_token: 'never-persist', media_placement: {} }, {}, {
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


test('session deadlines use the earliest server limit and conservatively deduct transit time', () => {
  const mod = { exports: {} }
  vm.runInNewContext(compile('session-timeout.ts'), { module: mod, exports: mod.exports, Date, Error })
  const status = { server_time: '2030-01-01T12:00:00Z', idle_expires_at: '2030-01-01T12:15:00Z', absolute_expires_at: '2030-01-01T12:05:00Z', warning_seconds: 120 }
  const result = mod.exports.sessionTiming(status, 5000, 1000)
  assert.equal(result.deadline, 304000)
  assert.equal(result.absolute, true)
  assert.equal(result.warningMs, 120000)
  assert.throws(() => mod.exports.sessionTiming({ ...status, idle_expires_at: 'invalid' }, 5000, 0), /unavailable/)
  assert.equal(mod.exports.sessionTiming({ ...status, idle_expires_at: '2029-01-01T00:00:00Z' }, 5000, 0).deadline, 5000)
})


test('simultaneous patient chrome reads share one request but never cache completed profile data', async () => {
  let calls = 0
  const hold = deferred()
  const t = tab(storage(), async () => { calls++; await hold.promise; return new Response(JSON.stringify({ user_id: 'a' })) })
  login(t, 'a')
  const first = t.api.getPatientSettings(), second = t.api.getPatientSettings()
  assert.equal(calls, 1)
  hold.resolve()
  const results = await Promise.all([first, second])
  assert.equal(results[0].user_id, 'a')
  await t.api.getPatientSettings()
  assert.equal(calls, 2)
})


test('all sign-in portals can display structured lockouts without hiding credential or permission errors', () => {
  const { api } = tab()
  const locked = new api.ApiError(429, JSON.stringify({detail:{error_code:'TOO_MANY_LOGIN_ATTEMPTS',message:'Try again in 15 minutes.'}}))
  assert.equal(api.getLoginThrottleMessage(locked), 'Try again in 15 minutes.')
  assert.match(api.getLoginThrottleMessage(new api.ApiError(429,'')), /Too many sign-in attempts/)
  assert.equal(api.getLoginThrottleMessage(new api.ApiError(401,'Invalid password')), null)
  assert.equal(api.getLoginThrottleMessage(new api.ApiError(403,'Admin access required')), null)
})

test('booking navigation excludes profile images and clinical payloads and stays bounded at supported input limits', () => {
  const booking = { exports: {} }
  vm.runInNewContext(compile('booking.ts'), { module: booking, exports: booking.exports, URLSearchParams, require: () => ({ PHYSICIANS: [] }) })
  const doctor = {id:'11111111-1111-4111-8111-111111111111',name:'Synthetic Doctor',specialty:'General Practice',hospital:'Synthetic',imageUrl:'data:image/png;base64,'+'A'.repeat(5*1024*1024),consultationFee:123,rating:5,experienceYears:10,languages:['German'],insurance:['Self pay']}
  const input = new URLSearchParams({chief_complaint:'private concern'.repeat(1000),physicianImageUrl:doctor.imageUrl,medicalHistory:'private medical history',date:'2030-07-10',slot:'9:00 AM',start_at:'2030-07-10T07:00:00+00:00',episode_id:'22222222-2222-4222-8222-222222222222'})
  const bounded=booking.exports.buildBookingQueryParams(input,doctor,'video').toString()
  assert.ok(bounded.length<600, `bounded booking query was ${bounded.length} characters`)
  assert.ok(!/private|base64|physicianImage|physicianName|physicianConsultationFee/.test(bounded))
  assert.equal(new URLSearchParams(bounded).get('episode_id'),'22222222-2222-4222-8222-222222222222')
  assert.equal(new URLSearchParams(bounded).get('start_at'),'2030-07-10T07:00:00+00:00')
  const malicious = new URLSearchParams({physicianId:'x'.repeat(300000),slot:'x'.repeat(300000),service:'javascript:bad',episode_id:'medical/private text'})
  assert.equal(booking.exports.buildBookingQueryParams(malicious,null,null).toString(),'')
  assert.equal(booking.exports.getBookingPhysician(new URLSearchParams({physicianName:'Forged clinician',physicianConsultationFee:'0'}),doctor).name,'Synthetic Doctor')
})

test('administrator guards use scoped nonsecret identity and reject retired shared role flags', () => {
  const t = tab()
  t.localStorage.setItem('qarevo_role', 'ADMIN')
  assert.equal(t.api.readAdminRole(), null)
  assert.equal(t.api.isAdmin(), false)
  login(t, 'synthetic-owner', { portal: 'admin' })
  assert.equal(t.localStorage.getItem('qarevo_role'), null)
  assert.equal(t.localStorage.getItem('qarevo_access_token'), null)
  assert.equal(t.api.readAdminRole(), 'ADMIN')
  assert.equal(t.api.isAdmin(), true)
  login(t, 'synthetic-patient', { portal: 'patient' })
  assert.equal(t.api.isAdmin(), true)
  t.api.clearPortalSession('admin')
  assert.equal(t.api.isAdmin(), false)
  assert.equal(t.portal.readPortalIdentity('patient').user_id, 'synthetic-patient')
})

test('identity events ignore portal appearance and renewal storage writes while retaining identity changes', () => {
  class IdentityStorageEvent extends Event { constructor(key) { super('storage'); this.key = key } }
  const t = tab(undefined, undefined, { StorageEvent: IdentityStorageEvent })
  for (const portal of ['patient', 'doctor', 'admin']) {
    assert.equal(t.portal.isPortalIdentityEvent(new IdentityStorageEvent(`qarevo:${portal}:identity`), portal), true)
    assert.equal(t.portal.isPortalIdentityEvent(new IdentityStorageEvent(null), portal), true)
    for (const name of ['theme', 'renewal', 'refresh-retry', 'logout-pending']) {
      assert.equal(t.portal.isPortalIdentityEvent(new IdentityStorageEvent(`qarevo:${portal}:${name}`), portal), false)
    }
    const other = portal === 'doctor' ? 'patient' : 'doctor'
    assert.equal(t.portal.isPortalIdentityEvent(new IdentityStorageEvent(`qarevo:${other}:identity`), portal), false)
    assert.equal(t.portal.isPortalIdentityEvent(new BrowserCustomEvent('qarevo:account-changed', { detail: { portal } }), portal), true)
    assert.equal(t.portal.isPortalIdentityEvent(new BrowserCustomEvent('qarevo:account-changed', { detail: { portal: other } }), portal), false)
  }
})

test('a doctor profile change replaces the old in-flight generation with one shared fresh request', async () => {
  const old = deferred(), fresh = deferred()
  let reads = 0
  const t = tab(undefined, async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/v1/doctor/profile')
    if (init.method === 'PUT') return Response.json({ full_name: 'Synthetic Clinician', avatar_url: '/new-owned.png' })
    reads++
    return reads === 1 ? old.promise : reads === 2 ? fresh.promise : Response.json({ avatar_url: '/new-owned.png' })
  })
  t.location.pathname = '/doctor/profile'
  login(t, 'synthetic-clinician', { portal: 'doctor' })
  const initialDesktop = t.api.getDoctorProfile(), initialMobile = t.api.getDoctorProfile()
  assert.equal(reads, 1)
  const updates = []
  const stopDesktop = t.profile.subscribeProfileChanges('doctor', () => updates.push(t.api.getDoctorProfile()))
  const stopMobile = t.profile.subscribeProfileChanges('doctor', () => updates.push(t.api.getDoctorProfile()))
  await t.api.updateDoctorProfile({ avatar_url: '/new-owned.png' })
  assert.equal(t.profile.profileRevision('doctor'), 1)
  assert.equal(reads, 2)
  fresh.resolve(Response.json({ avatar_url: '/new-owned.png' }))
  assert.deepEqual((await Promise.all(updates)).map(value => value.avatar_url), ['/new-owned.png', '/new-owned.png'])
  old.resolve(Response.json({ avatar_url: '/old-owned.png' }))
  await Promise.all([initialDesktop, initialMobile])
  assert.equal((await t.api.getDoctorProfile()).avatar_url, '/new-owned.png')
  assert.equal(reads, 3)
  stopDesktop(); stopMobile()
})

test('established portal CSRF cookie avoids a bootstrap round trip on each mutation',async()=>{
  const requests=[]
  const csrf='a'.repeat(64)
  const t=tab(storage(),undefined,{document:{cookie:`qarevo_patient_csrf=${csrf}; qarevo_doctor_csrf=${'b'.repeat(64)}`},fetch:async(url,init)=>{
    requests.push({path:new URL(url).pathname,headers:new Headers(init.headers)})
    return Response.json({saved:true})
  }})
  login(t,'A')
  await t.api.apiPut('/api/v1/patient/settings',{language:'English'})
  await t.api.apiPost('/api/v1/patient/medical-records',{note:'synthetic'})
  assert.equal(requests.length,2)
  assert.ok(requests.every(request=>request.path!=='/api/v1/browser-csrf'&&request.headers.get('X-Qarevo-CSRF')===csrf&&request.headers.get('X-Qarevo-Portal')==='patient'))
})

test('concurrent first mutations share one portal CSRF bootstrap request',async()=>{
  const bootstrap=deferred(),paths=[]
  const t=tab(storage(),undefined,{document:{cookie:''},fetch:async(url)=>{
    const path=new URL(url).pathname;paths.push(path)
    return path==='/api/v1/browser-csrf'?bootstrap.promise:Response.json({saved:true})
  }})
  login(t,'A')
  const first=t.api.apiPut('/api/v1/patient/settings',{language:'English'})
  const second=t.api.apiPost('/api/v1/patient/medical-records',{note:'synthetic'})
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(paths.filter(path=>path==='/api/v1/browser-csrf').length,1)
  bootstrap.resolve(Response.json({csrf_token:'a'.repeat(64)}))
  await Promise.all([first,second])
  assert.equal(paths.length,3)
})

test('a refreshed retry failure from an old portal cannot request current-portal sign-out',async()=>{
  const retry=deferred(),started=deferred();let reads=0,refreshes=0
  const t=tab(undefined,async url=>{
    const path=new URL(url).pathname
    if(path==='/api/v1/auth/refresh'){refreshes++;return Response.json({browser_session:identity('clinician','doctor')})}
    reads++
    if(reads===1)return Response.json({detail:'Access expired'},{status:401})
    started.resolve();return retry.promise
  })
  t.location.pathname='/doctor/settings'
  login(t,'clinician',{portal:'doctor'})
  const patient=login(t,'patient',{portal:'patient'})
  const pending=t.api.apiGet('/api/v1/doctor/profile')
  await started.promise
  t.location.pathname='/patient/dashboard'
  retry.resolve(Response.json({detail:'Session rejected'},{status:401}))
  await assert.rejects(pending,error=>!t.api.isAuthError(error)&&/page changed/.test(error.message))
  assert.equal(refreshes,1)
  assert.equal(t.portal.readPortalIdentity('patient').session_id,patient.session_id)
  assert.equal(t.localStorage.getItem('qarevo:patient:signed-out'),null)
})

test('portal action continuations require their mounted page and original session generation',()=>{
  const t=tab()
  login(t,'patient')
  const actionModule={exports:{}}
  vm.runInNewContext(compile('portal-action.ts'),{
    window:{location:t.location,localStorage:t.localStorage},module:actionModule,exports:actionModule.exports,
    require(name){
      if(name==='react')return {}
      if(name==='./account-storage')return t.core
      if(name==='./portal-scope')return t.portal
      throw new Error('Unexpected import: '+name)
    },
  })
  let mounted=true
  const action=actionModule.exports.capturePortalAction(()=>mounted)
  assert.equal(action.portal,'patient')
  assert.equal(action.isCurrent(),true)
  t.location.pathname='/patient/settings'
  assert.equal(action.isCurrent(),false)
  t.location.pathname='/patient/dashboard'
  mounted=false;assert.equal(action.isCurrent(),false)
  mounted=true
  login(t,'patient',{session:'new-family'})
  assert.equal(action.isCurrent(),false)
  const next=actionModule.exports.capturePortalAction(()=>mounted)
  t.api.clearPortalSession('patient')
  assert.equal(next.isCurrent(),false)
  assert.equal(next.isCurrent({allowEndedSession:true}),true)
  login(t,'different-patient')
  t.api.clearPortalSession('patient')
  assert.equal(next.isCurrent({allowEndedSession:true}),false)
  t.location.pathname='/doctor/dashboard'
  assert.equal(next.isCurrent(),false)
})

test('canonical SPA navigation selects its portal before window history commits and recovery routes have explicit patient scope',()=>{
  const t=tab()
  t.location.pathname='/auth/sign-in'
  t.sessionStorage.setItem('qarevo:active-portal','patient')
  assert.equal(t.portal.currentPortal('/auth/doctor/login'),'doctor')
  assert.equal(t.portal.currentPortal('/auth/admin/login'),'admin')
  t.sessionStorage.setItem('qarevo:active-portal','doctor')
  for(const route of ['/auth/forgot-password','/auth/reset-password']) {
    assert.equal(t.portal.currentPortal(route),'patient')
    assert.equal(t.portal.portalFromPath(route),'patient')
  }
  t.location.hostname='doctor.qarevohealth.com'
  assert.equal(t.portal.currentPortal('/auth/reset-password'),'doctor')
  assert.equal(t.portal.currentPortal('/patient/dashboard'),'doctor')
})

test('explicit portal draft ownership survives initialization before the canonical route commits',()=>{
  const t=tab()
  login(t,'patient')
  login(t,'clinician',{portal:'doctor'})
  // The boundary selected doctor from Next's new pathname, while the browser
  // location still represents the previous committed patient page.
  const draft=t.core.createAccountDraftStorage('doctor')
  assert.equal(draft.getItem('consultation'),null)
  t.location.pathname='/doctor/workspace'
  draft.setItem('consultation','synthetic-clinician-draft')
  assert.equal(draft.getItem('consultation'),'synthetic-clinician-draft')
  const keys=Object.keys(t.sessionStorage)
  assert.equal(keys.filter(key=>key.startsWith('qarevo.draft.v3:doctor:')).length,1)
  assert.equal(keys.some(key=>key.startsWith('qarevo.draft.v3:patient:')),false)
})

test('authentication continuations accept only their exact newly verified session and cancel scheduled work on unmount',()=>{
  const t=tab();login(t,'old-patient')
  const actionModule={exports:{}},timers=new Map(),cleanups=[];let nextTimer=0,continued=0
  vm.runInNewContext(compile('portal-action.ts'),{
    window:{location:t.location,localStorage:t.localStorage},module:actionModule,exports:actionModule.exports,
    setTimeout(callback){const id=++nextTimer;timers.set(id,callback);return id},
    clearTimeout(id){timers.delete(id)},
    require(name){
      if(name==='react')return{useRef:value=>({current:value}),useCallback:callback=>callback,useEffect:effect=>cleanups.push(effect())}
      if(name==='./account-storage')return t.core
      if(name==='./portal-scope')return t.portal
      throw new Error('Unexpected import: '+name)
    },
  })
  const capture=actionModule.exports.usePortalAction(),action=capture()
  const verified=login(t,'new-patient')
  assert.equal(action.isCurrent(),false)
  assert.equal(action.isCurrent({completedSession:verified}),true)
  assert.equal(action.isCurrent({completedSession:{...verified,role:'ADMIN'}}),false)
  action.after(900,()=>continued++,{completedSession:verified})
  timers.get(1)();assert.equal(continued,1)
  action.after(900,()=>continued++,{completedSession:verified})
  login(t,'newer-patient')
  timers.get(2)();assert.equal(continued,1)
  const current=capture()
  current.after(900,()=>continued++)
  for(const cleanup of cleanups)cleanup()
  assert.equal(timers.has(3),false)
  assert.equal(current.isCurrent(),false)
})

test('optional cancellation signals preserve the authenticated notification read and CSRF-protected patch pipeline', async () => {
  const calls = [], deadlines = []
  const t = tab(undefined, async (url, init) => {
    calls.push({ url, init })
    if (init.signal?.aborted) throw new DOMException('Notification request cancelled', 'AbortError')
    return Response.json({ accepted: true })
  }, { AbortSignal: { any: AbortSignal.any.bind(AbortSignal), timeout(milliseconds) {
    const deadline = new AbortController()
    if (milliseconds === 35_000) deadlines.push(deadline)
    return deadline.signal
  } } })
  login(t, 'notification-owner')
  const controller = new AbortController()
  await t.api.apiGet('/api/v1/patient/activity/notifications', undefined, controller.signal)
  await t.api.apiPatch('/api/v1/patient/activity/notifications/44444444-4444-4444-8444-444444444444/read', undefined, undefined, controller.signal)
  assert.equal(calls.length, 2)
  for (const { init } of calls) {
    assert.equal(init.signal.aborted, false)
    assert.equal(init.credentials, 'same-origin')
    assert.equal(init.cache, 'no-store')
    assert.equal(init.headers.get('X-Qarevo-Portal'), 'patient')
    assert.equal(init.headers.get('X-Qarevo-Session'), 'session-notification-owner')
    assert.equal(init.headers.get('Authorization'), null)
  }
  assert.equal(calls[1].init.headers.get('X-Qarevo-CSRF'), 'synthetic-csrf-check')
  controller.abort()
  assert.equal(calls[0].init.signal.aborted, true)
  assert.equal(calls[1].init.signal.aborted, true)
  const stillMounted = new AbortController()
  await t.api.apiGet('/api/v1/patient/activity/notifications', undefined, stillMounted.signal)
  deadlines.at(-1).abort()
  assert.equal(calls.at(-1).init.signal.aborted, true)
  assert.equal(stillMounted.signal.aborted, false)
  await assert.rejects(t.api.apiGet('/api/v1/patient/activity/notifications', undefined, controller.signal), /cancelled/)
})

test('private clinician patient searches use CSRF-protected read-only POST bodies while finite identity reads retain GET', async () => {
  const calls = [], t = tab(undefined, async (url, init) => { calls.push({ url, init }); return Response.json({ patients: [] }) })
  t.location.pathname = '/doctor/patients'; login(t, 'directory-owner', { portal: 'doctor' })
  const controller = new AbortController()
  await t.api.getDoctorPatients('active', { page: 2, page_size: 10 }, 'Synthetic private search@example.test', '11111111-1111-4111-8111-111111111111', controller.signal)
  assert.equal(calls[0].url, 'https://web.qarevo.example/api/v1/doctor/patients/search')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), { q: 'Synthetic private search@example.test', page: 2, page_size: 10, status: 'active', patient_id: '11111111-1111-4111-8111-111111111111' })
  assert.equal(calls[0].init.headers.get('X-Qarevo-CSRF'), 'synthetic-csrf-check')
  assert.equal(calls[0].init.headers.get('X-Qarevo-Portal'), 'doctor')
  assert.equal(calls[0].init.credentials, 'same-origin'); assert.equal(calls[0].init.cache, 'no-store')
  await t.api.getDoctorPatients(undefined, { page: 1, page_size: 1 }, undefined, '11111111-1111-4111-8111-111111111111')
  assert.equal(calls[1].init.method, undefined); assert.equal(new URL(calls[1].url).searchParams.has('q'), false)
  assert.equal(calls.some(call => call.url.includes('/session/activity')), false)
  assert.equal(JSON.stringify({ ...t.localStorage, ...t.sessionStorage }).includes('Synthetic private search'), false)
  controller.abort(); assert.equal(calls[0].init.signal.aborted, true)
})

test('API errors accept only a strict server UUID header and never expose body data in their message', async () => {
  const requestId = '11111111-1111-4111-8111-111111111111', sentinel = 'Synthetic private clinical text https://private.example.test/record'
  const t = tab(undefined, async () => new Response(JSON.stringify({ detail: 'Synthetic operation unavailable', request_id: 'forged-body-reference' }), { status: 503, headers: { 'X-Request-ID': requestId } })); login(t, 'diagnostic-owner')
  await assert.rejects(t.api.apiGet('/private'), error => { assert.equal(error.requestId, requestId); assert.equal(t.api.getApiErrorRequestId(error), requestId); assert.equal(t.api.getApiErrorDetail(error), 'Synthetic operation unavailable'); return true })
  for (const value of [undefined, '', 'not-a-reference', requestId + ', ' + requestId, requestId + '\n', 'ABCDEFAB-1111-4111-8111-111111111111', sentinel]) assert.equal(new t.api.ApiError(502, sentinel, value).requestId, null)
  const failure = new t.api.ApiError(502, sentinel, requestId)
  assert.equal(failure.body, sentinel); assert.equal(failure.message.includes(sentinel), false); assert.equal(t.api.getApiErrorDetail(failure), 'The service returned an unexpected response. Please retry.')
  assert.equal(t.api.getApiErrorRequestId(new Error(sentinel)), null)
  assert.equal(t.api.safeRequestId('abcdefab-1111-1111-8111-111111111111'), 'abcdefab-1111-1111-8111-111111111111')
  assert.equal(JSON.stringify({ ...t.localStorage, ...t.sessionStorage }).includes(requestId), false)
})

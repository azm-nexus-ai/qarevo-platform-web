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

function storage() {
  const data = {}
  Object.defineProperties(data, {
    getItem: { value(key) { return Object.hasOwn(data, key) ? data[key] : null } },
    setItem: { value(key, value) { data[key] = String(value) } },
    removeItem: { value(key) { delete data[key] } },
  })
  return data
}

function tab(localStorage = storage(), fetch = async () => new Response('{}')) {
  const window = {
    localStorage,
    sessionStorage: storage(),
    dispatchEvent() {},
  }
  const shared = {
    window, fetch, Headers, Response, Event, URL, URLSearchParams,
    crypto: webcrypto, console,
    process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://qarevo.invalid' } },
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
  return { ...window, core: core.exports, api: api.exports }
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
  login(t, 'B')
  response.resolve(new Response('{}'))
  await assert.rejects(request, /session changed/i)
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

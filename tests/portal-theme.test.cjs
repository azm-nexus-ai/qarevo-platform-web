const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const compile = name => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const themeCode = compile('theme.ts'), portalCode = compile('portal-scope.ts')
function storage(seed = {}, blocked = false) {
  const entries = new Map(Object.entries(seed))
  return {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return entries.get(key) ?? null },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); entries.set(key, String(value)) },
    removeItem(key) { if (blocked) throw new Error('Storage blocked'); entries.delete(key) },
  }
}
function browser({ hostname = 'qarevo.invalid', pathname = '/auth/sign-in', local = {}, session = {}, blocked = false } = {}) {
  const localStorage = storage(local, blocked), sessionStorage = storage(session, blocked)
  const document = { documentElement: { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value } } }
  const window = { location: { hostname, pathname }, localStorage, sessionStorage }
  const globals = { window, document, localStorage, sessionStorage }
  const portalModule = { exports: {} }, themeModule = { exports: {} }
  vm.runInNewContext(portalCode, { ...globals, exports: portalModule.exports, module: portalModule })
  const context = vm.createContext({ ...globals, exports: themeModule.exports, module: themeModule, require(name) {
    assert.equal(name, './portal-scope'); return portalModule.exports
  } })
  vm.runInContext(themeCode, context)
  return { window, document, localStorage, sessionStorage, portal: portalModule.exports, theme: themeModule.exports,
    bootstrap: () => vm.runInContext(themeModule.exports.THEME_BOOTSTRAP, context) }
}

test('theme preferences use independent exact portal keys and never change another active portal', () => {
  const tab = browser()
  tab.theme.setPortalTheme('dark', 'patient')
  tab.theme.setPortalTheme('dark', 'admin')
  tab.theme.setPortalTheme('light', 'doctor')
  assert.equal(tab.theme.themeKey('patient'), 'qarevo:patient:theme')
  assert.equal(tab.localStorage.getItem('qarevo:patient:theme'), 'dark')
  assert.equal(tab.localStorage.getItem('qarevo:doctor:theme'), 'light')
  assert.equal(tab.localStorage.getItem('qarevo:admin:theme'), 'dark')
  assert.equal(tab.document.documentElement.dataset.theme, 'dark')
  tab.window.location.pathname = '/doctor/dashboard'
  assert.equal(tab.theme.applyPortalTheme(), 'light')
  assert.equal(tab.document.documentElement.dataset.themePortal, 'doctor')
  assert.equal(tab.localStorage.getItem('qarevo:patient:theme'), 'dark')
})

test('legacy preference migrates once to the active portal and is never copied into another role', () => {
  const tab = browser({ pathname: '/doctor/dashboard', local: { 'qarevo.theme.v1': 'dark' } })
  tab.bootstrap()
  assert.equal(tab.document.documentElement.dataset.theme, 'dark')
  assert.equal(tab.localStorage.getItem('qarevo:doctor:theme'), 'dark')
  assert.equal(tab.localStorage.getItem('qarevo.theme.v1'), null)
  assert.equal(tab.localStorage.getItem('qarevo:patient:theme'), null)
  tab.window.location.pathname = '/patient/dashboard'
  assert.equal(tab.theme.applyPortalTheme(), 'light')
  assert.equal(tab.localStorage.getItem('qarevo:patient:theme'), null)
})

test('an explicit portal preference wins over the retired shared preference', () => {
  const tab = browser({ pathname: '/auth/admin/login', local: { 'qarevo.theme.v1': 'dark', 'qarevo:admin:theme': 'light' } })
  tab.bootstrap()
  assert.equal(tab.document.documentElement.dataset.theme, 'light')
  assert.equal(tab.localStorage.getItem('qarevo.theme.v1'), null)
  assert.equal(tab.localStorage.getItem('qarevo:admin:theme'), 'light')
})

for (const [hostname, pathname, remembered] of [
  ['patient.qarevo-health.de', '/doctor/dashboard', 'admin'],
  ['doctor.qarevo-health.de', '/patient/dashboard', 'patient'],
  ['admin.qarevo-health.de', '/support', 'doctor'],
  ['localhost', '/auth/sign-in', 'doctor'],
  ['localhost', '/auth/forgot-password', 'doctor'],
  ['localhost', '/auth/reset-password', 'doctor'],
  ['localhost', '/auth/doctor/login', 'patient'],
  ['localhost', '/auth/doctor-register', 'patient'],
  ['localhost', '/auth/doctor-verify-email', 'patient'],
  ['localhost', '/auth/doctor-verify-phone', 'patient'],
  ['localhost', '/auth/admin/accept-invitation', 'patient'],
  ['localhost', '/auth/profile-setup/personal-information', 'doctor'],
  ['localhost', '/auth/social/callback', 'doctor'],
  ['localhost', '/support', 'admin'],
  ['localhost', '/privacy', null],
]) {
  test(`before-paint bootstrap and runtime resolve the same portal for ${hostname}${pathname} (${remembered})`, () => {
    const tab = browser({ hostname, pathname, session: remembered ? { 'qarevo:active-portal': remembered } : {}, local: {
      'qarevo:patient:theme': 'dark', 'qarevo:doctor:theme': 'light', 'qarevo:admin:theme': 'dark', 'qarevo.sidebar.patient-right': 'collapsed',
    } })
    const expected = tab.portal.currentPortal()
    tab.bootstrap()
    assert.equal(tab.document.documentElement.dataset.themePortal, expected)
    assert.equal(tab.document.documentElement.dataset.theme, expected === 'doctor' ? 'light' : 'dark')
    assert.equal(tab.sessionStorage.getItem('qarevo:active-portal'), expected)
    assert.equal(tab.document.documentElement.attributes['data-patient-right-sidebar'], 'collapsed')
  })
}

test('theme remains usable without browser storage and does not leak its in-memory choice to a different portal', () => {
  const tab = browser({ blocked: true })
  assert.doesNotThrow(() => tab.bootstrap())
  tab.theme.setPortalTheme('dark')
  assert.equal(tab.theme.applyPortalTheme(), 'dark')
  tab.window.location.pathname = '/doctor/dashboard'
  assert.equal(tab.theme.applyPortalTheme(), 'light')
  assert.equal(tab.document.documentElement.dataset.theme, 'light')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { format } = require('node:url')
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match')
const { matchHas, prepareDestination } = require('next/dist/shared/lib/router/utils/prepare-destination')
const { checkCustomRoutes } = require('next/dist/lib/load-custom-routes')

const modules = new Map()
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const module = { exports: {} }
  modules.set(filename, module)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, URL, process: { env: {} }, require(dependency) {
    if (dependency.startsWith('.')) return load(path.relative(path.join(__dirname, '..'), path.resolve(path.dirname(filename), dependency + '.ts')))
    return require(dependency)
  } }, { filename })
  return module.exports
}
const { portalHostRedirects } = load('lib/server/portal-host-routing.ts')
const { portalFromPath, PORTAL_PATH_PREFIXES } = load('lib/portal-scope.ts')
const origins = {
  PORTAL_PATIENT_ORIGIN: 'https://patient.qarevo.example',
  PORTAL_DOCTOR_ORIGIN: 'https://doctor.qarevo.example',
  PORTAL_ADMIN_ORIGIN: 'https://admin.qarevo.example',
}
const rules = portalHostRedirects(origins)

// Exercise the installed Next compiler rather than an approximate URL matcher.
function redirect(input, redirects = rules) {
  const url = new URL(input)
  const query = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    query[key] = values.length === 1 ? values[0] : values
  }
  for (const rule of redirects) {
    const params = getPathMatch(rule.source, { strict: true })(url.pathname)
    if (!params) continue
    const conditions = matchHas({ headers: { host: url.host } }, query, rule.has || [], rule.missing || [])
    if (!conditions) continue
    const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination: rule.destination, params: { ...params, ...conditions }, query })
    return { url: new URL(format({ ...parsedDestination, search: undefined })), rule }
  }
  return null
}

test('shared-host development generates no redirects and Next config registers only the static factory', () => {
  assert.equal(portalHostRedirects({}).length, 0)
  assert.equal(portalHostRedirects({ PORTAL_PATIENT_ORIGIN: '', PORTAL_DOCTOR_ORIGIN: '', PORTAL_ADMIN_ORIGIN: '' }).length, 0)
  const config = load('next.config.ts').default
  assert.equal(config.redirects().length, 0)
  assert.equal(config.rewrites, undefined)
  assert.equal(config.proxy, undefined)
})

test('all generated host rules pass installed Next validation and remain temporary', () => {
  assert.doesNotThrow(() => checkCustomRoutes(rules, 'redirect'))
  assert.equal(rules.length, 36)
  assert.equal(rules.every(rule => rule.permanent === false && rule.has.length === 1 && rule.has[0].type === 'host'), true)
})

for (const portal of ['patient', 'doctor', 'admin']) {
  test(`${portal} host root and /auth route to its own authenticated dashboard boundary`, () => {
    for (const pathname of ['/', '/auth']) {
      const result = redirect(`https://${portal}.qarevo.example${pathname}?next=%2F${portal}%2Fsettings`)
      assert.equal(result.url.origin, `https://${portal}.qarevo.example`)
      assert.equal(result.url.pathname, `/${portal}/dashboard`)
      assert.equal(result.url.searchParams.get('next'), `/${portal}/settings`)
    }
  })
  test(`${portal} host keeps its own canonical routes, shared support, legal routes and ambiguous identity callbacks`, () => {
    for (const prefix of PORTAL_PATH_PREFIXES[portal]) {
      assert.equal(portalFromPath(prefix), portal)
      assert.equal(redirect(`https://${portal}.qarevo.example${prefix}`), null)
    }
    for (const pathname of ['/support', '/support/ticket-123', '/privacy', '/terms', '/cookies', '/impressum', '/auth/forgot-password', '/auth/reset-password', '/auth/social/callback', '/auth/social/callback/apple', '/auth/verify-email/link', '/api/v1/session', '/api/v1/auth/login']) {
      assert.equal(redirect(`https://${portal}.qarevo.example${pathname}?returnTo=https%3A%2F%2Funtrusted.example`), null)
    }
  })
  test(`${portal} host redirects every other canonical portal path to the exact configured authority`, () => {
    for (const target of ['patient', 'doctor', 'admin'].filter(value => value !== portal)) {
      for (const prefix of PORTAL_PATH_PREFIXES[target]) {
        const pathname = prefix === '/auth/verify-email' ? prefix : `${prefix}/nested-record`
        const result = redirect(`https://${portal}.qarevo.example${pathname}?tab=history&tag=one&tag=two&next=https%3A%2F%2Funtrusted.example`)
        assert.equal(result.url.origin, `https://${target}.qarevo.example`)
        assert.equal(result.url.pathname, pathname)
        assert.equal(result.url.searchParams.get('tab'), 'history')
        assert.deepEqual(result.url.searchParams.getAll('tag'), ['one', 'two'])
        assert.equal(result.url.searchParams.get('next'), 'https://untrusted.example')
        assert.equal(redirect(result.url.href), null)
      }
    }
  })
}

test('host conditions are escaped, exact and case insensitive through Next hostname normalization', () => {
  assert.equal(redirect('https://doctorXqarevoXexample/patient/dashboard'), null)
  assert.equal(redirect('https://doctor.qarevo.example.untrusted.example/patient/dashboard'), null)
  assert.equal(redirect('https://unrelated.example/patient/dashboard'), null)
  assert.equal(redirect('https://DOCTOR.QAREVO.EXAMPLE/patient/dashboard').url.origin, origins.PORTAL_PATIENT_ORIGIN)
  assert.equal(redirect('https://doctor.qarevo.example:444/patient/dashboard').url.origin, origins.PORTAL_PATIENT_ORIGIN)
})

test('partial, insecure, credential-bearing, non-origin, ambiguous and swapped host configuration fails explicitly without disclosing its value', () => {
  assert.throws(() => portalHostRedirects({ PORTAL_PATIENT_ORIGIN: origins.PORTAL_PATIENT_ORIGIN }), /Configure all three/)
  for (const invalid of ['not-a-url', 'http://patient.qarevo.example', 'https://user:synthetic-secret@patient.qarevo.example', 'https://@patient.qarevo.example', 'https:////patient.qarevo.example', 'https://patient.qarevo.example/path', 'https://patient.qarevo.example?x=1', 'https://patient.qarevo.example?', 'https://patient.qarevo.example#fragment', ' https://patient.qarevo.example', 'https://patient.qarevo.example\n', 'https://patient.qarevo.example\\', 'https://patient', 'https://patient.qarevo.example.', 'https://patient.-qarevo.example', 'https://patient.qarevo_.example', 'https://patient..example', `https://patient.${'q'.repeat(64)}.example`]) {
    assert.throws(() => portalHostRedirects({ ...origins, PORTAL_PATIENT_ORIGIN: invalid }), error => {
      assert.match(error.message, /PORTAL_PATIENT_ORIGIN/)
      assert.doesNotMatch(error.message, /synthetic-secret/)
      return true
    })
  }
  assert.throws(() => portalHostRedirects({ ...origins, PORTAL_DOCTOR_ORIGIN: origins.PORTAL_PATIENT_ORIGIN }), /distinct hostnames/)
  assert.throws(() => portalHostRedirects({ ...origins, PORTAL_DOCTOR_ORIGIN: origins.PORTAL_PATIENT_ORIGIN + ':444' }), /distinct hostnames/)
  assert.throws(() => portalHostRedirects({ ...origins, PORTAL_PATIENT_ORIGIN: origins.PORTAL_DOCTOR_ORIGIN, PORTAL_DOCTOR_ORIGIN: origins.PORTAL_PATIENT_ORIGIN }), /canonical patient/)
  assert.throws(() => portalHostRedirects({ ...origins, PORTAL_DOCTOR_ORIGIN: 'https://clinicians.qarevo.example' }), /canonical doctor/)
})

test('valid staging domains, explicit default HTTPS ports and root slashes normalize to canonical origins', () => {
  const staging = portalHostRedirects({ PORTAL_PATIENT_ORIGIN: 'https://patient.dev.qarevo.example:443/', PORTAL_DOCTOR_ORIGIN: 'https://doctor.dev.qarevo.example/', PORTAL_ADMIN_ORIGIN: 'https://admin.dev.qarevo.example/' })
  assert.equal(redirect('https://doctor.dev.qarevo.example/patient/settings?tab=profile', staging).url.href, 'https://patient.dev.qarevo.example/patient/settings?tab=profile')
})

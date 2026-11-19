const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const revision = 'a'.repeat(40)
function load(relative, environment = {}) {
  const filename = path.resolve(__dirname, '..', relative)
  const loadedModule = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, Response, process: { env: environment },
    require(dependency) {
      if (dependency === '@/lib/server/build-revision') return load('lib/server/build-revision.ts')
      throw new Error('Unexpected dependency: ' + dependency)
    },
  })
  return loadedModule.exports
}
const { validatedBuildRevision, selectBuildRevision, frontendLiveness } = load('lib/server/build-revision.ts')

test('source identities require an exact lowercase full Git revision', () => {
  assert.equal(validatedBuildRevision(revision), revision)
  for (const value of [null, undefined, {}, 123, '', 'a'.repeat(7), 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), 'g'.repeat(40), revision + '\n', ' ' + revision, revision + ' ', 'private-environment-sentinel']) {
    assert.equal(validatedBuildRevision(value), null)
  }
})

test('build source priority is explicit and malformed overrides cannot silently relabel a release', () => {
  const vercel = 'b'.repeat(40), github = 'c'.repeat(40)
  assert.equal(selectBuildRevision({ QAREVO_BUILD_REVISION: revision, VERCEL_GIT_COMMIT_SHA: vercel, GITHUB_SHA: github }), revision)
  assert.equal(selectBuildRevision({ VERCEL_GIT_COMMIT_SHA: vercel, GITHUB_SHA: github }), vercel)
  assert.equal(selectBuildRevision({ GITHUB_SHA: github }), github)
  assert.equal(selectBuildRevision({}), null)
  assert.equal(selectBuildRevision({ QAREVO_BUILD_REVISION: '', VERCEL_GIT_COMMIT_SHA: vercel }), null)
  assert.equal(selectBuildRevision({ QAREVO_BUILD_REVISION: 'invalid', GITHUB_SHA: github }), null)
  assert.equal(selectBuildRevision({ VERCEL_GIT_COMMIT_SHA: 'invalid', GITHUB_SHA: github }), null)
})

test('liveness discloses only bounded source identity and never implies dependency readiness', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(frontendLiveness(revision))), { status: 'alive', scope: 'frontend_liveness', revision })
  assert.deepEqual(JSON.parse(JSON.stringify(frontendLiveness('private-environment-sentinel'))), { status: 'alive', scope: 'frontend_liveness', revision: null })
})

test('public health handler requires no session, makes no dependency calls and forbids caching', async () => {
  for (const value of [revision, '', 'private-environment-sentinel']) {
    const route = load('app/api/health/live/route.ts', { QAREVO_BUILD_REVISION: value, DATABASE_URL: 'private-database-sentinel', JWT_SECRET: 'private-signing-sentinel' })
    assert.equal(route.runtime, 'nodejs')
    assert.equal(route.dynamic, 'force-dynamic')
    const response = await route.GET()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
    assert.equal(response.headers.get('cdn-cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('set-cookie'), null)
    const body = await response.json()
    assert.deepEqual(body, { status: 'alive', scope: 'frontend_liveness', revision: value === revision ? revision : null })
    assert.doesNotMatch(JSON.stringify(body), /private-|database|jwt|session/i)
  }
})

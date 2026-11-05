const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function providersFor(portal) {
  const mod = { exports: {} }, paths = []
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/social-auth.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === '@/lib/portal-scope') return { currentPortal: () => portal }
      if (name === '@/lib/portal-handoff') return {}
      if (name === '@/lib/api') return { apiGet: async path => { paths.push(path); return { google: { enabled: true }, apple: { enabled: false } } } }
      throw new Error('Unexpected import: ' + name)
    },
  })
  return { api: mod.exports, paths }
}

for (const [portal, role] of [['patient', 'PATIENT'], ['doctor', 'PROVIDER']]) {
  test(`${portal} social availability requests its canonical role`, async () => {
    const { api, paths } = providersFor(portal)
    const result = await api.socialProviders()
    assert.deepEqual(paths, [`/api/v1/auth/social/providers?portal=${role}`])
    assert.equal(result.google.enabled, true)
  })
}

test('administrator social availability stays disabled without calling patient or physician flows', async () => {
  const { api, paths } = providersFor('admin')
  const result = await api.socialProviders()
  assert.equal(paths.length, 0)
  assert.equal(result.google.enabled, false)
  assert.equal(result.apple.enabled, false)
})

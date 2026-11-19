const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile-image-prepare.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require, Error, Math })
const { profileImageFileProblem, scaledSize, MAX_EDGE } = loaded.exports

test('phone-sized photos are accepted for on-device preparation, other files are not', () => {
  assert.equal(profileImageFileProblem({ type: 'image/jpeg', size: 8 * 1024 * 1024 }), null)
  assert.equal(profileImageFileProblem({ type: 'image/heic', size: 3 * 1024 * 1024 }), null)
  assert.match(profileImageFileProblem({ type: 'image/svg+xml', size: 10 }), /JPEG, PNG, WebP or HEIC/)
  assert.match(profileImageFileProblem({ type: 'image/gif', size: 10 }), /JPEG, PNG, WebP or HEIC/)
  assert.match(profileImageFileProblem({ type: 'image/png', size: 0 }), /empty/)
  assert.match(profileImageFileProblem({ type: 'image/png', size: 21 * 1024 * 1024 }), /20 MB/)
})

test('scaling keeps the aspect ratio within the maximum edge and never enlarges', () => {
  assert.deepEqual({ ...scaledSize(4000, 3000) }, { width: MAX_EDGE, height: 576 })
  assert.deepEqual({ ...scaledSize(1080, 1920) }, { width: 432, height: MAX_EDGE })
  assert.deepEqual({ ...scaledSize(200, 100) }, { width: 200, height: 100 })
  assert.throws(() => scaledSize(10, 400), /16 × 16/)
  assert.throws(() => scaledSize(0, 0), /could not be read/)
})

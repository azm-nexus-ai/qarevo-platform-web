const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'physician-slug.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, btoa, atob, URLSearchParams, encodeURIComponent, decodeURIComponent })
const { physicianSlug, physicianPath, physicianIdFromParam, nameSlug, uuidToToken, tokenToUuid } = loaded.exports

const id = '3f2a1c9e-7b4d-4e21-9a0b-5c6d7e8f9012'

test('a slug carries a readable name and a 22-character token that round-trips to the UUID', () => {
  const slug = physicianSlug(id, 'Dr. Anna-Lena Müller')
  assert.match(slug, /^dr-anna-lena-mueller--[A-Za-z0-9_-]{22}$/)
  assert.equal(physicianIdFromParam(slug), id)
  assert.equal(tokenToUuid(uuidToToken(id)), id)
})

test('the name part does not decide the provider, so renamed links still resolve', () => {
  const token = uuidToToken(id)
  assert.equal(physicianIdFromParam(`dr-old-name--${token}`), id)
  assert.equal(physicianIdFromParam(`--${token}`), id)
})

test('older bare UUID links still resolve; anything else does not', () => {
  assert.equal(physicianIdFromParam(id.toUpperCase()), id)
  for (const value of ['', null, '42', 'dr-anna', 'dr-anna--short', 'dr-anna--' + '!'.repeat(22), '../admin']) {
    assert.equal(physicianIdFromParam(value), null, String(value))
  }
})

test('names become safe ASCII slugs', () => {
  assert.equal(nameSlug('Dr. José  García'), 'dr-jose-garcia')
  assert.equal(nameSlug('Straße <script>'), 'dr-strasse-script')
  assert.equal(nameSlug(''), 'dr')
})

test('paths keep the booking query', () => {
  assert.equal(physicianPath(id, 'Dr. A B', new URLSearchParams({ from: 'dashboard', intent: 'book' })).split('?')[1], 'from=dashboard&intent=book')
  assert.equal(physicianPath(id, 'Dr. A B', '?x=1').split('?')[1], 'x=1')
  assert.ok(!physicianPath(id, 'Dr. A B').includes('?'))
})

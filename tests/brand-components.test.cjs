const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Load the real TSX component; no alternate implementation or browser is required.
const cache = new Map()
function load(source) {
  const filename = path.resolve(source)
  if (cache.has(filename)) return cache.get(filename).exports
  const compiled = { exports: {} }
  cache.set(filename, compiled)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  function resolveImport(name) {
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name)
    const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(filename), name)
    const extension = ['.tsx', '.ts', ''].find(ext => fs.existsSync(base + ext))
    if (extension === undefined) throw new Error(`Missing local component dependency: ${name}`)
    return load(base + extension)
  }
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: resolveImport, React, URL }, { filename })
  return compiled.exports
}
const DoctorCard = load('components/cards/DoctorCard.tsx').default
const {default: ProfileAvatar, profileImageSource} = load('components/branding/ProfileAvatar.tsx')
const details = { name: 'Synthetic Physician', specialty: 'General medicine', verification: 'Verified', tags: ['Primary care'] }
const render = props => renderToStaticMarkup(React.createElement(DoctorCard, { ...details, ...props }))

test('physician summary preserves names and shows a verification badge only for verified status', () => {
  assert.match(render({}), /Synthetic Physician/)
  assert.match(render({}), /aria-label="Verified physician"/)
  assert.doesNotMatch(render({ verification: 'Pending' }), /aria-label="Verified physician"/)
  assert.doesNotMatch(render({}), /role="button"/)
})

test('loading uses an announced state without presenting placeholder physician identity as loaded data', () => {
  const html = render({ loading: true })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status"/)
  assert.match(html, /Loading clinician details/)
  assert.doesNotMatch(html, /Synthetic Physician/)
})

test('interactive physician selection supports Enter and Space and exposes the selected state', () => {
  let selections = 0
  const card = DoctorCard({ ...details, selected: true, onSelect: () => selections++ })
  assert.equal(card.props.role, 'button')
  assert.equal(card.props.tabIndex, 0)
  assert.equal(card.props['aria-pressed'], true)
  for (const key of ['Enter', ' ', 'Escape']) card.props.onKeyDown({ key, preventDefault() {} })
  assert.equal(selections, 2)
})

test('disabled and loading physician cards cannot trigger selection', () => {
  let selections = 0
  for (const state of [{ disabled: true }, { loading: true }]) {
    const card = DoctorCard({ ...details, ...state, onSelect: () => selections++ })
    assert.equal(card.props['aria-disabled'], true)
    assert.equal(card.props.tabIndex, undefined)
    assert.equal(card.props.onClick, undefined)
    card.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  }
  assert.equal(selections, 0)
})

test('legacy recommendation and recent-doctor payloads render without a verification field', () => {
  const html = render({ verification: undefined, tags: undefined, imageUrl: null })
  assert.match(html, /Synthetic Physician/)
  assert.match(html, /Verification unavailable/)
  assert.doesNotMatch(html, /aria-label="Verified physician"/)
})

test('null optional presentation fields never crash or claim verified credentials', () => {
  const html = render({ verification: null, tags: null, imageUrl: null })
  assert.match(html, /Verification unavailable/)
  assert.doesNotMatch(html, /aria-label="Verified physician"/)
  assert.doesNotMatch(html, /Clinical focus/)
})

test('account activity is not proof of clinical verification', () => {
  assert.doesNotMatch(render({ verification: 'Active' }), /aria-label="Verified physician"/)
})

test('account avatars use owned portraits and a named initial fallback without substituting another person', () => {
  const renderAvatar = props => renderToStaticMarkup(React.createElement(ProfileAvatar, props))
  const physician = renderAvatar({name:'Dr. Synthetic Hart',src:'/owned-doctor.png',kind:'doctor',size:36})
  assert.match(physician, /src="\/owned-doctor.png"/)
  assert.match(physician, /aria-label="Dr. Synthetic Hart profile image"/)
  assert.match(physician, /width:36px;height:36px/)
  const patient = renderAvatar({name:'Synthetic Patient',src:null,kind:'patient'})
  assert.match(patient, />SP<\/span>/)
  assert.doesNotMatch(patient, /<img/)
})

test('avatar sources reject mixed-content, executable, credential-bearing and ambiguous URLs', () => {
  for (const source of ['http://unsafe.example/image.png','javascript:alert(1)','data:image/svg+xml,<svg/>','//other.example/image.png','/\\other.example/image.png','https://name:synthetic-secret@example.test/image.png','https://example.test/\nimage.png']) assert.equal(profileImageSource(source),null)
  assert.equal(profileImageSource('/profile-image'),'/profile-image')
  assert.equal(profileImageSource('https://images.example.test/owned.png'),'https://images.example.test/owned.png')
  assert.equal(profileImageSource('data:image/png;base64,c3ludGhldGlj'),'data:image/png;base64,c3ludGhldGlj')
})

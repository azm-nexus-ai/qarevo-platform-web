// German and English message files must offer the same keys, no empty text and the same ICU placeholders (ADR-0002).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = locale => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'messages', `${locale}.json`), 'utf8'))
function flatten(value, prefix = '', out = {}) {
  for (const [key, item] of Object.entries(value)) {
    assert.match(key, /^[A-Za-z][A-Za-z0-9]*$/, `key "${prefix}${key}" must be camelCase without dots or spaces`)
    if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, `${prefix}${key}.`, out)
    else out[prefix + key] = item
  }
  return out
}
// Top-level argument names: {name}, {count, plural, ...}, {mode, select, ...}; nested branch text is ignored.
function argumentsOf(text) {
  const names = new Set()
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) { const match = /^\{\s*([A-Za-z0-9_]+)/.exec(text.slice(i)); if (match) names.add(match[1]) }
      depth++
    } else if (text[i] === '}') depth--
  }
  assert.equal(depth, 0, `unbalanced braces in "${text}"`)
  return [...names].sort()
}

const de = flatten(read('de')), en = flatten(read('en'))

test('German and English have exactly the same keys', () => {
  assert.deepEqual(Object.keys(de).filter(key => !(key in en)), [], 'keys only in de.json')
  assert.deepEqual(Object.keys(en).filter(key => !(key in de)), [], 'keys only in en.json')
})

test('every message is non-empty text', () => {
  for (const [locale, messages] of [['de', de], ['en', en]]) {
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, 'string', `${locale}: ${key} must be a string`)
      assert.ok(value.trim().length > 0, `${locale}: ${key} is empty`)
    }
  }
})

test('both languages use the same placeholders', () => {
  for (const key of Object.keys(en)) {
    if (key in de) assert.deepEqual(argumentsOf(de[key]), argumentsOf(en[key]), `placeholders differ for ${key}`)
  }
})

test('German texts are not left in English', () => {
  // Same text in both files is allowed only for names and codes that do not translate.
  const same = Object.keys(en).filter(key => de[key] === en[key] && /[a-z]{4,}\s[a-z]{3,}/i.test(en[key]))
  assert.deepEqual(same, [], 'untranslated German entries')
})

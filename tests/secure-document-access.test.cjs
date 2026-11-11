const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const target = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('lib/secure-document-access.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { module: target, exports: target.exports, URL, Date, Error, Number })
const { validateDocumentAccess, documentFileSize } = target.exports
const started = 1800000000000
const fileId = 'synthetic-file-id'
const valid = { id: fileId, filename: 'Synthetic result.pdf', content_type: 'application/pdf', file_size_bytes: 1024, download_url: 'https://storage.example.invalid/patient/file?signature=synthetic', expires_in: 300, uploaded_by: 'patient' }

test('authorized result metadata retains exact file identity, provenance and bounded expiry', () => {
  const result = validateDocumentAccess(valid, fileId, started, started + 2500)
  assert.equal(result.fileId, fileId)
  assert.equal(result.filename, valid.filename)
  assert.equal(result.uploadedBy, 'patient')
  assert.equal(result.expiresAt, started + 300000)
  assert.equal(result.fileSizeBytes, 1024)
})

test('document expiry starts with the request and cannot be extended by network latency', () => {
  assert.throws(() => validateDocumentAccess(valid, fileId, started, started + 300000), /expired/)
  for (const expires_in of [0, -1, 301, 1.5, '300', NaN]) assert.throws(() => validateDocumentAccess({ ...valid, expires_in }, fileId, started, started), /could not be verified/)
})

test('untrusted URL schemes, credentials, fragments and raw control characters are refused without echoing the link', () => {
  for (const download_url of ['javascript:alert(1)', 'data:text/html,unsafe', 'http://storage.example.invalid/file', '//storage.example.invalid/file', 'https://user:secret@storage.example.invalid/file', 'https://storage.example.invalid/file#fragment', 'https://storage.example.invalid/file\n?private-token=synthetic', ' https://storage.example.invalid/file']) {
    assert.throws(() => validateDocumentAccess({ ...valid, download_url }, fileId, started, started), error => {
      assert.match(error.message, /could not be verified/)
      assert.doesNotMatch(error.message, /private-token|secret|storage\.example/)
      return true
    })
  }
})

test('a result belonging to a different file, unsafe filename or malformed type is never displayed', () => {
  for (const change of [{ id: 'another-file' }, { filename: '' }, { filename: 'result\r\nprivate.pdf' }, { content_type: 'text/html; injected=1' }, { file_size_bytes: -1 }, { file_size_bytes: NaN }]) {
    assert.throws(() => validateDocumentAccess({ ...valid, ...change }, fileId, started, started), /could not be verified/)
  }
})

test('upload provenance stays factual and absent size is not invented', () => {
  assert.equal(validateDocumentAccess({ ...valid, uploaded_by: 'verified' }, fileId, started, started).uploadedBy, 'unknown')
  assert.equal(validateDocumentAccess({ ...valid, file_size_bytes: undefined }, fileId, started, started).fileSizeBytes, null)
  assert.equal(documentFileSize(null), 'Size unavailable')
  assert.equal(documentFileSize(512), '512 bytes')
  assert.equal(documentFileSize(1024), '1.0 KB')
  assert.equal(documentFileSize(1048576), '1.0 MB')
})


test('trusted patient caller preserves one-hour access while the default doctor policy remains five minutes', () => {
  const patient = { ...valid, expires_in: 3600 }
  const result = validateDocumentAccess(patient, fileId, started, started + 1000, 3600)
  assert.equal(result.expiresAt, started + 3600000)
  assert.throws(() => validateDocumentAccess(patient, fileId, started, started + 1000), /could not be verified/)
  assert.throws(() => validateDocumentAccess({ ...valid, expires_in: 3601 }, fileId, started, started, 3600), /could not be verified/)
  assert.throws(() => validateDocumentAccess(valid, fileId, started, started, 7200), /could not be verified/)
})


test('inline preview MIME selection is finite and independent of card filenames or extensions', () => {
  const { documentPreviewType } = target.exports
  assert.equal(documentPreviewType('application/pdf'), 'pdf')
  for (const type of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) assert.equal(documentPreviewType(type), 'image')
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf; charset=utf-8', 'APPLICATION/PDF', '', null, {}]) assert.equal(documentPreviewType(type), null)
})

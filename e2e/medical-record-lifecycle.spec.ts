import { test, expect, type BrowserContext, type Page, type Request } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const FILE = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', REF = '33333333-3333-4333-8333-333333333333'
const PRIVATE = 'Synthetic patient supplied private document'
const doc = (id = FILE, title = PRIVATE) => ({ id, type: 'Prescription', title, provider: 'Synthetic reported provider', specialty: 'Patient supplied', date: 'Nov 11, 2026', lastUpdated: 'Nov 11, 2026', status: 'Available', fileType: 'PDF', fileSize: '1 KB', canPreview: true, canDownload: true, canDelete: true, uploaded_by: 'patient', is_patient_uploaded: true, is_clinical: false })
function deferred() { let resolve!: () => void; return { promise: new Promise<void>(done => { resolve = done }), release: () => resolve() } }
function field(request: Request, name: string) { const body = request.postDataBuffer()?.toString('utf8') || ''; return new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r\\n]*)').exec(body)?.[1] ?? '' }
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const state = { records: [] as Record<string, unknown>[], uploads: [] as Record<string, string>[], deletes: [] as string[], saved: new Map<string, Record<string, unknown>>(), uploadMode: 'success', deleteMode: 'success', uploadGate: null as ReturnType<typeof deferred> | null, uploadSettled: deferred(), deleteGate: null as ReturnType<typeof deferred> | null, grantError: false, grants: 0 }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(request.headers().authorization).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/medical-records/upload')) {
      const body = Object.fromEntries(['upload_id', 'title', 'record_type', 'description', 'provider_name', 'record_date'].map(name => [name, field(request, name)])); state.uploads.push(body)
      const replayed = state.saved.has(body.upload_id), record = state.saved.get(body.upload_id) || { ...doc(body.upload_id, body.title), type: body.record_type, provider: body.provider_name }
      if (!state.saved.has(body.upload_id)) state.saved.set(body.upload_id, record)
      if (state.uploadMode !== 'unavailable') state.records = [...state.saved.values()]
      try {
        if (state.uploadGate) await state.uploadGate.promise
        if (state.uploadMode === 'lost-ack') return await route.fulfill({ status: 503, headers: { 'X-Request-ID': REF }, json: { detail: 'The saved upload confirmation is temporarily unavailable. Retry the same upload.' } })
        if (state.uploadMode === 'validation') return await route.fulfill({ status: 422, headers: { 'X-Request-ID': REF }, json: { detail: [{ loc: ['body', 'provider_name'], msg: 'Use the reported provider name format.' }] } })
        const available = state.uploadMode !== 'unavailable'
        return await route.fulfill({ json: { id: body.upload_id, filename: 'synthetic.pdf', file_size: 1024, content_type: 'application/pdf', uploaded_at: new Date().toISOString(), upload_receipt: { upload_id: body.upload_id, file_id: state.uploadMode === 'wrong-receipt' ? OTHER : body.upload_id, replayed, available }, record: state.uploadMode === 'wrong-record' ? doc(OTHER) : available ? record : null, message: 'Uploaded' } })
      } finally { state.uploadSettled.release() }
    }
    const deletion = path.match(/\/patient\/medical-records\/([^/]+)$/)
    if (deletion && request.method() === 'DELETE') {
      const id = deletion[1], replayed = !state.records.some(record => record.id === id); state.deletes.push(id); state.records = state.records.filter(record => record.id !== id)
      if (state.deleteGate) await state.deleteGate.promise
      if (state.deleteMode === 'lost-ack') return route.fulfill({ status: 503, headers: { 'X-Request-ID': REF }, json: { detail: 'The removal confirmation is temporarily unavailable.' } })
      if (state.deleteMode === 'denied') return route.fulfill({ status: 403, json: { detail: 'This record cannot be removed by this account.' } })
      return route.fulfill({ json: { message: 'Removed', file_id: state.deleteMode === 'wrong-receipt' ? OTHER : id, deleted: true, replayed } })
    }
    if (path.endsWith('/patient/medical-records')) return route.fulfill({ json: { records: state.records, timeline: [] } })
    if (path.endsWith('/download')) { state.grants++; return route.fulfill({ status: state.grantError ? 503 : 404, headers: { 'X-Request-ID': REF }, json: { detail: 'The file access request is temporarily unavailable.' } }) }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const uploadDialog = (page: Page) => page.getByRole('dialog', { name: 'Upload Medical Record', exact: true })
async function openUpload(page: Page) { await page.goto('/patient/medical-records'); await page.getByRole('button', { name: 'Upload Medical Record', exact: true }).first().click(); return uploadDialog(page) }
async function fillUpload(page: Page) {
  const dialog = uploadDialog(page)
  await dialog.getByLabel('Document Name (Required)', { exact: true }).fill(PRIVATE)
  await dialog.getByLabel('Record Type (Required)', { exact: true }).selectOption('Prescription')
  await dialog.getByLabel('Date of Record (Required)', { exact: true }).fill('2026-11-11')
  await dialog.getByLabel('Provider / Facility (Optional)', { exact: true }).fill('Synthetic reported provider')
  await dialog.getByLabel('Description (Optional)', { exact: true }).fill('Synthetic private description')
  await dialog.getByLabel('Choose medical document', { exact: true }).setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF Synthetic only') })
  return dialog
}
const card = (page: Page) => page.locator('[data-medical-record-id]').filter({ has: page.getByRole('heading', { name: PRIVATE, exact: true }) })
async function openDelete(page: Page) { await page.goto('/patient/medical-records'); await card(page).getByRole('button', { name: 'View Details', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete Record', exact: true }).click(); return page.getByRole('dialog', { name: 'Delete medical record?', exact: true }) }
async function assertNoPrivateStorage(page: Page) { expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Synthetic patient supplied|Synthetic private description|Synthetic reported provider|synthetic\.pdf/); expect(page.url()).not.toContain('Synthetic') }

test('generic upload displays exact validation before sending and preserves canonical patient provenance', async ({ page, context }) => {
  const state = await prepare(context), dialog = await openUpload(page)
  await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click()
  await expect(dialog.getByText('Enter the document name.', { exact: true })).toBeVisible(); await expect(dialog.getByText('Enter a valid date of record (YYYY-MM-DD).', { exact: true })).toBeVisible(); await expect(dialog.getByText('Choose a medical document to upload.', { exact: true })).toBeVisible(); expect(state.uploads).toHaveLength(0)
  await fillUpload(page); await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click()
  await expect(dialog).toHaveCount(0); await expect(card(page).getByText('Patient-supplied document', { exact: true })).toBeVisible(); await expect(card(page).getByText('Reported provider: Synthetic reported provider')).toBeVisible()
  expect(state.uploads[0]).toMatchObject({ title: PRIVATE, record_type: 'Prescription', description: 'Synthetic private description', provider_name: 'Synthetic reported provider', record_date: '2026-11-11' }); expect(state.uploads[0].upload_id).toMatch(/^[a-f0-9-]{36}$/)
  await assertNoPrivateStorage(page)
})
test('a lost upload acknowledgment retains the exact intent and retry confirms one saved file', async ({ page, context }) => {
  const state = await prepare(context); state.uploadMode = 'lost-ack'; const dialog = await openUpload(page); await fillUpload(page)
  await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('confirmation is temporarily unavailable'); await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(REF)
  state.uploadMode = 'success'; await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click(); await expect(dialog).toHaveCount(0)
  expect(state.uploads).toHaveLength(2); expect(state.uploads[1]).toEqual(state.uploads[0]); expect(state.saved.size).toBe(1); await expect(card(page)).toHaveCount(1); await assertNoPrivateStorage(page)
})
for (const mode of ['wrong-receipt', 'wrong-record']) test(`a ${mode} cannot fabricate upload success and unchanged retry recovers`, async ({ page, context }) => {
  const state = await prepare(context); state.uploadMode = mode; const dialog = await openUpload(page); await fillUpload(page); await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('saved upload could not be confirmed'); state.uploadMode = 'success'; await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(state.uploads[1].upload_id).toBe(state.uploads[0].upload_id); expect(state.saved.size).toBe(1)
})
test('changed metadata creates a new intent and 422 errors stay inline with the original field', async ({ page, context }) => {
  const state = await prepare(context); state.uploadMode = 'validation'; const dialog = await openUpload(page); await fillUpload(page); await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click()
  await expect(dialog.locator('#medical-upload-provider_name-error')).toHaveText('Use the reported provider name format.'); await dialog.getByLabel('Document Name (Required)', { exact: true }).fill(PRIVATE + ' changed')
  state.uploadMode = 'success'; await dialog.getByRole('button', { name: 'Upload changed record', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(state.uploads[1].upload_id).not.toBe(state.uploads[0].upload_id); expect(state.uploads[1].title).toBe(PRIVATE + ' changed')
})
test('a deleted earlier upload replay never recreates an Available document', async ({ page, context }) => {
  const state = await prepare(context); state.uploadMode = 'lost-ack'; const dialog = await openUpload(page); await fillUpload(page); await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click(); await expect(dialog.getByRole('button', { name: 'Retry upload', exact: true })).toBeEnabled()
  state.uploadMode = 'unavailable'; state.records = []; await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('status').filter({ hasText: 'has not been restored' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'No medical records yet', exact: true })).toBeVisible(); expect(state.uploads[1].upload_id).toBe(state.uploads[0].upload_id)
})
test('duplicate submissions coalesce and a same-tick query change blocks the stale upload before hashing', async ({ page, context }) => {
  const state = await prepare(context); const dialog = await openUpload(page); await fillUpload(page)
  await page.evaluate(() => { const form = document.querySelector('dialog[open] form') as HTMLFormElement; history.pushState({}, '', '/patient/medical-records?recordId=11111111-1111-4111-8111-111111111111'); form.requestSubmit() })
  await expect(dialog).toHaveCount(0); expect(state.uploads).toHaveLength(0)
  await page.goto('/patient/medical-records'); await page.getByRole('button', { name: 'Upload Medical Record', exact: true }).first().click(); await fillUpload(page); state.uploadGate = deferred()
  await page.evaluate(() => { const form = document.querySelector('dialog[open] form') as HTMLFormElement; form.requestSubmit(); form.requestSubmit() }); await expect.poll(() => state.uploads.length).toBe(1); expect(await uploadDialog(page).getByLabel('Document Name (Required)', { exact: true }).isDisabled()).toBe(true)
  state.uploadGate.release(); await expect(uploadDialog(page)).toHaveCount(0); expect(state.uploads).toHaveLength(1)
})
test('a late upload acknowledgment cannot revive another account or retain clinical drafts', async ({ page, context }) => {
  const state = await prepare(context); state.uploadGate = deferred(); const dialog = await openUpload(page); await fillUpload(page); await dialog.getByRole('button', { name: 'Upload Record', exact: true }).click(); await expect.poll(() => state.uploads.length).toBe(1)
  await page.evaluate(() => { const key = 'qarevo:patient:identity', newValue = JSON.stringify({ user_id: 'other-patient', role: 'PATIENT', session_id: 'other-session' }); localStorage.setItem(key, newValue); window.dispatchEvent(new StorageEvent('storage', { key, newValue })) })
  await expect(page).toHaveURL(/\/auth\/sign-in/); state.uploadGate.release(); await state.uploadSettled.promise; await expect(page.getByRole('dialog', { name: 'Upload Medical Record', exact: true })).toHaveCount(0); await expect(page.getByRole('heading', { name: PRIVATE, exact: true })).toHaveCount(0); await assertNoPrivateStorage(page)
})
test('soft-delete lost acknowledgment retries the exact missing file without resurrection', async ({ page, context }) => {
  const state = await prepare(context); state.records = [doc()]; state.deleteMode = 'lost-ack'; const dialog = await openDelete(page); await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('removal confirmation is temporarily unavailable'); await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(REF)
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); state.deleteMode = 'success'; await dialog.getByRole('button', { name: 'Retry delete', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(card(page)).toHaveCount(0); expect(state.deletes).toEqual([FILE, FILE]); await expect(page.getByRole('status').filter({ hasText: 'already removed' })).toBeVisible()
})
test('a mismatched delete receipt stays recoverable and preview errors retain the support reference', async ({ page, context }) => {
  const state = await prepare(context); state.records = [doc()]; state.deleteMode = 'wrong-receipt'; const dialog = await openDelete(page); await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('removal outcome could not be confirmed'); await expect(card(page)).toHaveCount(1)
  state.deleteMode = 'success'; await dialog.getByRole('button', { name: 'Retry delete', exact: true }).click(); await expect(dialog).toHaveCount(0)
  state.records = [doc(OTHER)]; await page.getByRole('button', { name: 'Refresh records', exact: true }).click(); await card(page).getByRole('button', { name: 'View Details', exact: true }).click(); state.grantError = true; await page.getByRole('dialog').getByRole('button', { name: 'Preview', exact: true }).click(); const preview = page.getByRole('dialog', { name: PRIVATE + ' preview', exact: true }); await expect(preview.getByRole('alert')).toContainText('file access request is temporarily unavailable'); await expect(preview.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(REF)
})
for (const width of [320, 820, 1440]) test(`medical-document upload/delete remain accessible in both themes at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await prepare(context); state.records = [doc()]; await page.setViewportSize({ width, height: 900 }); await page.goto('/patient/medical-records')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); await page.getByRole('button', { name: 'Upload Medical Record', exact: true }).first().click(); const dialog = uploadDialog(page)
    await expect(dialog.getByLabel('Document Name (Required)', { exact: true })).toBeFocused(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`upload-${width}-${theme}.png`), animations: 'disabled' }); await expectEnabledControlContrast(dialog.getByRole('button', { name: 'Upload Record', exact: true })); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await card(page).getByRole('button', { name: 'View Details', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete Record', exact: true }).click(); const remove = page.getByRole('dialog', { name: 'Delete medical record?', exact: true }); await expect(remove.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused(); await expectEnabledControlContrast(remove.getByRole('button', { name: 'Delete', exact: true })); await page.keyboard.press('Escape'); await expect(remove).toHaveCount(0)
  }
})

test('a same-tick route change blocks a stale patient document grant', async ({ page, context }) => {
  const state = await prepare(context); state.records = [doc()]; await page.goto('/patient/medical-records'); const button = card(page).getByRole('button', { name: 'Download ' + PRIVATE, exact: true }); await expect(button).toBeVisible()
  await button.evaluate(element => { history.pushState({}, '', '/patient/medical-records?recordId=22222222-2222-4222-8222-222222222222'); (element as HTMLButtonElement).click() })
  await expect(page.getByRole('dialog', { name: 'Medical record access', exact: true })).toHaveCount(0); expect(state.grants).toBe(0)
})

test('shared attachment access errors preserve the safe support reference without fetching storage', async ({ page, context }) => {
  const state = await prepare(context); state.records = [doc()]; state.grantError = true; await page.goto('/patient/medical-records'); await card(page).getByRole('button', { name: 'Download ' + PRIVATE, exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Medical record access', exact: true }); await expect(dialog.getByRole('alert')).toContainText('file access request is temporarily unavailable'); await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(REF); await expect(dialog.getByRole('link')).toHaveCount(0); expect(state.grants).toBe(1)
})

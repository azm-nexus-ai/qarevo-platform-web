import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const FILE = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', REF = '33333333-3333-4333-8333-333333333333'
const TITLE = 'Synthetic private patient preview', TEXT = 'Synthetic private clinical-text preview'
const record = (id = FILE, fileType = 'PNG') => ({ id, type: 'Medical Document', title: TITLE, provider: 'Synthetic reported provider', specialty: 'Patient supplied', date: 'Nov 11, 2026', status: 'Available', lastUpdated: 'Nov 11, 2026', fileType, fileSize: '1 KB', canPreview: true, canDownload: true, canDelete: true, uploaded_by: 'patient', is_patient_uploaded: true, is_clinical: false })
const clinical = () => ({ id: OTHER, type: 'Prescription', title: 'Synthetic recorded medication', provider: 'Synthetic Clinician', specialty: 'General medicine', date: 'Nov 11, 2026', status: 'Available', lastUpdated: 'Nov 11, 2026', summary: TEXT, sourceType: 'medication', sourceId: OTHER, canPreview: true, canDownload: false, canDelete: false })
function deferred() { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve }), release: () => release() } }
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const state = { records: [record(), clinical()] as Record<string, unknown>[], reads: [] as { id: string; disposition: string }[], storageReads: [] as string[], storageReferers: [] as (string | undefined)[], metadata: {} as Record<string, unknown>, failed: false, inlineHold: null as ReturnType<typeof deferred> | null, inlineSettled: deferred(), listFailed: false }
  await context.route('https://storage.example.invalid/**', route => {
    state.storageReads.push(route.request().url()); state.storageReferers.push(route.request().headers().referer)
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ho4AAAAASUVORK5CYII=', 'base64') })
  })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/medical-records')) return route.fulfill(state.listFailed ? { status: 503, json: { detail: 'Synthetic records are temporarily unavailable.' } } : { json: { records: state.records, timeline: [] } })
    const match = path.match(/\/patient\/medical-records\/([^/]+)\/download$/)
    if (match) {
      const disposition = url.searchParams.get('disposition') || 'attachment'; state.reads.push({ id: match[1], disposition })
      const metadata = { id: match[1], filename: 'synthetic.png', content_type: 'image/png', file_size_bytes: 1024, uploaded_by: 'patient', expires_in: 3600, download_url: `https://storage.example.invalid/${match[1]}?signature=synthetic-private-preview`, ...state.metadata }, failed = state.failed
      try {
        if (disposition === 'inline' && state.inlineHold) await state.inlineHold.promise
        return await route.fulfill(failed ? { status: 503, headers: { 'X-Request-ID': REF }, json: { detail: 'Synthetic preview access is temporarily unavailable.' } } : { json: metadata })
      } finally { if (disposition === 'inline') state.inlineSettled.release() }
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const preview = (page: Page) => page.getByRole('dialog', { name: TITLE + ' preview', exact: true })
const card = (page: Page, title = TITLE) => page.locator('[data-medical-record-id]').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
async function open(page: Page) { await page.goto('/patient/medical-records'); await card(page).getByRole('button', { name: /^Preview/ }).click(); return preview(page) }
async function noPrivateStorage(page: Page) { expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Synthetic private|synthetic-private-preview|storage\.example\.invalid/); expect(page.url()).not.toContain('Synthetic') }

test('exact validated raster preview is explicit, private and preserves text-only clinical previews', async ({ page, context }) => {
  const state = await prepare(context), dialog = await open(page), image = dialog.getByRole('img', { name: TITLE, exact: true })
  await expect(image).toBeVisible(); await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer'); await expect.poll(() => state.storageReads.length).toBe(1); expect(state.storageReferers).toEqual([undefined]); expect(state.reads).toEqual([{ id: FILE, disposition: 'inline' }]); await noPrivateStorage(page)
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(card(page).getByRole('button', { name: 'Preview (PNG)', exact: true })).toBeFocused()
  await card(page, 'Synthetic recorded medication').getByRole('button', { name: 'Preview', exact: true }).click(); const text = page.getByRole('dialog', { name: 'Synthetic recorded medication preview', exact: true }); await expect(text.getByText(TEXT, { exact: true })).toBeVisible(); await expect(text.locator('iframe,img')).toHaveCount(0); expect(state.reads).toHaveLength(1); await noPrivateStorage(page)
})

test('wrong-file, unsafe URL and expired metadata never become an embedded source', async ({ page, context }) => {
  const state = await prepare(context)
  const cases = [{ id: OTHER }, { download_url: 'http://storage.example.invalid/private' }, { download_url: 'javascript:alert(1)' }, { download_url: 'https://user:secret@storage.example.invalid/private' }, { download_url: 'https://storage.example.invalid/private#fragment' }, { download_url: 'https://storage.example.invalid/private\n?token=synthetic' }, { expires_in: 3601 }, { expires_in: 0 }]
  for (const metadata of cases) {
    state.metadata = metadata; await page.goto('/patient/medical-records'); await card(page).getByRole('button', { name: /^Preview/ }).click(); const dialog = preview(page); await expect(dialog.getByRole('alert')).toContainText('could not be verified'); await expect(dialog.locator('iframe,img')).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Retry preview', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  }
  expect(state.storageReads).toHaveLength(0); await noPrivateStorage(page)
})

test('nominal PDF cards never override active MIME and Word files offer explicit attachment recovery', async ({ page, context }) => {
  const state = await prepare(context); state.records = [record(FILE, 'PDF')]
  for (const content_type of ['text/html', 'image/svg+xml', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
    state.metadata = { content_type }; const dialog = await open(page); await expect(dialog.getByRole('status').filter({ hasText: 'cannot be previewed safely' })).toBeVisible(); await expect(dialog.locator('iframe,img')).toHaveCount(0); expect(state.storageReads).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Download', exact: true }).click(); const download = page.getByRole('dialog', { name: 'Medical record access', exact: true }); await expect(download.getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible(); expect(state.storageReads).toHaveLength(0); await download.getByRole('button', { name: 'Close document access', exact: true }).click()
  }
  expect(state.reads.filter(row => row.disposition === 'attachment')).toHaveLength(4)
})

test('preview expiry uses original request start and removes the embedded capability without renewal', async ({ page, context }) => {
  const state = await prepare(context); state.metadata = { expires_in: 2 }; state.inlineHold = deferred(); await page.clock.install(); const dialog = await open(page)
  await expect.poll(() => state.reads.length).toBe(1); await page.clock.fastForward(1500); state.inlineHold.release(); await state.inlineSettled.promise; await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible()
  await page.clock.fastForward(501); await expect(dialog.locator('iframe,img')).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Request fresh preview access', exact: true })).toBeVisible(); expect(state.reads).toHaveLength(1)
  state.inlineHold = null; state.metadata = { expires_in: 3600 }; await dialog.getByRole('button', { name: 'Request fresh preview access', exact: true }).click(); await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible(); expect(state.reads).toHaveLength(2); await noPrivateStorage(page)
})

test('a response already expired in transit has a visible retry and no storage request', async ({ page, context }) => {
  const state = await prepare(context); state.metadata = { expires_in: 2 }; state.inlineHold = deferred(); await page.clock.install(); const dialog = await open(page); await expect.poll(() => state.reads.length).toBe(1); await page.clock.fastForward(2001); state.inlineHold.release(); await state.inlineSettled.promise
  await expect(dialog.getByRole('alert')).toContainText('expired'); await expect(dialog.locator('iframe,img')).toHaveCount(0); expect(state.storageReads).toHaveLength(0); expect(state.reads).toHaveLength(1)
})

test('preview errors retain safe correlation and retry uses fresh authorization', async ({ page, context }) => {
  const state = await prepare(context); state.failed = true; const dialog = await open(page); await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable'); await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(REF); await expect(dialog.locator('iframe,img')).toHaveCount(0)
  state.failed = false; await dialog.getByRole('button', { name: 'Retry preview', exact: true }).click(); await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible(); await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveCount(0); expect(state.reads).toHaveLength(2)
})

test('closed late preview responses cannot replace a later text preview or reopen deleted records', async ({ page, context }) => {
  const state = await prepare(context); state.inlineHold = deferred(); const old = await open(page); await expect.poll(() => state.reads.length).toBe(1); await old.getByRole('button', { name: 'Close preview', exact: true }).click(); await card(page, 'Synthetic recorded medication').getByRole('button', { name: 'Preview', exact: true }).click(); state.inlineHold.release(); await state.inlineSettled.promise
  const text = page.getByRole('dialog', { name: 'Synthetic recorded medication preview', exact: true }); await expect(text.getByText(TEXT, { exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(text.locator('iframe,img')).toHaveCount(0); expect(state.storageReads).toHaveLength(0)
  await text.getByRole('button', { name: 'Close preview', exact: true }).click(); state.inlineHold = null; await card(page).getByRole('button', { name: /^Preview/ }).click(); await expect(preview(page).getByRole('img')).toBeVisible(); state.records = [clinical()]; const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/patient/medical-records'); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await refreshed; await expect(preview(page)).toHaveCount(0); await expect(page.locator('img[src*="synthetic-private-preview"],iframe[src*="synthetic-private-preview"]')).toHaveCount(0)
})

test('same-tick query changes prevent a stale preview request before remount', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/patient/medical-records'); const button = card(page).getByRole('button', { name: /^Preview/ }); await expect(button).toBeVisible(); await button.evaluate(element => { history.pushState({}, '', '/patient/medical-records?recordId=22222222-2222-4222-8222-222222222222'); (element as HTMLButtonElement).click() }); await expect(preview(page)).toHaveCount(0); expect(state.reads).toHaveLength(0); expect(state.storageReads).toHaveLength(0)
})

test('account invalidation discards a held preview and late completion cannot return private content', async ({ page, context }) => {
  const state = await prepare(context); state.inlineHold = deferred(); await open(page); await expect.poll(() => state.reads.length).toBe(1); await page.evaluate(() => { const key = 'qarevo:patient:identity', newValue = JSON.stringify({ user_id: 'other-patient', role: 'PATIENT', session_id: 'other-session' }); localStorage.setItem(key, newValue); window.dispatchEvent(new StorageEvent('storage', { key, newValue })) }); await expect(page).toHaveURL(/\/auth\/sign-in/); state.inlineHold.release(); await state.inlineSettled.promise; await expect(preview(page)).toHaveCount(0); await expect(page.locator('img[src*="synthetic-private-preview"],iframe[src*="synthetic-private-preview"]')).toHaveCount(0); expect(state.storageReads).toHaveLength(0); await noPrivateStorage(page)
})

for (const width of [320, 820, 1440]) test(`safe preview remains usable in both themes at ${width}px`, async ({ page, context }, testInfo) => {
  await prepare(context); await page.setViewportSize({ width, height: 900 }); await page.goto('/patient/medical-records')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); const button = card(page).getByRole('button', { name: 'Preview (PNG)', exact: true }); await button.focus(); await button.press('Enter'); const dialog = preview(page); await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Close preview', exact: true })).toBeFocused(); if (width === 320) await expect.poll(async () => { const panel = await dialog.locator('[data-preview-heading-panel]').boundingBox(), box = await dialog.boundingBox(); return panel && box ? panel.width / box.width : 0 }).toBeGreaterThanOrEqual(.7); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`preview-${width}-${theme}.png`), animations: 'disabled' }); await expectEnabledControlContrast(dialog.getByRole('button', { name: 'Download', exact: true })); await expectEnabledControlContrast(dialog.getByRole('button', { name: 'Close preview', exact: true })); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(button).toBeFocused()
  }
})


test('only exact validated PDF metadata selects the native PDF frame boundary', async ({ page, context }) => {
  const state = await prepare(context); state.records = [record(FILE, 'PDF')]; state.metadata = { content_type: 'application/pdf', filename: 'synthetic.pdf' }; const dialog = await open(page), frame = dialog.locator('iframe')
  await expect(frame).toBeVisible(); await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer'); await expect(frame).not.toHaveAttribute('sandbox'); await expect(frame).toHaveAttribute('src', new RegExp('/' + FILE + '\\?signature=')); await expect(dialog.getByRole('button', { name: 'Download', exact: true })).toBeEnabled(); expect(state.reads).toEqual([{ id: FILE, disposition: 'inline' }])
  // This checks the selected embedding boundary, not native PDF rendering in
  // headless-shell. Full Chrome compatibility is probed separately by the owner.
})

test('focus expiry and canonical capability loss remove ready content without implicit renewal', async ({ page, context }) => {
  const state = await prepare(context); state.metadata = { expires_in: 2 }; await page.clock.install(); const dialog = await open(page); await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible(); const now = await page.evaluate(() => Date.now()); await page.clock.setFixedTime(new Date(now + 2100)); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(dialog.locator('iframe,img')).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Request fresh preview access', exact: true })).toBeVisible(); expect(state.reads).toHaveLength(1)
  state.metadata = { expires_in: 3600 }; await dialog.getByRole('button', { name: 'Request fresh preview access', exact: true }).click(); await expect(dialog.getByRole('img', { name: TITLE, exact: true })).toBeVisible(); state.records = [{ ...record(), canPreview: false, canDownload: false }, clinical()]; const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/patient/medical-records'); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await refreshed; await expect(dialog).toHaveCount(0)
  state.records = [record(), clinical()]; await page.getByRole('button', { name: 'Refresh records', exact: true }).click(); await expect(card(page).getByRole('button', { name: 'Preview (PNG)', exact: true })).toBeVisible(); await expect(dialog).toHaveCount(0); expect(state.reads).toHaveLength(2)
})

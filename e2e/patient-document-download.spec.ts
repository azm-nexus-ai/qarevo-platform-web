import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const fileId = 'synthetic-patient-file'
const makeRecord = (id = fileId, title = 'Synthetic patient report') => ({ id, type: 'Medical Document', title, provider: 'Synthetic care team', specialty: 'General medicine', date: 'Nov 07, 2026', status: 'Available', lastUpdated: 'Nov 07, 2026', fileType: 'PDF', fileSize: '2 KB', canPreview: true, canDownload: true, canDelete: false })
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const state = { records: [makeRecord()] as Record<string, unknown>[], reads: [] as { id: string; disposition: string }[], storageReads: 0, listReads: 0, fail: false, holdInline: false, holdAttachment: false, releaseInline: () => {}, releaseAttachment: () => {}, expires: 3600 }
  await context.route('https://storage.example.invalid/**', route => {
    state.storageReads++
    return route.fulfill({ contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="medical-record.pdf"' }, body: '%PDF-1.4\nSynthetic only\n%%EOF' })
  })
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/medical-records')) { state.listReads++; return route.fulfill({ json: { records: state.records, timeline: [] } }) }
    const match = path.match(/\/patient\/medical-records\/([^/]+)\/download$/)
    if (match) {
      const disposition = url.searchParams.get('disposition') || 'attachment'
      state.reads.push({ id: match[1], disposition })
      if (disposition === 'inline' && state.holdInline) await new Promise<void>(resolve => { state.releaseInline = resolve })
      if (disposition === 'attachment' && state.holdAttachment) await new Promise<void>(resolve => { state.releaseAttachment = resolve })
      if (state.fail && disposition === 'attachment') return route.fulfill({ status: 503, json: { detail: 'Synthetic patient file is temporarily unavailable. Retry document access.' } })
      return route.fulfill({ json: { id: match[1], filename: `${match[1]}.pdf`, content_type: 'application/pdf', file_size_bytes: 2048, uploaded_by: 'patient', download_url: `https://storage.example.invalid/${match[1]}?signature=synthetic-patient-capability`, expires_in: state.expires } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const card = (page: Page, title = 'Synthetic patient report') => page.locator('[data-medical-record-id]').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const access = (page: Page) => page.getByRole('dialog', { name: 'Medical record access', exact: true })

async function openDownload(page: Page) {
  await page.goto('/patient/medical-records')
  await card(page).getByRole('button', { name: 'Download Synthetic patient report', exact: true }).click()
  return access(page)
}

test('patient downloads require an explicit link and the record picker preserves every attachment', async ({ page, context }) => {
  const state = await prepare(context)
  const dialog = await openDownload(page)
  const link = dialog.getByRole('link', { name: 'Download medical record', exact: true })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
  const expiry = await dialog.locator('time').getAttribute('datetime')
  expect(new Date(expiry!).getTime() - Date.now()).toBeGreaterThan(3500000)
  expect(state.reads).toEqual([{ id: fileId, disposition: 'attachment' }]); expect(state.storageReads).toBe(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('synthetic-patient-capability')
  await link.click(); await expect.poll(() => state.storageReads).toBe(1)
  await dialog.getByRole('button', { name: 'Close document access', exact: true }).click()
  state.records.push(makeRecord('synthetic-second-file', 'Synthetic second document'))
  await page.getByRole('button', { name: 'Refresh records', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic second document', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Choose a record to download', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a record to download', exact: true })
  await expect(picker.getByRole('button', { name: /Synthetic patient report/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /Synthetic second document/ })).toBeVisible()
  expect(state.reads).toHaveLength(1)
  await picker.getByRole('button', { name: /Synthetic second document/ }).click()
  await expect(access(page).getByText('synthetic-second-file.pdf', { exact: true })).toBeVisible()
  expect(state.reads.at(-1)).toEqual({ id: 'synthetic-second-file', disposition: 'attachment' })
})

test('a late preview cannot reopen or stack dialogs after patient download starts', async ({ page, context }) => {
  const state = await prepare(context); state.holdInline = true
  await page.goto(`/patient/medical-records?recordId=${fileId}`)
  await page.getByRole('dialog').getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Synthetic patient report preview', exact: true })
  await expect(preview).toBeVisible()
  await expect.poll(() => state.reads.filter(item => item.disposition === 'inline').length).toBe(1)
  await preview.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(access(page).getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible()
  const returned = page.waitForResponse(response => response.url().includes(`/medical-records/${fileId}/download?disposition=inline`))
  state.releaseInline(); await returned
  const reads = state.listReads
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/patient/medical-records')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => state.listReads).toBeGreaterThan(reads)
  await refreshed
  await expect(page.getByRole('button', { name: 'Refresh records', exact: true })).toBeEnabled()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(preview).toHaveCount(0)
  await access(page).getByRole('button', { name: 'Close document access', exact: true }).click()
  await expect(card(page).getByRole('button', { name: 'Download Synthetic patient report', exact: true })).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('patient download errors retry correctly and a closed late response cannot revive removed records', async ({ page, context }) => {
  const state = await prepare(context); state.fail = true
  const dialog = await openDownload(page)
  await expect(dialog.getByRole('alert')).toContainText('Synthetic patient file is temporarily unavailable')
  await expect(dialog.getByRole('link')).toHaveCount(0)
  state.fail = false
  await dialog.getByRole('button', { name: 'Retry document access', exact: true }).click()
  await expect(dialog.getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close document access', exact: true }).click()
  state.holdAttachment = true
  await card(page).getByRole('button', { name: 'Download Synthetic patient report', exact: true }).click()
  await expect.poll(() => state.reads.length).toBe(3)
  await access(page).getByRole('button', { name: 'Close document access', exact: true }).click()
  state.records = []
  await page.getByRole('button', { name: 'Refresh records', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No medical records yet', exact: true })).toBeVisible()
  const returned = page.waitForResponse(response => response.url().includes(`/medical-records/${fileId}/download?disposition=attachment`))
  state.releaseAttachment(); await returned
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.storageReads).toBe(0)
})

test('patient link expiry removes the capability and refreshes authorization on request', async ({ page, context }) => {
  const state = await prepare(context); state.expires = 2
  await page.clock.install()
  const dialog = await openDownload(page)
  await expect(dialog.getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible()
  await page.clock.fastForward(2001)
  await expect(dialog.getByRole('link')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Request fresh access', exact: true }).click()
  await expect(dialog.getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible()
  expect(state.reads).toHaveLength(2); expect(state.storageReads).toBe(0)
})

test('patient document access stays responsive and keyboard accessible in mobile dark mode', async ({ page, context }) => {
  await prepare(context)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/patient/medical-records')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const download = card(page).getByRole('button', { name: 'Download Synthetic patient report', exact: true })
  await download.focus(); await expect(download).toBeFocused(); await download.press('Enter')
  await expect(access(page).getByRole('link', { name: 'Download medical record', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(download).toBeFocused()
})

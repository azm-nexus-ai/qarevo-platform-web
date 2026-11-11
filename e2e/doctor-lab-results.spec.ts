import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const labOrder = (patient: string) => ({ id: `${patient}-order`, patient_id: patient, title: `${patient === 'synthetic-alpha' ? 'Alpha' : 'Beta'} laboratory request`, status: 'Results Available', priority: 'Routine', result_file_id: `${patient}-file`, result_filename: `${patient}-result.pdf` })
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const state = { metadata: 0, storageReads: 0, fail: false, hold: false, release: () => {}, url: 'https://storage.example.invalid/synthetic-result?signature=synthetic-document-capability', expires: 300, missingFile: false }
  await context.route('https://storage.example.invalid/**', route => {
    state.storageReads++
    return route.fulfill({ contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="synthetic-result.pdf"' }, body: '%PDF-1.4\nSynthetic test document only\n%%EOF' })
  })
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician', specialty: 'General practice' } })
    if (path.endsWith('/security')) return route.fulfill({ json: { password_change_available: true, mfa: { available: false, enabled: false, method: null, message: 'Unavailable in this synthetic test.' }, sessions: [], sessions_total: 0 } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const url = new URL(route.request().url()), body = path.endsWith('/search') ? route.request().postDataJSON() : null, id = body?.patient_id || url.searchParams.get('patient_id'), size = Number(body?.page_size || url.searchParams.get('page_size') || 25)
      const patients = [{ patient_id: 'synthetic-alpha', name: 'Synthetic Alpha' }, { patient_id: 'synthetic-beta', name: 'Synthetic Beta' }].filter(patient => !id || patient.patient_id === id)
      return route.fulfill({ json: { patients, total_count: 2, filtered_count: patients.length, page: 1, page_size: size, has_next: false, has_previous: false } })
    }
    const result = path.match(/\/doctor\/lab-orders\/([^/]+)\/([^/]+)\/result$/)
    if (result) {
      state.metadata++
      if (state.hold) await new Promise<void>(resolve => { state.release = resolve })
      if (state.fail) return route.fulfill({ status: 503, json: { detail: 'Synthetic document storage is unavailable. Retry access.' } })
      return route.fulfill({ json: { id: `${result[1]}-file`, filename: `${result[1]}-result.pdf`, content_type: 'application/pdf', file_size_bytes: 2048, download_url: state.url, expires_in: state.expires, uploaded_by: 'patient' } })
    }
    const list = path.match(/\/doctor\/lab-orders\/([^/]+)$/)
    if (list) return route.fulfill({ json: { test_requests: [{ ...labOrder(list[1]), ...(state.missingFile ? { result_file_id: null, result_filename: null } : {}) }] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

async function openAlpha(page: import('@playwright/test').Page) {
  await page.goto('/doctor/lab-orders')
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Open result for Alpha laboratory request', exact: true }).click()
  return page.getByRole('dialog', { name: 'Lab result access', exact: true })
}

for (const width of [320, 1440]) {
  test(`clinician result access is explicit, scoped and responsive in both themes at ${width}px`, async ({ page, context }) => {
    const state = await prepare(context)
    await page.setViewportSize({ width, height: 900 })
    let dialog = await openAlpha(page)
    const link = dialog.getByRole('link', { name: 'Download lab result', exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect(link).toHaveAttribute('href', state.url)
    await expect(dialog.getByText('Uploaded by patient', { exact: true })).toBeVisible()
    await expect(dialog.getByText('application/pdf · 2.0 KB', { exact: true })).toBeVisible()
    expect(state.metadata).toBe(1); expect(state.storageReads).toBe(0)
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('synthetic-document-capability')
    expect(new URL(page.url()).search).toBe('')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open result for Alpha laboratory request', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Open result for Alpha laboratory request', exact: true }).press('Enter')
    dialog = page.getByRole('dialog', { name: 'Lab result access', exact: true })
    await expect(dialog.getByRole('link', { name: 'Download lab result', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await dialog.getByRole('link', { name: 'Download lab result', exact: true }).click()
    await expect.poll(() => state.storageReads).toBe(1)
  })
}

test('unavailable result access retries the operation and never displays a premature link', async ({ page, context }) => {
  const state = await prepare(context); state.fail = true
  const dialog = await openAlpha(page)
  await expect(dialog.getByRole('alert')).toContainText('Synthetic document storage is unavailable')
  await expect(dialog.getByRole('link')).toHaveCount(0)
  state.fail = false
  await dialog.getByRole('button', { name: 'Retry document access', exact: true }).click()
  await expect(dialog.getByRole('link', { name: 'Download lab result', exact: true })).toBeVisible()
  expect(state.metadata).toBe(2); expect(state.storageReads).toBe(0)
})

test('unsafe document URLs are rejected without automatic navigation or token disclosure', async ({ page, context }) => {
  const state = await prepare(context); state.url = 'javascript:alert("synthetic-secret")'
  const dialog = await openAlpha(page)
  await expect(dialog.getByRole('alert')).toContainText('Document access could not be verified')
  await expect(dialog.getByRole('link')).toHaveCount(0)
  await expect(dialog).not.toContainText('synthetic-secret')
  expect(state.storageReads).toBe(0)
})

test('expired result links disappear and require a fresh authorized request', async ({ page, context }) => {
  const state = await prepare(context)
  await page.clock.install()
  const dialog = await openAlpha(page)
  await expect(dialog.getByRole('link', { name: 'Download lab result', exact: true })).toBeVisible()
  await page.clock.fastForward(300001)
  await expect(dialog.getByRole('link')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Request fresh access', exact: true }).click()
  await expect(dialog.getByRole('link', { name: 'Download lab result', exact: true })).toBeVisible()
  expect(state.metadata).toBe(2); expect(state.storageReads).toBe(0)
})

test('closing a pending result and changing patients cannot reopen the previous result', async ({ page, context }) => {
  const state = await prepare(context); state.hold = true
  const dialog = await openAlpha(page)
  await expect(dialog.getByRole('status')).toHaveText('Preparing document access…')
  await expect.poll(() => state.metadata).toBe(1)
  await dialog.getByRole('button', { name: 'Close document access', exact: true }).click()
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-beta')
  await expect(page.getByRole('heading', { name: 'Beta laboratory request', exact: true })).toBeVisible()
  const returned = page.waitForResponse(response => response.url().endsWith('/synthetic-alpha/synthetic-alpha-order/result'))
  state.release(); await returned
  await expect(page.getByRole('dialog', { name: 'Lab result access', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Download lab result', exact: true })).toHaveCount(0)
  expect(state.storageReads).toBe(0)
})

test('a same-tick identity change blocks a previously issued link before event cleanup', async ({ page, context }) => {
  const state = await prepare(context)
  const dialog = await openAlpha(page)
  const link = dialog.getByRole('link', { name: 'Download lab result', exact: true })
  await expect(link).toBeVisible()
  const prevented = await link.evaluate(anchor => {
    const identity = JSON.parse(localStorage.getItem('qarevo:doctor:identity') || '{}')
    localStorage.setItem('qarevo:doctor:identity', JSON.stringify({ ...identity, user_id: 'synthetic-next-doctor', session_id: 'synthetic-next-session' }))
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(page.getByRole('link', { name: 'Download lab result', exact: true })).toHaveCount(0)
  expect(state.storageReads).toBe(0)
})

test('requests without an attached result have an honest empty state and no access action', async ({ page, context }) => {
  const state = await prepare(context); state.missingFile = true
  await page.goto('/doctor/lab-orders')
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await expect(page.getByText('No result file available.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Open result for/ })).toHaveCount(0)
  expect(state.metadata).toBe(0)
})


test('a same-tick session change cannot retry access for the previous patient and order', async ({ page, context }) => {
  const state = await prepare(context); state.fail = true
  const dialog = await openAlpha(page)
  await expect(dialog.getByRole('alert')).toContainText('Synthetic document storage is unavailable')
  await dialog.getByRole('button', { name: 'Retry document access', exact: true }).evaluate(button => {
    const identity = JSON.parse(localStorage.getItem('qarevo:doctor:identity') || '{}')
    localStorage.setItem('qarevo:doctor:identity', JSON.stringify({ ...identity, user_id: 'synthetic-next-doctor', session_id: 'synthetic-next-session' }))
    ;(button as HTMLButtonElement).click()
  })
  await expect(page.getByRole('dialog', { name: 'Lab result access', exact: true })).toHaveCount(0)
  expect(state.metadata).toBe(1); expect(state.storageReads).toBe(0)
})

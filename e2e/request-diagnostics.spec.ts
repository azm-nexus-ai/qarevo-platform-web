import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming, type TestPortal } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222'
const routes = { patient: '/patient/prescription-care-plan', doctor: '/doctor/prescriptions', admin: '/admin/audit' }
const retryNames = { patient: 'Try again', doctor: 'Retry patients', admin: 'Retry clinical access' }
async function prepare(context: BrowserContext, portal: TestPortal) {
  const identity = await seedPortalSession(context, portal), state = { failed: true, requestId: first, reads: 0, raw: false, held: false, started: false, delivery: Promise.resolve(), release: () => {} }
  await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as unknown as { copiedReference: string }).copiedReference = value } } }) })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    const targeted = portal === 'patient' && path.endsWith('/patient/prescription-care-plan') || portal === 'doctor' && path.endsWith('/doctor/patients/search') || portal === 'admin' && path.endsWith('/audit-logs/clinical-access')
    if (targeted) {
      state.reads++; const failed = state.failed, requestId = state.requestId, raw = state.raw
      let delivered: (() => void) | undefined
      if (state.held) { state.held = false; state.delivery = new Promise<void>(resolve => { delivered = resolve }); state.started = true; await new Promise<void>(resolve => { state.release = resolve }) }
      try {
        if (failed) return await route.fulfill({ status: 503, headers: { 'X-Request-ID': requestId }, ...(raw ? { contentType: 'text/html', body: '<html>Synthetic private clinical sentinel https://private.invalid Traceback</html>' } : { json: { detail: 'Synthetic service temporarily unavailable', request_id: 'forged-body-reference' } }) })
        const success = portal === 'patient' ? { medications: [], care_plans: [] } : portal === 'doctor' ? { patients: [], total_count: 0, filtered_count: 0, page: 1, page_size: 25, has_next: false, has_previous: false } : { can_view: true, events: [], total_count: 0, limit: 25, offset: 0, has_next: false, has_previous: false }
        return await route.fulfill({ headers: { 'X-Request-ID': requestId }, json: success })
      } finally { delivered?.() }
    }
    if (path.endsWith('/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/audit-logs/summary/actions')) return route.fulfill({ json: { actions: [] } })
    if (path.endsWith('/audit-logs')) return route.fulfill({ json: { logs: [], total: 0, limit: 25, offset: 0 } })
    return route.fulfill({ json: {} })
  })
  return state
}
const support = (page: Page) => page.getByRole('group', { name: 'Support reference', exact: true })
for (const portal of ['patient', 'doctor', 'admin'] as const) test(`${portal}: safe error reference copies only the UUID and retries replace it with the latest failed request`, async ({ page, context }) => {
  const state = await prepare(context, portal); await page.goto(routes[portal]); await expect(support(page).getByLabel('Support reference', { exact: true })).toHaveValue(first)
  const copy = support(page).getByRole('button', { name: 'Copy support reference', exact: true }); await copy.focus(); await page.keyboard.press('Enter'); await expect(support(page).getByRole('status')).toHaveText('Support reference copied.')
  expect(await page.evaluate(() => (window as unknown as { copiedReference: string }).copiedReference)).toBe(first)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(first)
  state.requestId = second; state.held = true; await page.getByRole('button', { name: retryNames[portal], exact: true }).click(); await expect.poll(() => state.started).toBe(true); await expect(support(page)).toHaveCount(0)
  state.release(); await state.delivery; await expect(support(page).getByLabel('Support reference', { exact: true })).toHaveValue(second); await expect(support(page).getByRole('status')).toBeEmpty()
  state.failed = false; await page.getByRole('button', { name: retryNames[portal], exact: true }).click(); await expect(support(page)).toHaveCount(0)
  if (portal === 'patient') await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toBeVisible()
  else if (portal === 'doctor') await expect(page.getByRole('status').filter({ hasText: 'No assigned patients are available' })).toBeVisible()
  else await expect(page.getByRole('heading', { name: 'No access links recorded', exact: true })).toBeVisible()
  expect(state.reads).toBe(3)
})

test('HTML/stack payloads and invalid request headers never become support copy or visible error content', async ({ page, context }) => {
  const state = await prepare(context, 'patient'); state.raw = true; state.requestId = 'https://private.invalid/clinical'
  await page.goto(routes.patient); await expect(page.getByRole('alert').filter({ hasText: 'The service returned an unexpected response. Please retry.' })).toBeVisible(); await expect(support(page)).toHaveCount(0)
  await expect(page.getByText('Synthetic private clinical sentinel', { exact: false })).toHaveCount(0); await expect(page.locator('a[href^="https://private.invalid"]')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic private clinical sentinel')
})

test('clipboard denial offers keyboard selection without claiming a successful copy', async ({ page, context }) => {
  await prepare(context, 'patient'); await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Synthetic clipboard permission denied') } } }))
  await page.goto(routes.patient); await support(page).getByRole('button', { name: 'Copy support reference', exact: true }).click(); const input = support(page).getByLabel('Support reference', { exact: true }); await expect(input).toBeFocused(); await expect(support(page).getByRole('status')).toContainText('copy it using your keyboard or device menu')
  expect(await input.evaluate(element => [(element as HTMLInputElement).selectionStart, (element as HTMLInputElement).selectionEnd])).toEqual([0, 36])
})

test('a changed patient identity prevents stale copying and removes the previous request reference', async ({ page, context }) => {
  await prepare(context, 'patient'); await page.goto(routes.patient); const copy = support(page).getByRole('button', { name: 'Copy support reference', exact: true }); await expect(copy).toBeVisible()
  await copy.evaluate(button => { const key = 'qarevo:patient:identity', value = JSON.stringify({ user_id: 'different-patient', role: 'PATIENT', session_id: 'different-session' }); localStorage.setItem(key, value); (button as HTMLElement).click(); dispatchEvent(new StorageEvent('storage', { key, newValue: value })) })
  await expect(support(page)).toHaveCount(0); expect(await page.evaluate(() => (window as unknown as { copiedReference?: string }).copiedReference)).toBeUndefined()
})

for (const portal of ['patient', 'doctor', 'admin'] as const) for (const width of [320, 1440]) test(`${portal}: support references are keyboard accessible and theme compatible at ${width}px`, async ({ page, context }, testInfo) => {
  await prepare(context, portal); await page.setViewportSize({ width, height: 900 }); await page.goto(routes[portal]); await expect(support(page)).toBeVisible()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); const copy = support(page).getByRole('button', { name: 'Copy support reference', exact: true }); await copy.focus(); await expect(copy).toBeFocused(); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath(`request-reference-${portal}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' }); await expectEnabledControlContrast(copy); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

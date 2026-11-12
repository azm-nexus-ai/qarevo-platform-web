import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { expectEnabledControlContrast } from './helpers/contrast'

const consultationId = '88888888-8888-4888-8888-888888888888'
const readReference = 'a1111111-1111-4111-8111-111111111111'
const retryReference = 'a2222222-2222-4222-8222-222222222222'
const path = '/api/v1/admin/workflow-delivery'
function job(index = 0) {
  return { consultation_id: index ? index.toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111' : consultationId,
    attempts: 1, last_error_code: 'HTTP_503', next_attempt_at: '2030-07-10T08:00:00Z' }
}
const card = (page: Page) => page.getByRole('region', { name: 'Clinical workflow delivery', exact: true })
const queuePage = (page: Page) => card(page).getByRole('status', { name: 'Workflow queue page', exact: true })

async function prepare(context: BrowserContext, page: Page, canRetry = true) {
  const identity = await seedPortalSession(context, 'admin', { user_id: 'synthetic-admin' })
  const patientIdentity = await seedPortalSession(context, 'patient')
  const state = { identity, patientIdentity, canRetry, jobs: [job()], failRetry: true, failLoad: false, disabled: false, legacy: false,
    invalidRead: false, invalidRetry: false, retryStatus: 503, retryResult: { delivered: 1, failed: 0, status: 'delivered' },
    offsets: [] as number[], retries: [] as string[], renewals: 0,
    holdRead: false, readStarted: false, readDelivery: Promise.resolve(), releaseRead: () => {},
    holdRetry: false, retryStarted: false, retryDelivery: Promise.resolve(), releaseRetry: () => {} }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname
    expect(request.headers()['authorization']).toBeUndefined()
    if (endpoint.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (endpoint === '/api/v1/auth/refresh') { state.renewals++; return route.fulfill({ status: 401, json: { detail: 'Synthetic old session expired.' } }) }
    if (endpoint.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(request.headers()['x-qarevo-portal'] === 'patient' ? state.patientIdentity : state.identity) })
    if (endpoint.startsWith(path + '/') && endpoint.endsWith('/retry')) {
      expect(request.method()).toBe('POST')
      expect(request.headers()['x-qarevo-portal']).toBe('admin')
      expect(request.headers()['x-qarevo-session']).toBe(state.identity.session_id)
      state.retries.push(endpoint)
      const failed = state.failRetry, status = failed ? state.retryStatus : 200
      const body = failed ? { detail: 'Synthetic clinical service unavailable. The update remains pending.' } : state.invalidRetry ? { status: 'unknown', delivered: 1, failed: 0 } : { ...state.retryResult }
      if (!failed && !state.invalidRetry && ['delivered', 'already_delivered'].includes(state.retryResult.status)) {
        state.jobs = state.jobs.filter(item => endpoint !== path + '/' + item.consultation_id + '/retry')
      }
      let delivered: (() => void) | undefined
      if (state.holdRetry) {
        state.holdRetry = false; state.retryStarted = true
        state.retryDelivery = new Promise<void>(resolve => { delivered = resolve })
        await new Promise<void>(resolve => { state.releaseRetry = resolve })
      }
      try { return await route.fulfill({ status, headers: { 'X-Request-ID': retryReference }, json: body }) } finally { delivered?.() }
    }
    if (endpoint === path) {
      expect(request.headers()['x-qarevo-portal']).toBe('admin')
      const requested = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 25)
      state.offsets.push(requested)
      const sorted = state.disabled ? [] : [...state.jobs].sort((a, b) => a.next_attempt_at.localeCompare(b.next_attempt_at) || a.consultation_id.localeCompare(b.consultation_id))
      const total = sorted.length, offset = requested >= total ? Math.max(0, Math.floor((total - 1) / limit) * limit) : requested
      const status = state.failLoad ? 503 : 200
      const body = state.failLoad ? { detail: 'Synthetic delivery status unavailable.' } : state.invalidRead ? { status: 'healthy', jobs: 'invalid' } : {
        status: state.disabled ? 'disabled' : total ? 'warning' : 'healthy',
        pending_count: total, failed_count: sorted.filter(item => item.last_error_code !== null).length,
        can_retry: !state.disabled && state.canRetry, automatic_delivery: !state.disabled,
        jobs: sorted.slice(offset, offset + limit),
        ...(state.legacy ? {} : { limit, offset, total_count: total, has_next: offset + limit < total, has_previous: offset > 0 }),
      }
      let delivered: (() => void) | undefined
      if (state.holdRead) {
        state.holdRead = false; state.readStarted = true
        state.readDelivery = new Promise<void>(resolve => { delivered = resolve })
        await new Promise<void>(resolve => { state.releaseRead = resolve })
      }
      try { return await route.fulfill({ status, headers: { 'X-Request-ID': readReference }, json: body }) } finally { delivered?.() }
    }
    if (endpoint.endsWith('/clinical-notification-delivery')) return route.fulfill({ json: { status: 'disabled', jobs: [], pending_count: 0, failed_count: 0, exhausted_count: 0, can_retry: false, automatic_delivery: false, limit: 25, offset: 0, total_count: 0, has_next: false, has_previous: false } })
    if (endpoint.endsWith('/overview')) return route.fulfill({ json: { patients: { total: 1 }, doctors: { total: 1, verified: 0, pending_verification: 1 }, users: { total: 3 }, exceptions: { active: 0 }, generated_at: '2030-07-10T08:00:00Z' } })
    if (endpoint.endsWith('/activity')) return route.fulfill({ json: { period_days: 7, date_from: '2030-07-03', date_to: '2030-07-10', new_patients: 1, new_doctors: 1, new_exceptions: 0 } })
    if (endpoint.endsWith('/health')) return route.fulfill({ json: { status: 'warning', pending_verifications: 1, critical_exceptions: 0, high_exceptions: 0, generated_at: '2030-07-10T08:00:00Z' } })
    if (endpoint.endsWith('/doctors-summary')) return route.fulfill({ json: { total: 1, verified: 0, pending: 1, by_specialty: {} } })
    if (endpoint.endsWith('/patients-summary')) return route.fulfill({ json: { total: 1, new_last_7_days: 1 } })
    if (endpoint.endsWith('/patients')) return route.fulfill({ json: { patients: [], total: 0, limit: 50, offset: 0 } })
    if (endpoint.endsWith('/patient/dashboard')) return route.fulfill({ json: { summary_cards: [], notifications: [], timeline_items: [], care_plans: [], medications: [] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  await page.goto('/admin/dashboard')
  return state
}

test('operator sees failed delivery and recovers exactly one consultation', async ({ page, context }) => {
  const state = await prepare(context, page)
  await expect(card(page).getByText('Updates pending', { exact: true })).toBeVisible()
  await card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }).click()
  await expect(card(page).getByRole('alert')).toContainText('Synthetic clinical service unavailable')
  await expect(card(page).getByRole('group', { name: 'Support reference' })).toContainText('Support reference')
  await expect(card(page).getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(retryReference)
  await expect(card(page).getByText('Updates pending', { exact: true })).toBeVisible()
  await expect(card(page).getByRole('button', { name: 'Refresh delivery status' })).toBeEnabled()
  state.failRetry = false
  await card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }).click()
  await expect(card(page).getByRole('status').filter({ hasText: 'update is confirmed' })).toBeVisible()
  await expect(card(page).getByText('Up to date', { exact: true })).toBeVisible()
  expect(state.retries).toEqual(Array(2).fill(path + '/' + consultationId + '/retry'))
  await page.reload()
  await expect(card(page).getByText('Up to date', { exact: true })).toBeVisible()
  await expect(card(page).getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
})

test('read-only operator has responsive dark-mode visibility without retry authority', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await prepare(context, page, false)
  await expect(card(page).getByText('Operations access required to retry.')).toBeVisible()
  await expect(card(page).getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(card(page).getByText('HTTP_503', { exact: true })).toBeVisible()
})

test('status outage, malformed response and disabled delivery never appear as a healthy empty queue', async ({ page, context }) => {
  const state = await prepare(context, page)
  await expect(card(page).getByText('Updates pending', { exact: true })).toBeVisible()
  state.failLoad = true
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).getByRole('alert')).toContainText('Synthetic delivery status unavailable')
  await expect(card(page).getByRole('group', { name: 'Support reference' })).toBeVisible()
  await expect(card(page).getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(readReference)
  await expect(card(page).getByText('Up to date', { exact: true })).toHaveCount(0)
  state.failLoad = false; state.invalidRead = true
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).getByRole('alert')).toContainText('invalid response')
  await expect(card(page).getByText('Up to date', { exact: true })).toHaveCount(0)
  state.invalidRead = false; state.disabled = true
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).getByText('Not enabled', { exact: true })).toBeVisible()
  await expect(card(page).getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
})

test('older tied queue entries are bounded, retry only the selected consultation and reset with feedback', async ({ page, context }) => {
  const state = await prepare(context, page)
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(25)
  await expect(card(page)).toContainText('26 pending · 26 needing attention')
  await card(page).getByRole('button', { name: 'Next pending updates', exact: true }).click()
  await expect(queuePage(page)).toHaveText('Page 2')
  await expect(queuePage(page)).toBeFocused()
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(1)
  await expect(card(page)).toContainText('Showing 26–26 of 26 pending updates.')
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(queuePage(page)).toHaveText('Page 2')
  expect(state.offsets.at(-1)).toBe(25)
  state.failRetry = false
  await card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }).click()
  await expect(queuePage(page)).toHaveText('Page 1')
  await expect(card(page)).toContainText('Review the refreshed first page before selecting another update.')
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(25)
  await expect(card(page).locator('[data-workflow-consultation="' + consultationId + '"]')).toHaveCount(0)
  expect(state.offsets.at(-1)).toBe(0)
  expect(state.retries).toEqual([path + '/' + consultationId + '/retry'])
  expect(new URL(page.url()).search).toBe('')
})

test('page read retry stays on its offset and concurrent queue shrink safely adopts the first page', async ({ page, context }) => {
  const state = await prepare(context, page)
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).getByRole('button', { name: 'Next pending updates' })).toBeEnabled()
  state.failLoad = true
  await card(page).getByRole('button', { name: 'Next pending updates' }).click()
  await expect(card(page).getByRole('alert')).toContainText('Synthetic delivery status unavailable')
  state.failLoad = false
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(queuePage(page)).toHaveText('Page 2')
  expect(state.offsets.at(-1)).toBe(25)
  state.jobs = [job(1)]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(queuePage(page)).toHaveText('Page 1')
  await expect(card(page)).toContainText('The pending queue changed. Showing the nearest available page.')
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(1)
  expect(state.offsets.at(-1)).toBe(0)
})

test('an older-row retry failure resets the queue and requires explicit reselection', async ({ page, context }) => {
  const state = await prepare(context, page)
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await card(page).getByRole('button', { name: 'Next pending updates' }).click()
  await card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }).click()
  await expect(card(page).getByRole('alert')).toContainText('Synthetic clinical service unavailable')
  await expect(queuePage(page)).toHaveText('Page 1')
  await expect(card(page)).toContainText('Review the refreshed first page before selecting another update.')
  await expect(card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId })).toHaveCount(0)
  expect(state.offsets.at(-1)).toBe(0)
  expect(state.retries).toEqual([path + '/' + consultationId + '/retry'])
})

test('same-tick page navigation cannot retry a row from the obsolete page', async ({ page, context }) => {
  const state = await prepare(context, page)
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(25)
  state.holdRead = true
  await card(page).evaluate(section => {
    const next = [...section.querySelectorAll('button')].find(button => button.textContent === 'Next pending updates')!
    const oldRetry = section.querySelector('[data-workflow-consultation] button') as HTMLButtonElement
    next.click(); oldRetry.click()
  })
  await expect.poll(() => state.readStarted).toBe(true)
  await expect(card(page).getByRole('button', { name: 'Previous pending updates' })).toBeDisabled()
  state.releaseRead(); await state.readDelivery
  await expect(queuePage(page)).toHaveText('Page 2')
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(1)
  expect(state.retries).toHaveLength(0)
})

test('authoritative retry status overrides a dispatch count and malformed retries never claim confirmation', async ({ page, context }) => {
  const state = await prepare(context, page); state.failRetry = false
  state.retryResult = { status: 'retry_pending', delivered: 1, failed: 0 }
  const retry = card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId })
  await retry.click()
  await expect(card(page).getByRole('alert')).toContainText('The update is still pending.')
  await expect(card(page).getByText('The clinical workflow update is confirmed.', { exact: true })).toHaveCount(0)
  await expect(retry).toBeEnabled()
  state.invalidRetry = true
  await retry.click()
  await expect(card(page).getByRole('alert')).toContainText('invalid response')
  await expect(card(page).getByText('The clinical workflow update is confirmed.', { exact: true })).toHaveCount(0)
  await expect(retry).toBeEnabled()
  state.invalidRetry = false; state.retryResult = { status: 'delivered', delivered: 0, failed: 0 }
  await retry.click()
  await expect(card(page).getByText('The clinical workflow update is confirmed.', { exact: true })).toBeVisible()
  await expect(card(page).getByText('Up to date', { exact: true })).toBeVisible()
  expect(state.retries).toHaveLength(3)
})

test('legacy responses state the first-page limit without inventing queue navigation', async ({ page, context }) => {
  const state = await prepare(context, page); state.legacy = true
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(25)
  await expect(card(page)).toContainText('Only the first 25 pending updates are available in this response. Queue pagination could not be confirmed.')
  await expect(card(page).getByRole('navigation', { name: 'Workflow delivery pages' })).toHaveCount(0)
})

for (const change of ['actor', 'role', 'route'] as const) test('late queue reads cannot cross a changed ' + change, async ({ page, context }) => {
  const state = await prepare(context, page)
  await expect(card(page).getByText('Updates pending', { exact: true })).toBeVisible()
  state.holdRead = true
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect.poll(() => state.readStarted).toBe(true)
  const completed = state.readDelivery
  if (change === 'route') await page.goto('/admin/patients')
  else {
    state.identity = { ...state.identity, user_id: change === 'actor' ? 'synthetic-other-admin' : state.identity.user_id, role: change === 'role' ? 'PATIENT' : 'ADMIN', session_id: 'synthetic-changed-session' }
    await page.evaluate(identity => { const key = 'qarevo:admin:identity', value = JSON.stringify(identity); localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }, state.identity)
  }
  await expect(card(page)).toHaveCount(0)
  state.releaseRead(); await completed
  await expect(page.getByText('The clinical workflow update is confirmed.', { exact: true })).toHaveCount(0)
  await expect(card(page).locator('[data-workflow-consultation="' + consultationId + '"]')).toHaveCount(0)
  expect(state.retries).toHaveLength(0)
})

test('same-tick actor changes cannot retry an old visible row', async ({ page, context }) => {
  const state = await prepare(context, page)
  await expect(card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId })).toBeVisible()
  state.identity = { ...state.identity, user_id: 'synthetic-other-admin', session_id: 'synthetic-changed-session' }
  await page.evaluate(identity => {
    const button = document.querySelector('[data-workflow-consultation] button') as HTMLButtonElement
    const key = 'qarevo:admin:identity', value = JSON.stringify(identity)
    localStorage.setItem(key, value); button.click(); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
  }, state.identity)
  expect(state.retries).toHaveLength(0)
})

test('revoked retry authority suppresses a late retry result and duplicate clicks', async ({ page, context }) => {
  const state = await prepare(context, page); state.holdRetry = true; state.failRetry = false
  const retry = card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId })
  await retry.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => state.retryStarted).toBe(true)
  const completed = state.retryDelivery
  state.canRetry = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(card(page).getByText('Operations access required to retry.')).toHaveCount(0)
  // The selected row was already processed server-side; the newer permission snapshot is read-only.
  await expect(card(page).getByText('Up to date', { exact: true })).toBeVisible()
  state.releaseRetry(); await completed
  await expect(card(page).getByText('The clinical workflow update is confirmed.', { exact: true })).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
  expect(state.retries).toHaveLength(1)
})

for (const change of ['actor', 'role', 'route', 'portal'] as const) test('late retry failures cannot restore a changed ' + change + ' or sign out another portal', async ({ page, context }) => {
  const state = await prepare(context, page); state.holdRetry = true; state.retryStatus = 403
  await card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }).click()
  await expect.poll(() => state.retryStarted).toBe(true)
  const completed = state.retryDelivery
  if (change === 'route') await page.goto('/admin/patients')
  else if (change === 'portal') await page.goto('/patient/dashboard')
  else {
    state.identity = { ...state.identity, user_id: change === 'actor' ? 'synthetic-other-admin' : state.identity.user_id, role: change === 'role' ? 'PATIENT' : 'ADMIN', session_id: 'synthetic-changed-session' }
    await page.evaluate(identity => { const key = 'qarevo:admin:identity', value = JSON.stringify(identity); localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }, state.identity)
  }
  await expect(card(page)).toHaveCount(0)
  const reads = state.offsets.length
  state.releaseRetry(); await completed
  await expect(page.getByText('The clinical workflow update is confirmed.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Synthetic clinical service unavailable. The update remains pending.', { exact: true })).toHaveCount(0)
  expect(state.offsets.length).toBe(reads)
  expect(state.retries).toHaveLength(1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(state.patientIdentity)
  expect(state.renewals).toBe(0)
})

for (const width of [320, 820, 1440]) test('workflow queue supports keyboard pagination and both themes at ' + width + 'px', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await prepare(context, page)
  state.jobs = [job(), ...Array.from({ length: 25 }, (_, index) => job(index + 1))]
  await card(page).getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(25)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark mode' : 'Light mode', exact: true }).click()
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    // Measure the settled theme, after the shared text/background transitions.
    await card(page).evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined)))
    })
    const next = card(page).getByRole('button', { name: 'Next pending updates', exact: true })
    await next.focus(); await expect(next).toBeFocused(); await expectEnabledControlContrast(next)
    await page.keyboard.press('Enter')
    await expect(queuePage(page)).toHaveText('Page 2'); await expect(queuePage(page)).toBeFocused()
    await expect(card(page).locator('[data-workflow-consultation]')).toHaveCount(1)
    await expectEnabledControlContrast(card(page).getByRole('button', { name: 'Previous pending updates', exact: true }))
    await expectEnabledControlContrast(card(page).getByRole('button', { name: 'First pending updates', exact: true }))
    await expectEnabledControlContrast(card(page).getByRole('button', { name: 'Refresh delivery status', exact: true }))
    await expectEnabledControlContrast(card(page).getByRole('button', { name: 'Retry update for consultation ' + consultationId }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await card(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('admin-workflow-' + theme + '-' + width + '.png'), fullPage: true, animations: 'disabled' })
    await card(page).getByRole('button', { name: 'Previous pending updates', exact: true }).click()
    await expect(queuePage(page)).toHaveText('Page 1'); await expect(queuePage(page)).toBeFocused()
  }
  expect(state.retries).toHaveLength(0)
})

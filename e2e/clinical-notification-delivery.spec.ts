import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'

const eventId = '11111111-1111-4111-8111-111111111111'
const base = '/api/v1/admin/clinical-notification-delivery'
async function prepare(context: BrowserContext, canRetry = true) {
  const identity = await seedPortalSession(context, 'admin')
  const state = { pending: true, failRead: false, failRetry: true, disabled: false, paused: false,
    paginated: false, pages: [] as string[], retries: [] as string[] }
  await context.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === base) {
      state.pages.push(url.search)
      if (state.failRead) return route.fulfill({ status: 503, json: { detail: 'Synthetic publication notice service unavailable.' } })
      const offset = Number(url.searchParams.get('offset') || 0)
      return route.fulfill({ json: { status: state.disabled ? 'disabled' : state.pending ? 'warning' : 'healthy',
        can_retry: canRetry, automatic_delivery: !state.paused, pending_count: state.pending ? state.paginated ? 26 : 1 : 0,
        failed_count: state.pending ? 1 : 0, exhausted_count: state.pending ? 1 : 0,
        limit: 25, offset, total_count: state.pending ? state.paginated ? 26 : 1 : 0,
        has_next: state.paginated && offset === 0, has_previous: offset > 0,
        jobs: state.pending && !state.disabled ? [{ event_id: offset ? '22222222-2222-4222-8222-222222222222' : eventId,
          record_id: '33333333-3333-4333-8333-333333333333', revision: 2, status: 'FAILED', attempts: 3, max_attempts: 3,
          next_attempt_at: '2030-07-10T08:00:00Z', last_error_code: 'DELIVERY_NOT_ACKNOWLEDGED' }] : [] } })
    }
    if (path.startsWith(base) && path.endsWith('/retry')) {
      state.retries.push(path)
      if (state.failRetry) return route.fulfill({ status: 503, json: { detail: 'Synthetic notice delivery could not be confirmed.' } })
      state.pending = false
      return route.fulfill({ json: { status: 'delivered', delivered: true, failed: false } })
    }
    if (path.endsWith('/workflow-delivery')) return route.fulfill({ json: { status: 'disabled', jobs: [], pending_count: 0, failed_count: 0, can_retry: false } })
    if (path.endsWith('/overview')) return route.fulfill({ json: { patients: { total: 1 }, doctors: { total: 1, verified: 1, pending_verification: 0 }, users: { total: 3 }, exceptions: { active: 0 }, generated_at: '2030-07-10T08:00:00Z' } })
    if (path.endsWith('/activity')) return route.fulfill({ json: { period_days: 7, date_from: '2030-07-03', date_to: '2030-07-10', new_patients: 1, new_doctors: 1, new_exceptions: 0 } })
    if (path.endsWith('/health')) return route.fulfill({ json: { status: 'healthy', pending_verifications: 0, critical_exceptions: 0, high_exceptions: 0, generated_at: '2030-07-10T08:00:00Z' } })
    if (path.endsWith('/doctors-summary')) return route.fulfill({ json: { total: 1, verified: 1, pending: 0, by_specialty: {} } })
    if (path.endsWith('/patients-summary')) return route.fulfill({ json: { total: 1, new_last_7_days: 1 } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic notice fixture' } })
  })
  return state
}

test('operations recovers only the selected saved publication notice and refresh confirms it', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/dashboard')
  const card = page.getByRole('region', { name: 'Published-summary notices' })
  const retry = card.getByRole('button', { name: `Retry publication notice ${eventId}` })
  await expect(card.getByText('Notice delivery pending', { exact: true })).toBeVisible()
  await expect(card.getByText('Automatic attempts exhausted.', { exact: false })).toBeVisible()
  await retry.click()
  await expect(card.getByRole('alert')).toContainText('Synthetic notice delivery could not be confirmed')
  await expect(retry).toBeEnabled()
  state.failRetry = false
  await retry.focus(); await page.keyboard.press('Enter')
  await expect(card.getByRole('status')).toContainText('in-app notice is confirmed')
  await expect(card.getByText('All notices acknowledged', { exact: true })).toBeVisible()
  expect(state.retries).toEqual(Array(2).fill(`${base}/${eventId}/retry`))
  await page.reload()
  await expect(card.getByText('All notices acknowledged', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry publication notice/ })).toHaveCount(0)
})

test('read-only recovery view supports dark mode, small screens and bounded pagination', async ({ page, context }, testInfo) => {
  const state = await prepare(context, false); state.paginated = true
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/admin/dashboard')
  const card = page.getByRole('region', { name: 'Published-summary notices' })
  await expect(card.getByText('Operations access required to retry.')).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry publication notice/ })).toHaveCount(0)
  await card.getByRole('button', { name: 'Next notices' }).click()
  await expect(card.getByText('Page 2', { exact: true })).toBeVisible()
  expect(state.pages).toContain('?limit=25&offset=25')
  await card.getByRole('button', { name: 'Previous notices' }).click()
  await expect(card.getByText('Page 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(card.getByRole('heading', { name: 'Published-summary notices' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`admin-publication-notices-dark-${width}.png`), fullPage: true, animations: 'disabled' })
    await expectEnabledControlContrast(card.getByRole('button', { name: 'Refresh notice delivery', exact: true }))
    await expectEnabledControlContrast(card.getByRole('button', { name: 'Next notices', exact: true }))
  }
  expect(state.retries).toHaveLength(0)
})

test('notice-delivery outage and disabled configuration never look healthy', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/dashboard')
  const card = page.getByRole('region', { name: 'Published-summary notices' })
  await expect(card.getByText('Notice delivery pending', { exact: true })).toBeVisible()
  state.failRead = true
  await card.getByRole('button', { name: 'Refresh notice delivery' }).click()
  await expect(card.getByRole('alert')).toContainText('Synthetic publication notice service unavailable')
  await expect(card.getByText('All notices acknowledged', { exact: true })).toHaveCount(0)
  state.failRead = false; state.disabled = true
  await card.getByRole('button', { name: 'Refresh notice delivery' }).click()
  await expect(card.getByText('Delivery not enabled', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry publication notice/ })).toHaveCount(0)
})

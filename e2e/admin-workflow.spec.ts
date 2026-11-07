import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const consultationId = '88888888-8888-4888-8888-888888888888'

async function prepare(context: BrowserContext, page: Page, canRetry = true) {
  const state = { pending: true, failRetry: true, failLoad: false, disabled: false, retries: [] as string[] }
  const identity = await seedPortalSession(context, 'admin', {user_id:'synthetic-admin'})
  await context.route('**/api/v1/**', route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const path = new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if (path === '/api/v1/session' || path === '/api/v1/session/activity') return route.fulfill({ headers: headers, json:{browser_session:identity,server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now()+900_000).toISOString(), absolute_expires_at: new Date(Date.now()+28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/retry')) {
      state.retries.push(path)
      if (state.failRetry) return route.fulfill({ status: 503, headers, json: { detail: 'Synthetic clinical service unavailable. The update remains pending.' } })
      state.pending = false
      return route.fulfill({ headers, json: { delivered: 1, failed: 0, status: 'delivered' } })
    }
    if (path.endsWith('/workflow-delivery')) {
      if (state.failLoad) return route.fulfill({ status: 503, headers, json: { detail: 'Synthetic delivery status unavailable.' } })
      return route.fulfill({ headers, json: { status: state.disabled ? 'disabled' : state.pending ? 'warning' : 'healthy',
        pending_count: state.pending ? 1 : 0, failed_count: state.pending ? 1 : 0, can_retry: canRetry, automatic_delivery: !state.disabled,
        jobs: state.pending ? [{ consultation_id: consultationId, attempts: 1, last_error_code: 'HTTP_503', next_attempt_at: '2030-07-10T08:00:00Z' }] : [] } })
    }
    if (path.endsWith('/overview')) return route.fulfill({ headers, json: { patients: { total: 1 }, doctors: { total: 1, verified: 0, pending_verification: 1 }, users: { total: 3 }, exceptions: { active: 0 }, generated_at: '2030-07-10T08:00:00Z' } })
    if (path.endsWith('/activity')) return route.fulfill({ headers, json: { period_days: 7, date_from: '2030-07-03', date_to: '2030-07-10', new_patients: 1, new_doctors: 1, new_exceptions: 0 } })
    if (path.endsWith('/health')) return route.fulfill({ headers, json: { status: 'warning', pending_verifications: 1, critical_exceptions: 0, high_exceptions: 0, generated_at: '2030-07-10T08:00:00Z' } })
    if (path.endsWith('/doctors-summary')) return route.fulfill({ headers, json: { total: 1, verified: 0, pending: 1, by_specialty: {} } })
    if (path.endsWith('/patients-summary')) return route.fulfill({ headers, json: { total: 1, new_last_7_days: 1 } })
    return route.fulfill({ status: 404, headers, json: { detail: 'No synthetic fixture' } })
  })
  await page.goto('/admin/dashboard')
  return state
}

test('operator sees failed delivery and recovers exactly one consultation', async ({ page, context }) => {
  const state = await prepare(context, page)
  const card = page.getByRole('region', { name: 'Clinical workflow delivery' })
  await expect(card.getByText('Updates pending', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: `Retry update for consultation ${consultationId}` }).click()
  await expect(card.getByRole('alert')).toContainText('Synthetic clinical service unavailable')
  await expect(card.getByText('Updates pending', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Refresh delivery status' })).toBeEnabled()
  state.failRetry = false
  await card.getByRole('button', { name: `Retry update for consultation ${consultationId}` }).click()
  await expect(card.getByRole('status').filter({ hasText: 'update is confirmed' })).toBeVisible()
  await expect(card.getByText('Up to date', { exact: true })).toBeVisible()
  expect(state.retries).toEqual(Array(2).fill(`/api/v1/admin/workflow-delivery/${consultationId}/retry`))
  await page.reload()
  await expect(card.getByText('Up to date', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
})

test('read-only operator has responsive dark-mode visibility without retry authority', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await prepare(context, page, false)
  const card = page.getByRole('region', { name: 'Clinical workflow delivery' })
  await expect(card.getByText('Operations access required to retry.')).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(card.getByText('HTTP_503', { exact: true })).toBeVisible()
})

test('status outage and disabled delivery never appear as a healthy empty queue', async ({ page, context }) => {
  const state = await prepare(context, page)
  const card = page.getByRole('region', { name: 'Clinical workflow delivery' })
  await expect(card.getByText('Updates pending', { exact: true })).toBeVisible()
  state.failLoad = true
  await card.getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card.getByRole('alert')).toContainText('Synthetic delivery status unavailable')
  await expect(card.getByText('Up to date', { exact: true })).toHaveCount(0)
  state.failLoad = false; state.disabled = true
  await card.getByRole('button', { name: 'Refresh delivery status' }).click()
  await expect(card.getByText('Not enabled', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /Retry update for/ })).toHaveCount(0)
})

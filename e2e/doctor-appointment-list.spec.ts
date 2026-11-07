import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const state = { failed: false, reads: 0, hold: false, release: () => {}, queries: [] as string[] }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path === '/api/v1/browser-csrf') return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === '/api/v1/security') return route.fulfill({ json: { password_change_available: true, mfa: { available: false, enabled: false, method: null, message: 'Not configured for this synthetic test.' }, sessions: [], sessions_total: 0 } })
    if (path === '/api/v1/doctor/profile') return route.fulfill({ json: { full_name: 'Synthetic Clinician', specialty: 'General practice' } })
    if (path === '/api/v1/doctor/appointments') {
      state.reads++
      state.queries.push(url.search)
      const status = url.searchParams.get('status'), page = Number(url.searchParams.get('page') || 1)
      // Capture the request before a later filter changes. Delayed older results
      // must never replace the new filter's list.
      const hold = state.hold && !status
      if (hold) await new Promise<void>(resolve => { state.release = resolve })
      if (state.failed) return route.fulfill({ status: 503, json: { detail: 'Synthetic scheduling outage. Please retry.' } })
      const appointments = status === 'no_show' ? [] : [{ appointment_id: status === 'completed' ? 'completed-booking' : `booked-page-${page}`, patient_id: 'synthetic-patient', patient_name: status === 'completed' ? 'Completed Patient' : `Booked Patient ${page}`, start_at: '2020-01-01T10:00:00Z', end_at: '2020-01-01T10:30:00Z', status: status || 'booked', consultation_id: null, consultation_modality: 'Video' }]
      return route.fulfill({ json: { appointments, total_count: 24, filtered_count: status === 'no_show' ? 0 : status ? 1 : 24, upcoming_count: 12, page, page_size: 10, has_next: !status && page === 1, has_previous: page > 1 } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

for (const width of [320, 1440]) {
  test(`doctor appointment totals remain authoritative across filters, pages and theme at ${width}px`, async ({ page, context }) => {
    await prepare(context)
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/doctor/appointments')
    const upcoming = page.getByRole('region', { name: 'Upcoming', exact: true })
    await expect(upcoming.getByText('12', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Booked Patient 1/ })).toBeVisible()
    await page.getByRole('button', { name: 'Next appointments', exact: true }).click()
    await expect(page.getByRole('button', { name: /Booked Patient 2/ })).toBeVisible()
    await expect(upcoming.getByText('12', { exact: true })).toBeVisible()
    await page.getByLabel('Appointment status', { exact: true }).selectOption('completed')
    await expect(page.getByRole('button', { name: /Completed Patient/ })).toBeVisible()
    await expect(page.getByText('Page 1 · Showing 1 of 1', { exact: true })).toBeVisible()
    await expect(upcoming.getByText('12', { exact: true })).toBeVisible()
    await page.getByLabel('Appointment status', { exact: true }).selectOption('no_show')
    await expect(page.getByRole('heading', { name: 'No matching appointments', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Show all appointments', exact: true }).click()
    await expect(page.getByRole('button', { name: /Booked Patient 1/ })).toBeVisible()
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('[data-clinical-status="booked"]')).toHaveAttribute('data-status-tone', 'info')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const row = page.getByRole('button', { name: /Booked Patient 1/ })
    await row.focus(); await expect(row).toBeFocused()
    await row.press('Enter'); await expect(page).toHaveURL(/\/doctor\/appointments\/booked-page-1$/)
  })
}

test('doctor appointment failure exposes a real retry without losing filters', async ({ page, context }) => {
  const state = await prepare(context); state.failed = true
  await page.goto('/doctor/appointments')
  await expect(page.getByRole('region', { name: 'Appointment list', exact: true }).getByRole('alert')).toContainText('Synthetic scheduling outage')
  await expect(page.getByLabel('Appointment status', { exact: true })).toBeVisible()
  state.failed = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('button', { name: /Booked Patient 1/ })).toBeVisible()
  expect(state.reads).toBe(2)
})

test('late appointment results cannot replace the selected status', async ({ page, context }) => {
  const state = await prepare(context); state.hold = true
  await page.goto('/doctor/appointments')
  await expect.poll(() => state.reads).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'Loading appointments' })).toBeVisible()
  await page.getByLabel('Appointment status', { exact: true }).selectOption('completed')
  await expect(page.getByRole('button', { name: /Completed Patient/ })).toBeVisible()
  const olderResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/doctor/appointments' && !new URL(response.url()).searchParams.has('status'))
  state.release(); await olderResponse
  await expect(page.getByRole('button', { name: /Completed Patient/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Booked Patient/ })).toHaveCount(0)
})

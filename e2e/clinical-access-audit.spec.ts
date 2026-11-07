import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const fileId = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'admin')
  const control = { fail: false, canView: true, reads: [] as URL[] }
  const events = Array.from({ length: 26 }, (_, index) => ({ id: fileId(index + 100), file_id: fileId(index), created_at: '2030-01-01T10:00:00+00:00', actor_user_id: fileId(50), patient_user_id: fileId(51), lab_request_id: fileId(52), provider_id: fileId(53), uploaded_by: 'patient', expires_in: 300,
    download_url: 'https://synthetic-storage.invalid/?secret=never-render', filename: 'Never-render-synthetic-medical-filename.pdf' }))
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/audit-logs/clinical-access')) {
      control.reads.push(url)
      if (control.fail) return route.fulfill({ status: 503, json: { detail: 'Synthetic clinical access service unavailable.' } })
      const filter = url.searchParams.get('file_id'), offset = Number(url.searchParams.get('offset') || 0)
      const matching = control.canView ? events.filter(entry => !filter || entry.file_id === filter) : []
      return route.fulfill({ json: { can_view: control.canView, events: matching.slice(offset, offset + 25), total_count: matching.length, limit: 25, offset, has_previous: offset > 0, has_next: offset + 25 < matching.length } })
    }
    if (path.endsWith('/audit-logs/summary/actions')) return route.fulfill({ json: { actions: [] } })
    if (path.endsWith('/audit-logs')) return route.fulfill({ json: { logs: [], total: 0, limit: 50, offset: 0 } })
    if (path.endsWith('/security')) return route.fulfill({ json: { password_change_available: true, mfa: { available: false, enabled: false, method: null }, sessions: [], sessions_total: 0 } })
    return route.fulfill({ json: {} })
  })
  return control
}

test('clinical access history paginates and validates filters without exposing links or filenames', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/audit')
  const panel = page.getByRole('region', { name: 'Clinical access history', exact: true })
  await expect(panel.getByRole('article', { name: 'Lab result access event', exact: true })).toHaveCount(25)
  await expect(panel).not.toContainText('never-render')
  await expect(panel.getByRole('link')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Next access events', exact: true }).click()
  await expect(panel.getByRole('article', { name: 'Lab result access event', exact: true })).toHaveCount(1)
  expect(state.reads.at(-1)?.searchParams.get('offset')).toBe('25')
  const before = state.reads.length
  await panel.getByLabel('File ID (optional)', { exact: true }).fill('invalid')
  await panel.getByRole('button', { name: 'Apply file filter', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('UUID format')
  expect(state.reads.length).toBe(before)
  await panel.getByLabel('File ID (optional)', { exact: true }).fill(fileId(0))
  await panel.getByRole('button', { name: 'Apply file filter', exact: true }).click()
  await expect(panel.getByText('Showing 1 of 1 events', { exact: true })).toBeVisible()
  expect(state.reads.at(-1)?.searchParams.get('offset')).toBe('0')
  await expect(panel.getByText(fileId(0), { exact: true })).toBeVisible()
})

test('clinical access outage retries independently from administrator action logs', async ({ page, context }) => {
  const state = await prepare(context); state.fail = true
  await page.goto('/admin/audit')
  const panel = page.getByRole('region', { name: 'Clinical access history', exact: true })
  await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible()
  await expect(panel.getByRole('alert')).toContainText('Synthetic clinical access service unavailable')
  state.fail = false
  await panel.getByRole('button', { name: 'Retry clinical access', exact: true }).click()
  await expect(panel.getByRole('article')).toHaveCount(25)
  expect(state.reads.length).toBe(2)
})

test('restricted administrator capability exposes no clinical records or filter', async ({ page, context }) => {
  const state = await prepare(context); state.canView = false
  await page.goto('/admin/audit')
  const panel = page.getByRole('region', { name: 'Clinical access history', exact: true })
  await expect(panel.getByText('Clinical access history is available to platform owners and compliance administrators.', { exact: true })).toBeVisible()
  await expect(panel.getByRole('article')).toHaveCount(0)
  await expect(panel.getByLabel('File ID (optional)', { exact: true })).toHaveCount(0)
})

test('clinical access history supports mobile dark mode and keyboard filtering', async ({ page, context }) => {
  await prepare(context)
  await page.setViewportSize({ width: 320, height: 950 })
  await page.goto('/admin/audit')
  const panel = page.getByRole('region', { name: 'Clinical access history', exact: true })
  await expect(panel.getByRole('article')).toHaveCount(25)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const filter = panel.getByLabel('File ID (optional)', { exact: true })
  await filter.fill(fileId(0)); await filter.focus(); await expect(filter).toBeFocused(); await filter.press('Enter')
  await expect(panel.getByText('Showing 1 of 1 events', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

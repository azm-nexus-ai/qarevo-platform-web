import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const id = (number: number) => `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const reference = '12345678-1234-4234-8234-123456789abc'
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'admin')
  const state = { failed: false, allowed: true, held: false, started: false, release: () => {}, reads: [] as URL[] }
  const events = Array.from({ length: 26 }, (_, index) => ({
    id: id(index + 100), file_id: id(index), created_at: '2030-01-01T10:00:00+00:00',
    actor_user_id: id(50), patient_user_id: id(51), action: ['uploaded', 'access_issued', 'removed'][index % 3],
    expires_in: 3600, disposition: 'attachment', uploaded_by: 'patient',
    filename: 'DO-NOT-RENDER-MEDICAL-NAME.pdf', description: 'DO-NOT-RENDER-CLINICAL-CONTENT', download_url: 'https://private.invalid/DO-NOT-RENDER-SIGNED-URL',
  }))
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/audit-logs/patient-documents')) {
      state.reads.push(url)
      if (state.held) { state.held = false; state.started = true; await new Promise<void>(resolve => { state.release = resolve }) }
      if (state.failed) return route.fulfill({ status: 503, headers: { 'X-Request-ID': reference }, json: { detail: 'Synthetic patient document activity unavailable.' } })
      const filter = url.searchParams.get('file_id'), offset = Number(url.searchParams.get('offset') || 0)
      const matching = state.allowed ? events.filter(item => !filter || item.file_id === filter) : []
      return route.fulfill({ json: { can_view: state.allowed, events: matching.slice(offset, offset + 25), total_count: matching.length, limit: 25, offset,
        has_previous: state.allowed && offset > 0, has_next: offset + 25 < matching.length } })
    }
    if (path.endsWith('/audit-logs/clinical-access') || path.endsWith('/audit-logs/clinical-publications')) return route.fulfill({ json: { can_view: true, events: [], total_count: 0, limit: 25, offset: 0, has_next: false, has_previous: false } })
    if (path.endsWith('/audit-logs/summary/actions')) return route.fulfill({ json: { actions: [] } })
    if (path.endsWith('/audit-logs')) return route.fulfill({ json: { logs: [], total: 0, limit: 25, offset: 0 } })
    return route.fulfill({ json: {} })
  })
  return state
}

test('owner document history separates actions, paginates and filters without exposing file content or links', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/audit')
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  const panel = page.getByRole('region', { name: 'Patient document activity', exact: true })
  await expect(panel.getByRole('article', { name: 'Patient document event', exact: true })).toHaveCount(25)
  for (const label of ['Upload recorded', 'Access link issued', 'Removed from patient view']) await expect(panel.getByText(label, { exact: true }).first()).toBeVisible()
  await expect(panel).not.toContainText('DO-NOT-RENDER')
  await expect(panel.getByRole('link')).toHaveCount(0)
  await expect(panel.getByText('Attachment link', { exact: true }).first()).toBeVisible()
  await panel.getByRole('button', { name: 'Next document events', exact: true }).click()
  await expect(panel.getByRole('article')).toHaveCount(1)
  expect(state.reads.at(-1)?.searchParams.get('offset')).toBe('25')
  const before = state.reads.length
  await panel.getByLabel('File ID (optional)', { exact: true }).fill('invalid')
  await panel.getByRole('button', { name: 'Apply file filter', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('UUID format')
  expect(state.reads.length).toBe(before)
  await panel.getByLabel('File ID (optional)', { exact: true }).fill(id(0))
  await panel.getByRole('button', { name: 'Apply file filter', exact: true }).click()
  await expect(panel.getByText('Showing 1 of 1 events', { exact: true })).toBeVisible()
  expect(state.reads.at(-1)?.searchParams.get('offset')).toBe('0')
})

test('document activity retries the failed request and preserves its support reference', async ({ page, context }) => {
  const state = await prepare(context); state.failed = true
  await page.goto('/admin/audit')
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  const panel = page.getByRole('region', { name: 'Patient document activity', exact: true })
  await expect(panel.getByRole('alert')).toContainText('Synthetic patient document activity unavailable.')
  await expect(panel.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(reference)
  state.failed = false
  await panel.getByRole('button', { name: 'Retry patient document activity', exact: true }).click()
  await expect(panel.getByRole('article')).toHaveCount(25)
  await expect(panel.getByRole('group', { name: 'Support reference', exact: true })).toHaveCount(0)
  expect(state.reads.length).toBe(2)
})

test('restricted document capability has no identifiers or existence filter', async ({ page, context }) => {
  const state = await prepare(context); state.allowed = false
  await page.goto('/admin/audit')
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  const panel = page.getByRole('region', { name: 'Patient document activity', exact: true })
  await expect(panel.getByText('Patient document activity is available to platform owners and compliance administrators.', { exact: true })).toBeVisible()
  await expect(panel.getByRole('article')).toHaveCount(0)
  await expect(panel.getByLabel('File ID (optional)', { exact: true })).toHaveCount(0)
})

test('a late document history response cannot replace a different mode or survive sign-out', async ({ page, context }) => {
  const state = await prepare(context); state.held = true
  await page.goto('/admin/audit')
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  await expect.poll(() => state.started).toBe(true)
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('publication')
  state.release()
  await expect(page.getByRole('heading', { name: 'No publication receipts recorded', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Patient document event', exact: true })).toHaveCount(0)
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  await expect(page.getByRole('article', { name: 'Patient document event', exact: true })).toHaveCount(25)
  await page.evaluate(() => {
    const key = 'qarevo:admin:identity'; localStorage.removeItem(key); dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
  })
  await expect(page.getByRole('article', { name: 'Patient document event', exact: true })).toHaveCount(0)
})

test('document oversight is keyboard accessible and theme compatible on mobile, tablet and desktop', async ({ page, context }) => {
  await prepare(context)
  await page.goto('/admin/audit')
  await page.getByLabel('Clinical history type', { exact: true }).selectOption('document')
  const panel = page.getByRole('region', { name: 'Patient document activity', exact: true })
  await expect(panel.getByRole('article')).toHaveCount(25)
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 950 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
      const field = panel.getByLabel('File ID (optional)', { exact: true }); await field.focus(); await expect(field).toBeFocused()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
  }
  await panel.getByLabel('File ID (optional)', { exact: true }).fill(id(0))
  await panel.getByLabel('File ID (optional)', { exact: true }).press('Enter')
  await expect(panel.getByText('Showing 1 of 1 events', { exact: true })).toBeVisible()
})

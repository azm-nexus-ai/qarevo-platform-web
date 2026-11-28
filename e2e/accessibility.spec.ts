import AxeBuilder from '@axe-core/playwright'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession } from './helpers/portal-session'

/** Automated WCAG 2.1 A/AA checks on the entry points and shared shells, light and dark. */
const now = () => new Date().toISOString()
// Measure final colours, not a theme transition in progress.
test.use({ reducedMotion: 'reduce' })

async function mockApi(context: BrowserContext, identity?: unknown) {
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (!identity && path.startsWith('/api/v1/session')) return route.fulfill({ status: 401, headers, json: { detail: 'Not authenticated' } })
    if (identity && path.startsWith('/api/v1/session')) return route.fulfill({ headers, json: { browser_session: identity, server_time: now(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ headers, json: { unread_count: 1, enabled: true } })
    if (path === '/api/v1/notifications') return route.fulfill({ headers, json: { notifications: [{ id: 'b1111111-1111-4111-8111-111111111111', event_type: 'appointment_booked', title: 'Termin gebucht', title_en: 'Appointment booked', href: '/doctor/appointments', actor: 'Synthetic Patient', is_read: false, occurrences: 1, created_at: now() }], unread_count: 1, has_more: false, next_cursor: null, enabled: true } })
    if (path.endsWith('/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Clinician', specialty: 'General Practice' } })
    if (path.endsWith('/doctor/notifications')) return route.fulfill({ headers, json: { notices: [], total: 0, has_more: false } })
    return route.fulfill({ headers, json: {} })
  })
}

async function check(page: Page, theme: 'light' | 'dark') {
  if (theme === 'dark' && await page.locator('html').getAttribute('data-theme') !== 'dark') {
    await page.getByRole('button', { name: 'Dark mode', exact: true }).filter({ visible: true }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  }
  // Measure the settled page: no colour or theme transition may still be running.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'))
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')
  expect(serious.map(item => `${item.id}: ${item.nodes.slice(0, 3).map(node => node.target.join(' ')).join(' | ')}`)).toEqual([])
}

const PUBLIC = ['/auth/sign-in', '/auth/doctor/login', '/auth/admin/login', '/auth/practice/login'] as const
for (const theme of ['light', 'dark'] as const) {
  for (const path of PUBLIC) {
    test(`${path} has no serious accessibility issues (${theme})`, async ({ page, context }) => {
      await mockApi(context)
      await page.goto(path)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await check(page, theme)
    })
  }
  for (const [portal, path] of [['doctor', '/doctor/notifications'], ['admin', '/admin/notifications']] as const) {
    test(`${portal} shell and notification inbox have no serious accessibility issues (${theme})`, async ({ page, context }) => {
      const identity = await seedPortalSession(context, portal, { user_id: 'synthetic-a11y-user' })
      await mockApi(context, identity)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
      await check(page, theme)
      await page.getByRole('button', { name: /^Notifications, 1 unread/ }).first().click()
      await expect(page.getByRole('region', { name: 'Notifications', exact: true })).toBeVisible()
      await check(page, theme)
    })
  }
}

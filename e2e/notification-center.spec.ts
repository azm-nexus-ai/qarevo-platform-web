import { seedPortalSession } from './helpers/portal-session'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

/** Synthetic notifications only: names are "Synthetic", no clinical content. */
type Row = { id: string; event_type: string; title: string; title_en: string; href: string | null; actor: string | null; is_read: boolean; occurrences: number; created_at: string }

const now = () => new Date().toISOString()
function rows(): Row[] {
  return [
    { id: 'a1111111-1111-4111-8111-111111111111', event_type: 'message_received', title: 'Neue Nachricht von Synthetic Patient', title_en: 'New message from Synthetic Patient', href: '/doctor/messages?conversation=c1', actor: 'Synthetic Patient', is_read: false, occurrences: 3, created_at: now() },
    { id: 'a2222222-2222-4222-8222-222222222222', event_type: 'appointment_cancelled', title: 'Termin abgesagt', title_en: 'Appointment cancelled', href: '/doctor/appointments/1', actor: 'Synthetic Patient', is_read: false, occurrences: 1, created_at: now() },
    { id: 'a3333333-3333-4333-8333-333333333333', event_type: 'lab_result_received', title: 'Neuer Laborbefund zur Prüfung', title_en: 'New lab result to review', href: null, actor: null, is_read: true, occurrences: 1, created_at: now() },
  ]
}

async function prepare(context: BrowserContext, portal: 'doctor' | 'admin', options: { enabled?: boolean } = {}) {
  const identity = await seedPortalSession(context, portal, { user_id: 'synthetic-notification-user' })
  const state = { rows: rows(), reads: [] as string[], readAll: 0, enabled: options.enabled ?? true }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ headers, json: { browser_session: identity, server_time: now(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    const unread = () => state.rows.filter(row => !row.is_read).length
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ headers, json: { unread_count: state.enabled ? unread() : 0, enabled: state.enabled } })
    if (path === '/api/v1/notifications/read-all') { state.readAll++; state.rows.forEach(row => { row.is_read = true }); return route.fulfill({ headers, json: { marked_read: 2 } }) }
    const read = /^\/api\/v1\/notifications\/([^/]+)\/read$/.exec(path)
    if (read) { state.reads.push(read[1]); state.rows.forEach(row => { if (row.id === read[1]) row.is_read = true }); return route.fulfill({ headers, json: { id: read[1], is_read: true } }) }
    if (path === '/api/v1/notifications') return route.fulfill({ headers, json: state.enabled ? { notifications: state.rows, unread_count: unread(), has_more: false, next_cursor: null, enabled: true } : { notifications: [], unread_count: 0, has_more: false, next_cursor: null, enabled: false } })
    if (path.endsWith('/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Clinician', specialty: 'General Practice' } })
    if (path.endsWith('/doctor/notifications')) return route.fulfill({ headers, json: { notices: [], total: 0, has_more: false } })
    return route.fulfill({ headers, json: {} })
  })
  return state
}

async function openBell(page: Page) {
  const bell = page.getByRole('banner', { name: 'Doctor main navigation' }).getByRole('button', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications, 2 unread')
  await bell.click()
  return page.getByRole('region', { name: 'Notifications' })
}

test('doctor bell shows the unread count, lists events with actor and opens the record', async ({ page, context }) => {
  const state = await prepare(context, 'doctor')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/doctor/dashboard')
  const panel = await openBell(page)
  await expect(panel.getByText('New message from Synthetic Patient')).toBeVisible()
  await expect(panel.getByText(/Synthetic Patient · .* · 3 new/)).toBeVisible()
  await expect(panel.getByText('Appointment cancelled')).toBeVisible()
  await panel.getByRole('link', { name: /New message from Synthetic Patient/ }).click()
  await expect(page).toHaveURL(/\/doctor\/messages\?conversation=c1$/)
  await expect.poll(() => state.reads).toEqual(['a1111111-1111-4111-8111-111111111111'])
  await expect(page.getByRole('banner', { name: 'Doctor main navigation' }).getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 1 unread')
})

test('mark all as read clears the badge and Escape returns focus to the bell', async ({ page, context }) => {
  const state = await prepare(context, 'doctor')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/doctor/dashboard')
  const panel = await openBell(page)
  await panel.getByRole('button', { name: 'Mark all as read' }).click()
  await expect.poll(() => state.readAll).toBe(1)
  await page.keyboard.press('Escape')
  const bell = page.getByRole('banner', { name: 'Doctor main navigation' }).getByRole('button', { name: /^Notifications/ })
  await expect(bell).toBeFocused()
  await expect(bell).toHaveAccessibleName('Notifications')
})

test('the full inbox filters unread items and the sidebar shows the count', async ({ page, context }) => {
  await prepare(context, 'doctor')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/doctor/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
  const sidebar = page.locator('#doctor-primary-sidebar')
  await expect(sidebar.getByRole('link', { name: /Notifications/ })).toHaveAttribute('aria-current', 'page')
  await expect(sidebar.getByRole('link', { name: /Notifications/ })).toContainText('2')
  await page.getByRole('button', { name: 'Unread (2)' }).click()
  await expect(page.getByText('New lab result to review')).toHaveCount(0)
  await expect(page.getByText('Appointment cancelled')).toBeVisible()
})

test('notifications read in German use German event text', async ({ page, context }) => {
  await prepare(context, 'doctor')
  await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: 'http://localhost:3000' }])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/doctor/notifications')
  await expect(page.getByRole('heading', { name: 'Benachrichtigungen', level: 1 })).toBeVisible()
  await expect(page.getByText('Neue Nachricht von Synthetic Patient')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alle als gelesen markieren' })).toBeEnabled()
})

test('a disabled notification center hides the bell instead of failing', async ({ page, context }) => {
  await prepare(context, 'admin', { enabled: false })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/admin/notifications')
  await expect(page.getByText('Notifications are not enabled in this environment yet.')).toBeVisible()
  await expect(page.getByRole('banner', { name: 'Admin main navigation' }).getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const) {
  test(`doctor sidebar and mobile drawer follow the ${theme} theme, including backgrounds`, async ({ page, context }) => {
    await prepare(context, 'doctor')
    await context.addInitScript(value => { try { localStorage.setItem('qarevo.theme.doctor', value); localStorage.setItem('qarevo-theme', value) } catch { /* optional */ } }, theme)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/doctor/dashboard')
    if (theme === 'dark' && await page.locator('html').getAttribute('data-theme') !== 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const surface = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())
    const background = async (selector: string) => page.locator(selector).evaluate(element => getComputedStyle(element).backgroundColor)
    const expected = await page.evaluate(value => { const probe = document.createElement('div'); probe.style.backgroundColor = value; document.body.append(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color }, surface)
    expect(await background('#doctor-primary-sidebar')).toBe(expected)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Navigation menu', exact: true })
    await expect(drawer).toBeVisible()
    expect(await drawer.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expected)
    await expect(drawer.getByRole('link', { name: 'Appointments' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

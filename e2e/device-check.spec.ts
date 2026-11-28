import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession } from './helpers/portal-session'

/**
 * Chromium's synthetic camera and microphone: real getUserMedia, no physical device; access follows the
 * context permissions. The full Chromium build is needed: the headless shell has no media capture.
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE overrides the binary where the installed build differs from the pinned one.
 */
test.use({ channel: 'chromium', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--use-fake-device-for-media-stream'] } })

async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient', { user_id: 'synthetic-patient' })
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path === '/api/v1/session' || path === '/api/v1/session/activity') return route.fulfill({ json: { browser_session: identity, server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900_000).toISOString(), absolute_expires_at: new Date(Date.now() + 28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
}
const result = (page: import('@playwright/test').Page, check: string) => page.getByRole('listitem').filter({ has: page.getByText(check, { exact: true }) })

test.describe('with camera and microphone available', () => {
  test.use({ permissions: ['camera', 'microphone'] })

  test('reports measured results and needs the patient to confirm the test sound', async ({ page, context }) => {
    await prepare(context)
    await page.goto('/patient/video-consultation/device-check')
    // Nothing is claimed before the check runs, and no demo appointment is shown.
    await expect(result(page, 'Camera')).toContainText('Not checked')
    await expect(page.getByText(/Sophia|4:30 PM|Axa|Mbps/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Start device check' }).click()
    await expect(result(page, 'Camera')).toContainText('Ready')
    await expect(result(page, 'Microphone')).toContainText('Ready')
    await expect(result(page, 'Connection')).toContainText(/Round trip to Qarevo: \d+ ms/)
    await expect(page.getByRole('link', { name: 'Go to my appointments' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Play test sound' }).click()
    await page.getByRole('button', { name: 'I heard the sound' }).click()
    await expect(result(page, 'Speakers')).toContainText('Ready')
    await expect(page.getByRole('status').filter({ hasText: 'Your device is ready' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to my appointments' })).toHaveAttribute('href', '/patient/appointments')
  })

  test('reads in German', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL! }])
    await prepare(context)
    await page.goto('/patient/video-consultation/device-check')
    await expect(page.getByRole('heading', { name: 'Kamera, Mikrofon und Verbindung' })).toBeVisible()
    await page.getByRole('button', { name: 'Gerätecheck starten' }).click()
    await expect(result(page, 'Kamera')).toContainText('Bereit')
    await expect(result(page, 'Verbindung')).toContainText(/Antwortzeit zu Qarevo: \d+ ms/)
  })
})

test.describe('with camera and microphone blocked', () => {
  test.use({ permissions: [] })

  test('explains blocked access instead of claiming the devices work', async ({ page, context }) => {
    await prepare(context)
    await page.goto('/patient/video-consultation/device-check')
    await page.getByRole('button', { name: 'Start device check' }).click()
    await expect(result(page, 'Camera')).toContainText('Needs attention')
    await expect(result(page, 'Camera')).toContainText('Access was blocked')
    await expect(page.getByRole('status').filter({ hasText: /need attention/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to my appointments' })).toHaveCount(0)
  })
})

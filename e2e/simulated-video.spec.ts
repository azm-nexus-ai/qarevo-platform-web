import { seedPortalSession } from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'

// Synthetic only: the simulated provider's media server is mocked; no device permissions are requested.
const consultationId = '99999999-9999-4999-8999-999999999999', episodeId = '77777777-7777-4777-8777-777777777777'
const join = { meeting_id: 'sim-meeting', attendee_id: 'sim-att-doctor', join_token: 'sim-meeting.sim-att-doctor.user.9999999999.signature-synthetic', join_url: 'https://dev.example/video', media_placement: { Provider: 'simulated', SignalUrl: '/api/v1/video/simulated/signal', MeetingId: 'sim-meeting' } }

async function prepare(context: BrowserContext, role: 'doctor' | 'patient') {
  const identity = await seedPortalSession(context, role, { user_id: `synthetic-${role}` })
  const state = { signals: [] as string[], others: 0, ended: false, ends: 0, joins: 0 }
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ headers, json: { browser_session: identity, server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Clinician', specialty: 'General Medicine' } })
    if (path.endsWith(`/consultations/${consultationId}`)) return route.fulfill({ headers, json: { consultation_id: consultationId, status: 'SCHEDULED', scheduled_at: '2030-07-10T08:00:00Z', patient_name: 'Synthetic Patient', provider_names: ['Synthetic Clinician'], episode_id: episodeId } })
    if (path.endsWith('/video-session/join')) { state.joins++; return route.fulfill({ headers, status: 201, json: join }) }
    if (path === '/api/v1/video/simulated/signal') { const body = route.request().postDataJSON(); expect(body.join_token).toBe(join.join_token); state.signals.push(body.signal); return route.fulfill({ headers, status: 202, json: { stored: 1, ignored: 0 } }) }
    if (path === '/api/v1/video/simulated/presence') return route.fulfill({ headers, json: { others_connected: state.others, roles: state.others ? ['PATIENT'] : [], ended: state.ended } })
    if (path.endsWith('/video-session/end')) { state.ends++; state.ended = true; return route.fulfill({ headers, json: { consultation_id: consultationId } }) }
    return route.fulfill({ headers, status: 404, json: { detail: 'No synthetic record' } })
  })
  await context.grantPermissions([])
  return state
}

test('the doctor joins a simulated session, sees the patient arrive, survives a reconnect and ends it', async ({ page, context }) => {
  const state = await prepare(context, 'doctor')
  await page.goto(`/doctor/video-consultation?consultationId=${consultationId}`)
  await page.getByRole('button', { name: 'Join consultation', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /Connected|connected/ }).first()).toBeVisible()
  await expect.poll(() => state.signals).toEqual(['CONNECTED'])
  state.others = 1
  await expect(page.getByLabel('Synthetic Patient video')).toBeVisible({ timeout: 10_000 })
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText('Connection interrupted. Reconnecting…')).toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => state.signals.at(-1)).toBe('CONNECTED')
  await page.getByRole('button', { name: 'End call for everyone', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm end call', exact: true }).click()
  await expect.poll(() => state.ends).toBe(1)
  await expect(page.getByText('The video call has ended.', { exact: false })).toBeVisible()
  expect(state.joins).toBe(1)
})

test('the patient leaves the room cleanly and is told when the clinician ended the call', async ({ page, context }) => {
  const state = await prepare(context, 'patient')
  state.others = 1
  await page.goto(`/patient/video-consultation/live?consultationId=${consultationId}`)
  await page.getByRole('button', { name: 'Join consultation', exact: true }).click()
  await expect(page.getByLabel('Synthetic Clinician video')).toBeVisible({ timeout: 10_000 })
  state.ended = true
  await expect(page.getByText('The video room has ended.')).toBeVisible({ timeout: 10_000 })
  expect(state.signals[0]).toBe('CONNECTED')
})

for (const width of [320, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`simulated video room fits ${width}px in ${scheme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme })
    const state = await prepare(context, 'doctor'); state.others = 1
    await page.goto(`/doctor/video-consultation?consultationId=${consultationId}`)
    await page.getByRole('button', { name: 'Join consultation', exact: true }).click()
    await expect(page.getByLabel('Synthetic Patient video')).toBeVisible({ timeout: 10_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}

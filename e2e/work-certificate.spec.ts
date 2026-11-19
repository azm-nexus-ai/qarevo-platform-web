import { seedPortalSession } from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'

const consultationId = '99999999-9999-4999-8999-999999999999', episodeId = '77777777-7777-4777-8777-777777777777'

async function prepare(context: BrowserContext, status = 'STARTED') {
  const identity = await seedPortalSession(context, 'doctor', { user_id: 'synthetic-clinician' })
  const state = { issued: [] as Record<string, unknown>[], rows: [] as Record<string, unknown>[] }
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method()
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ headers, json: { browser_session: identity, server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Clinician', specialty: 'General Medicine' } })
    if (path.endsWith(`/workspace/${consultationId}`)) return route.fulfill({ headers, json: { consultation: { consultation_id: consultationId, episode_id: episodeId, patient_name: 'Synthetic Patient', status, patient_id: 'synthetic-patient', scheduled_time: '2030-07-10T08:00:00Z' }, can_join_video: true, can_complete: true } })
    if (path.endsWith('/clinical-record')) return route.fulfill({ headers, json: { draft: null, published: null } })
    if (path === `/api/v1/doctor/consultations/${consultationId}/work-certificates`) {
      if (method === 'POST') {
        const body = route.request().postDataJSON(); state.issued.push(body)
        const row = { id: body.creation_id, consultation_id: consultationId, kind: body.kind, start_date: body.start_date, end_date: body.end_date, issuer: 'development-pdf', sha256: 'a'.repeat(64), issued_at: new Date().toISOString(), valid_for_submission: false }
        state.rows.unshift(row); return route.fulfill({ headers, status: 201, json: { certificate: row, replayed: false } })
      }
      return route.fulfill({ headers, json: { certificates: state.rows } })
    }
    return route.fulfill({ headers, status: 404, json: { detail: 'No synthetic record' } })
  })
  return state
}

test('the clinician issues a work certificate within the remote-consultation limits', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto(`/doctor/workspace/${consultationId}`)
  await expect(page.getByRole('heading', { name: 'Work certificate' })).toBeVisible()
  await expect(page.getByText('Development document – not a valid eAU')).toBeVisible()
  const start = new Date(); const end = new Date(start.getTime() + 9 * 86_400_000)
  await page.getByLabel('Until and including (Required)').fill(end.toLocaleDateString('sv-SE'))
  await page.getByRole('button', { name: 'Issue work certificate' }).click()
  await expect(page.getByText('After a video consultation a certificate covers at most 7 days.').first()).toBeVisible()
  expect(state.issued).toHaveLength(0)
  await page.getByLabel('Until and including (Required)').fill(new Date(start.getTime() + 2 * 86_400_000).toLocaleDateString('sv-SE'))
  await page.getByLabel(/Follow-up certificate/).check()
  await page.getByRole('button', { name: 'Issue work certificate' }).click()
  await expect(page.getByText('Certificate issued. The patient finds it under Medical Records.')).toBeVisible()
  expect(state.issued[0]).toMatchObject({ kind: 'FOLLOW_UP' })
  await expect(page.getByText(/^Follow-up: /)).toBeVisible()
})

test('certificates can only be issued once the consultation took place', async ({ page, context }) => {
  await prepare(context, 'SCHEDULED')
  await page.goto(`/doctor/workspace/${consultationId}`)
  await expect(page.getByText('Available once the video consultation has taken place.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Issue work certificate' })).toHaveCount(0)
})

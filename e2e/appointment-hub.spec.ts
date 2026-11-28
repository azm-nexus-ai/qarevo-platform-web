import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const ID = 'cccccccc-3333-4333-8333-333333333333', CONSULTATION = 'dddddddd-4444-4444-8444-444444444444'

test('the appointment page prepares the visit, links the room and exports a calendar file', async ({ page, context }) => {
  const identity = await seedPortalSession(context, 'patient')
  const start = new Date(Date.now() + 2 * 86_400_000), end = new Date(start.getTime() + 30 * 60_000)
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === `/api/v1/patient/appointments/${ID}`) return route.fulfill({ json: { id: ID, consultation_id: CONSULTATION, provider_id: 'p1', provider_name: 'Dr. Synthetic Doctor', specialty: 'Allgemeinmedizin', start_at: start.toISOString(), end_at: end.toISOString(), time_zone: 'Europe/Berlin', status: 'BOOKED' } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  await page.goto(`/patient/appointment-details?appointmentId=${ID}`)
  await expect(page.getByText('starts in 2 days', { exact: false })).toBeVisible()
  const steps = page.getByRole('list').filter({ hasText: 'Check your camera and microphone' })
  await expect(steps.getByRole('listitem')).toHaveCount(4)
  await expect(steps.getByRole('link', { name: 'Open video room' })).toHaveAttribute('href', `/patient/video-consultation/waiting-room?consultationId=${CONSULTATION}`)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Add to calendar', exact: true }).click()
  const file = fs.readFileSync(await (await download).path(), 'utf8')
  expect(file).toContain('BEGIN:VEVENT')
  expect(file).toContain(`UID:${ID}@qarevo.health`)
  expect(file.replace(/\r\n /g, '')).toContain('SUMMARY:Video consultation: Dr. Synthetic Doctor')
})

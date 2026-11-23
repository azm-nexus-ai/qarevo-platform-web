import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

/** Regressions from the 23 Nov portal feedback: search failure vs no match, phone-width
 *  clinician registration, sign-in code states, and provider sign-up continuation. */
const doctor = { id: '11111111-1111-4111-8111-111111111111', name: 'Dr. Synthetic Clinician', specialty: 'General Practice', hospital: 'Synthetic Practice',
  imageUrl: null, consultationFee: 0, experienceYears: 5, rating: 0, reviews: 0, languages: ['German', 'English'], insurance: [], gender: 'female',
  consultationTypes: ['video'], distanceKm: null, conditions: [], verification: 'Verified', tags: [], nextAvailable: 'Today', services: [] }

async function patient(context: BrowserContext, search: { fail: boolean; doctors: unknown[] }) {
  const identity = await seedPortalSession(context, 'patient')
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === '/api/v1/patient/settings') return route.fulfill({ json: { user_id: identity.user_id, first_name: 'Synthetic', insurance: { insurance_type: 'GKV', insurance_provider_name: 'Synthetic BKK' }, emergency_contacts: [] } })
    if (path.endsWith('/settings/onboarding')) return route.fulfill({ json: { complete: true, next_step: null, completed_steps: [] } })
    if (path === '/api/v1/patient/doctors/recommended') return route.fulfill({ json: { doctors: [] } })
    if (path === '/api/v1/patient/doctors') return search.fail
      ? route.fulfill({ status: 500, json: { detail: 'Internal server error' } })
      : route.fulfill({ json: { doctors: search.doctors, total: search.doctors.length, filtered_count: search.doctors.length, has_next: false, has_previous: false } })
    return route.fulfill({ json: {} })
  })
}

test('a failed doctor search keeps filters and says so; an empty search names its filters', async ({ page, context }) => {
  const search = { fail: true, doctors: [] as unknown[] }
  await patient(context, search)
  await page.goto('/patient/find-doctor')
  await expect(page.getByRole('alert').filter({ hasText: 'The list of doctors could not be loaded.' })).toBeVisible()
  await expect(page.getByText(/^\d+ doctors?$|^No matches$/)).toHaveCount(0)
  search.fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No practice bookable for you yet' })).toBeVisible()
  await expect(page.getByText(/statutory insured \(GKV\)/).first()).toBeVisible()
  await page.getByRole('searchbox').fill('Cardio')
  await expect(page.getByRole('heading', { name: 'No matches with these filters' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove filter "Search: Cardio"' }).click()
  search.doctors = [doctor]
  await page.getByRole('searchbox').fill('Synthetic')
  await expect(page.getByRole('status').filter({ hasText: '1 doctor' })).toBeVisible()
  await expect(page.getByText('Languages: German, English')).toBeVisible()
  await expect(page.getByRole('button', { name: /Voice search/i })).toHaveCount(0)
})

for (const width of [320, 390]) {
  test(`clinician registration fits a ${width}px phone`, async ({ page }) => {
    await page.route('**/api/v1/**', route => route.fulfill({ json: {} }))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/auth/doctor-register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

test('sign-in code page explains remaining tries and resends from the challenge without an email', async ({ page, context }) => {
  const bodies: unknown[] = []
  await context.route('**/api/v1/browser-csrf', route => route.fulfill({ json: { csrf_token: 'synthetic-csrf' } }))
  await context.route('**/api/v1/auth/mfa/verify-email', route => route.fulfill({ status: 400, json: { detail: { error_code: 'CODE_INVALID', message: 'x', attempts_remaining: 2 } } }))
  await context.route('**/api/v1/auth/mfa/resend-email', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { message: 'sent' } }) })
  await page.clock.install()
  await page.goto('/auth/doctor/2fa')
  await page.getByLabel(/Sign-in code/).fill('123456')
  await page.getByRole('button', { name: 'Confirm and sign in' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '2 tries left with this code' })).toBeVisible()
  const resend = page.getByRole('button', { name: /New code in|Send a new code/ })
  await expect(resend).toBeDisabled()
  await page.clock.runFor(61_000)
  await page.getByRole('button', { name: 'Send a new code', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'A new code was sent.' })).toBeVisible()
  expect(bodies).toEqual([{}])
})

test('provider sign-up continues to registration with the confirmed email locked', async ({ page, context }) => {
  await context.route('**/api/v1/browser-csrf', route => route.fulfill({ json: { csrf_token: 'synthetic-csrf' } }))
  await context.route('**/api/v1/auth/social/microsoft/finish', route => route.fulfill({ json: {
    registration_required: true, role: 'PATIENT', provider: 'microsoft', expires_in: 1800,
    profile: { email: 'newcomer@example.com', email_verified: true, first_name: 'Synthetic', last_name: 'Newcomer' } } }))
  await context.addInitScript(() => sessionStorage.setItem('qarevo.social.transaction', JSON.stringify({
    verifier: 'v'.repeat(43), state: 'synthetic-state', provider: 'microsoft', portal: 'PATIENT', linking: false, intended: null, expires: Date.now() + 300_000 })))
  await page.goto('/auth/social/callback?code=synthetic-code&state=synthetic-state')
  await expect(page).toHaveURL(/\/auth\/sign-up\?social=1$/)
  await expect(page.getByRole('status').filter({ hasText: 'Continuing with Microsoft' })).toBeVisible()
  await expect(page.getByLabel(/Email address/i)).toHaveValue('newcomer@example.com')
  await expect(page.getByLabel(/Email address/i)).toBeDisabled()
})

test('provider sign-in for an existing email explains how to connect instead of duplicating', async ({ page, context }) => {
  await context.route('**/api/v1/browser-csrf', route => route.fulfill({ json: { csrf_token: 'synthetic-csrf' } }))
  await context.route('**/api/v1/auth/social/google/finish', route => route.fulfill({ status: 409, json: { detail: { error_code: 'SOCIAL_ACCOUNT_EXISTS', message: 'x' } } }))
  await context.addInitScript(() => sessionStorage.setItem('qarevo.social.transaction', JSON.stringify({
    verifier: 'v'.repeat(43), state: 'synthetic-state', provider: 'google', portal: 'PATIENT', linking: false, intended: null, expires: Date.now() + 300_000 })))
  await page.goto('/auth/social/callback?code=synthetic-code&state=synthetic-state')
  await expect(page.getByRole('alert').filter({ hasText: 'This avoids a duplicate account.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
})

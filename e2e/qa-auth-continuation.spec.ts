import {test, expect, type BrowserContext, type Page} from '@playwright/test'
import {testSessionTiming} from './helpers/portal-session'

const patient = {user_id: 'synthetic-late-patient', role: 'PATIENT' as const, session_id: 'synthetic-new-patient-session'}

async function authFixture(context: BrowserContext, held: 'login' | 'onboarding' | null) {
  let release!: () => void
  const gate = new Promise<void>(resolve => {release = resolve})
  const control = {loginStarted: false, onboardingStarted: false, released: false, release}
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/browser-csrf') return route.fulfill({json: {csrf_token: 'synthetic-csrf'}})
    if (path === '/api/v1/auth/social/providers') return route.fulfill({json: {google: {enabled: false}, apple: {enabled: false}}})
    if (path === '/api/v1/auth/verify-otp' || path === '/api/v1/auth/verify-email-code') return route.fulfill({json: {browser_session: patient, email_verified: true, phone_verified: true, expires_in: 900}})
    if (path === '/api/v1/auth/login') {
      control.loginStarted = true
      if (held === 'login') await gate
      await route.fulfill({json: {browser_session: patient, email_verified: true, phone_verified: true, expires_in: 900}})
      if (held === 'login') control.released = true
      return
    }
    if (path === '/api/v1/patient/settings/onboarding') {
      control.onboardingStarted = true
      if (held === 'onboarding') await gate
      await route.fulfill({json: {complete: true, next_step: null, completed_steps: ['personal', 'contact', 'health', 'coverage'], personal: {}}})
      if (held === 'onboarding') control.released = true
      return
    }
    if (path.startsWith('/api/v1/session')) return route.fulfill({json: testSessionTiming(patient)})
    if (path === '/api/v1/patient/settings') return route.fulfill({json: {user_id: patient.user_id, first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: []}})
    if (path === '/api/v1/patient/profile-image') return route.fulfill({json: {image: null}})
    if (path === '/api/v1/patient/dashboard') return route.fulfill({json: {patient_name: 'Synthetic Patient', care_plans: [], medications: [], summary_cards: [], ai_insights: [], notifications: []}})
    if (path === '/api/v1/patient/doctors') return route.fulfill({json: {doctors: []}})
    if (path === '/api/v1/patient/doctors/recent') return route.fulfill({json: {recent_doctors: []}})
    return route.fulfill({status: 404, json: {detail: 'No synthetic auth fixture.'}})
  })
  return control
}

async function startSignIn(page: Page) {
  await page.goto('/auth/sign-in')
  await page.evaluate(() => {(window as Window & {syntheticAuthDocument?: boolean}).syntheticAuthDocument = true})
  await page.getByLabel('Email Address').fill('patient@example.invalid')
  await page.getByPlaceholder('Your password').fill('Synthetic-password42!')
  await page.getByRole('button', {name: 'Continue', exact: true}).click()
}

for (const held of ['login', 'onboarding'] as const) test(`late patient ${held} success cannot redirect a physician sign-in page`, async ({page, context}) => {
  const state = await authFixture(context, held)
  await startSignIn(page)
  await expect.poll(() => held === 'login' ? state.loginStarted : state.onboardingStarted).toBe(true)
  await page.getByRole('navigation', {name: 'Other sign-in portal'}).getByRole('link', {name: 'Physician sign-in'}).click()
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  expect(await page.evaluate(() => (window as Window & {syntheticAuthDocument?: boolean}).syntheticAuthDocument)).toBe(true)
  state.release()
  await expect.poll(() => state.released).toBe(true)
  // API publication of the verified patient session is preserved, while UI
  // continuation ownership remains with the page that initiated the request.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(patient)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('qarevo:doctor:identity'))).toBeNull()
  if (held === 'login') expect(state.onboardingStarted).toBe(false)
})

test('normal patient password success still completes onboarding checks and opens the patient dashboard', async ({page, context}) => {
  const state = await authFixture(context, null)
  await startSignIn(page)
  await expect(page).toHaveURL(/\/patient\/dashboard$/)
  await expect(page.getByRole('navigation', {name: 'Patient appearance', exact: true})).toBeVisible()
  expect(state.onboardingStarted).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(patient)
})


test('normal patient OTP success still opens account-created using the verified session', async ({page, context}) => {
  await authFixture(context, null)
  await page.goto('/auth/otp?email=patient%40example.invalid')
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`Digit ${digit} of 6`, {exact: true}).fill(String(digit))
  await expect(page).toHaveURL(/\/auth\/account-created$/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(patient)
})

test('normal email-code success completes its guarded delayed confirmation', async ({page, context}) => {
  await authFixture(context, null)
  await context.addInitScript(() => sessionStorage.setItem('qarevo:patient:signup:v2', JSON.stringify({email: 'patient@example.invalid', expires_at: Date.now() + 600000})))
  await page.goto('/auth/verify-email')
  await page.getByRole('button', {name: 'Enter code manually', exact: true}).click()
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`Verification code digit ${digit}`, {exact: true}).fill(String(digit))
  await expect(page.getByRole('heading', {name: 'Your account is now active', exact: true})).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(patient)
})


test('legacy OTP resend uses the email API, reports failure honestly, and never fakes SMS delivery', async ({page, context}) => {
  await authFixture(context, null)
  let requests = 0
  await context.route('**/api/v1/auth/resend-verification-email', route => {
    requests++
    expect(route.request().postDataJSON()).toEqual({email: 'patient@example.invalid'})
    return route.fulfill(requests === 1 ? {status: 503, json: {detail: 'Synthetic email delivery unavailable.'}} : {json: {message: 'Verification email requested.'}})
  })
  await page.clock.install()
  await page.goto('/auth/otp?email=patient%40example.invalid')
  await page.clock.runFor(61000)
  await page.getByRole('button', {name: 'Resend Code', exact: true}).click()
  await expect(page.getByRole('alert').filter({hasText: 'Synthetic email delivery unavailable.'})).toBeVisible()
  await expect(page.getByText('Verification email requested. Check your inbox and spam folder.', {exact: true})).toHaveCount(0)
  await page.getByRole('button', {name: 'Resend Code', exact: true}).click()
  await expect(page.getByText('Verification email requested. Check your inbox and spam folder.', {exact: true})).toBeVisible()
  expect(requests).toBe(2)
  await page.getByRole('button', {name: 'Change', exact: true}).click()
  await expect(page.getByRole('button', {name: 'SMS delivery unavailable', exact: true})).toBeDisabled()
  await expect(page.getByRole('status').filter({hasText: 'SMS verification delivery is unavailable.'})).toBeVisible()
  expect(requests).toBe(2)
})

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const personal = '/auth/profile-setup/personal-information'
const alpha = 'alpha@example.invalid'
const beta = 'beta@example.invalid'
const password = 'Synthetic-test-only-2026!'

type RenewalScenario = {
  expireAccess: boolean
  failure: 'none' | 'network' | 'unavailable' | 'rejected'
  refreshes: number
  rejectedAccess: number
  holdRefresh?: Promise<void>
}
const scenarios = new WeakMap<BrowserContext, RenewalScenario>()

function tokens(email: string) {
  return {
    user_id: email, role: 'PATIENT',
    access_token: 'test-access:' + email,
    refresh_token: 'test-refresh:' + email,
    token_type: 'bearer', expires_in: 900,
    email_verified: true, phone_verified: false,
  }
}

// All API requests are intercepted: these tests never create real accounts or send email.
async function mockApi(context: BrowserContext) {
  const scenario: RenewalScenario = { expireAccess: false, failure: 'none', refreshes: 0, rejectedAccess: 0 }
  const consumed = new Set<string>()
  scenarios.set(context, scenario)
  await context.route('**/api/**', async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/verify-email-code') {
      const body = request.postDataJSON()
      return route.fulfill({ headers: cors, json: tokens(body.email) })
    }
    if (pathname === '/api/v1/patient/register') {
      return route.fulfill({ headers: cors, json: { user_id: request.postDataJSON().email, message: 'Check your email.' } })
    }
    if (pathname === '/api/v1/auth/refresh') {
      scenario.refreshes++
      await scenario.holdRefresh
      if (scenario.failure === 'network') return route.abort('connectionfailed')
      if (scenario.failure === 'unavailable') return route.fulfill({ status: 503, headers: cors, json: { detail: 'Temporary outage' } })
      const token = request.postDataJSON().refresh_token as string
      if (scenario.failure === 'rejected' || consumed.has(token)) return route.fulfill({ status: 401, headers: cors, json: { detail: 'Refresh token rejected' } })
      consumed.add(token)
      const email = token.replace('test-refresh:', '')
      return route.fulfill({ headers: cors, json: {
        user_id: email, access_token: 'renewed-access:' + email,
        refresh_token: 'renewed-refresh:' + email, token_type: 'bearer', expires_in: 900,
      } })
    }
    if (pathname === '/api/v1/patient/settings') {
      const authorization = request.headers().authorization || ''
      if (scenario.expireAccess && authorization.startsWith('Bearer test-access:')) {
        scenario.rejectedAccess++
        return route.fulfill({ status: 401, headers: cors, json: { detail: 'Invalid or expired access token' } })
      }
      const email = authorization.replace(/^Bearer (test|renewed)-access:/, '')
      return route.fulfill({ headers: cors, json: { user_id: email, email, phone: '+4915112345678', emergency_contacts: [] } })
    }
    if (pathname === '/api/v1/auth/logout') return route.fulfill({ headers: cors, json: { message: 'Logged out.' } })
    return route.fulfill({ status: 404, headers: cors, json: { detail: 'Unmocked test endpoint: ' + pathname } })
  })
}

async function signIn(page: Page, email: string) {
  await page.goto('/auth/sign-in?next=profile-setup')
  await page.getByLabel('Email Address').fill(email)
  await page.getByPlaceholder('Your password').fill(password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(personal + '$'))
  await expect(page.locator('#fullName')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await mockApi(context)
})

test('own draft survives refresh without trusting legacy patient data', async ({ page }) => {
  await page.goto('/auth/sign-in')
  await page.evaluate(() => {
    localStorage.setItem('qarevo.onboarding.personal-information.v1', JSON.stringify({ fullName: 'Previous Patient' }))
    localStorage.setItem('qarevo_booking_state', JSON.stringify({ notes: 'Previous patient notes', step: 'review' }))
    localStorage.setItem('qarevo.auth.flow.v1', JSON.stringify({ onboardingCompleted: true }))
  })
  await signIn(page, alpha)
  await expect(page.locator('#fullName')).toHaveValue('')
  await page.locator('#fullName').fill('Synthetic Alpha')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('#fullName')).toHaveValue('Synthetic Alpha')
  expect(await page.evaluate(() => localStorage.getItem('qarevo.onboarding.personal-information.v1'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('qarevo_booking_state'))).toBeNull()
})

test('account switch in another tab removes the old view and never restores its draft', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Synthetic Alpha Private')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()

  const second = await context.newPage()
  await signIn(second, beta)
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  await expect(second.locator('#fullName')).toHaveValue('')
  await second.locator('#fullName').fill('Synthetic Beta')
  await expect(second.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await second.reload()
  await expect(second.locator('#fullName')).toHaveValue('Synthetic Beta')
  // Redirecting may create an empty booking draft for the new account.
  // No key or value belonging to the previous patient may remain.
  const remaining = await page.evaluate(() => Object.entries(sessionStorage))
  expect(remaining.some(([key, value]) => key.includes(alpha) || value.includes('Synthetic Alpha Private'))).toBe(false)
  await page.goto(personal)
  await expect(page.locator('#fullName')).toHaveValue('')
  expect(errors).toEqual([])
})

test('same-account tabs retain independent drafts', async ({ page, context }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('First Tab Draft')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  const second = await context.newPage()
  await second.goto(personal)
  await expect(second.locator('#fullName')).toHaveValue('')
  await second.locator('#fullName').fill('Second Tab Draft')
  await expect(second.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('#fullName')).toHaveValue('First Tab Draft')
})

test('contact email is authenticated and emergency contact is not the patient', async ({ page }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Synthetic Alpha')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.goto('/auth/profile-setup/contact-information')
  await expect(page.locator('#email')).toHaveValue(alpha)
  await expect(page.locator('#primaryPhone')).toHaveValue('+4915112345678')
  await expect(page.locator('#emergencyName')).toHaveValue('')
  await page.locator('#emergencyName').fill('Synthetic Emergency Contact')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('#emergencyName')).toHaveValue('Synthetic Emergency Contact')
})

test('new signup owns its email, clears old drafts and can complete mocked OTP', async ({ page }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Previous Patient Private')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.goto('/auth/sign-up')
  await page.getByLabel('Email Address').fill(beta)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password', { exact: true }).fill(password)
  await page.getByRole('checkbox').nth(0).click()
  await page.getByRole('checkbox').nth(1).click()
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/auth\/verify-email$/)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('qarevo.auth.signup.v1') || '{}').email)).toBe(beta)
  expect(await page.evaluate(() => localStorage.getItem('qarevo.auth.signup.v1'))).toBeNull()
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click()
  const digits = page.locator('input[inputmode="numeric"]')
  await expect(digits).toHaveCount(6)
  for (let index = 0; index < 6; index++) await digits.nth(index).fill(String(index + 1))
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/account-created$/)
  await page.goto(personal)
  await expect(page.locator('#fullName')).toHaveValue('')
})

test('two tabs recover expired access through one real browser lock without losing drafts', async ({ page, context }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Preserved through renewal')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  const second = await context.newPage()
  const scenario = scenarios.get(context)!
  scenario.expireAccess = true
  let release!: () => void
  scenario.holdRefresh = new Promise<void>(resolve => { release = resolve })
  try {
    await Promise.all([
      page.goto('/auth/profile-setup/contact-information'),
      second.goto('/auth/profile-setup/contact-information'),
    ])
    await expect.poll(() => scenario.rejectedAccess).toBe(2)
  } finally {
    release()
  }
  await expect(page.locator('#email')).toHaveValue(alpha)
  await expect(second.locator('#email')).toHaveValue(alpha)
  expect(scenario.refreshes).toBe(1)
  await page.goto(personal)
  await expect(page.locator('#fullName')).toHaveValue('Preserved through renewal')
})

for (const failure of ['unavailable', 'network'] as const) {
  test(`temporary renewal ${failure} preserves the form and recovers after backoff`, async ({ page, context }) => {
    await signIn(page, alpha)
    await page.goto('/auth/profile-setup/contact-information')
    await expect(page.locator('#email')).toHaveValue(alpha)
    await page.locator('#emergencyName').fill('Unsaved contact survives outage')
    await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
    const scenario = scenarios.get(context)!
    scenario.expireAccess = true
    scenario.failure = failure
    await page.reload()
    await expect(page.getByText("We couldn't renew your session right now. Please try again shortly.", { exact: true })).toBeVisible()
    await expect(page.locator('#emergencyName')).toHaveValue('Unsaved contact survives outage')
    expect(await page.evaluate(() => localStorage.getItem('qarevo_refresh_token'))).toBe('test-refresh:' + alpha)
    expect(scenario.refreshes).toBe(1)
    scenario.failure = 'none'
    await page.clock.setFixedTime(new Date(Date.now() + 11_000))
    await page.reload()
    await expect.poll(() => scenario.refreshes).toBe(2)
    await expect(page.locator('#email')).toHaveValue(alpha)
    await expect(page.getByText("We couldn't renew your session right now. Please try again shortly.", { exact: true })).toHaveCount(0)
    await expect(page.locator('#emergencyName')).toHaveValue('Unsaved contact survives outage')
    expect(await page.evaluate(() => localStorage.getItem('qarevo_refresh_token'))).toBe('renewed-refresh:' + alpha)
  })
}

test('a rejected refresh ends the session and removes its private draft', async ({ page, context }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Clear on expiry')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  const scenario = scenarios.get(context)!
  scenario.expireAccess = true
  scenario.failure = 'rejected'
  await page.goto('/auth/profile-setup/contact-information')
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  expect(await page.evaluate(() => localStorage.getItem('qarevo_refresh_token'))).toBeNull()
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('qarevo.draft.v2:')))).toEqual([])
})

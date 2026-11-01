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
  holdRecords?: Promise<void>
  holdDashboard?: Promise<void>
  recordsStatus?: number
  dashboardStatus?: number
  records?: Record<string, unknown>
  logoutCount?: number
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
    if (pathname === '/api/v1/auth/logout') {
      scenario.logoutCount = (scenario.logoutCount || 0) + 1
      return route.fulfill({ headers: cors, json: { message: 'Logged out.' } })
    }
    if (pathname === '/api/v1/patient/prescription-care-plan') {
      await scenario.holdRecords
      return route.fulfill({ headers: cors, status: scenario.recordsStatus || 200, json: scenario.records || { medications: [], care_plans: [] } })
    }
    if (pathname === '/api/v1/patient/dashboard') {
      await scenario.holdDashboard
      return route.fulfill({ headers: cors, status: scenario.dashboardStatus || 200, json: { patient_name: 'Synthetic Patient', care_plans: [], medications: [], summary_cards: [], ai_insights: [], notifications: [] } })
    }
    if (pathname === '/api/v1/patient/settings/health-info') return route.fulfill({ headers: cors, json: {} })
    if (pathname === '/api/v1/patient/doctors') return route.fulfill({ headers: cors, json: { doctors: [] } })
    if (pathname === '/api/v1/patient/doctors/recent') return route.fulfill({ headers: cors, json: { recent_doctors: [] } })
    if (pathname === '/api/v1/patient/referrals') return route.fulfill({ headers: cors, json: { providers: [] } })
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

test('prescriptions wait for real data and never show sample medication', async ({ page, context }) => {
  await signIn(page, alpha)
  const scenario = scenarios.get(context)!
  let release!: () => void
  scenario.holdRecords = new Promise<void>(resolve => { release = resolve })
  await page.goto('/patient/prescription-care-plan')
  try {
    await expect(page.getByText('Loading your records…')).toBeVisible()
    await expect(page.getByText('No medications recorded', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Lisinopril|Vitamin D3|Magnesium Glycinate/)).toHaveCount(0)
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No care plan recorded', exact: true })).toBeVisible()
})

test('prescription outage can be retried and only persisted instructions are rendered', async ({ page, context }) => {
  await signIn(page, alpha)
  const scenario = scenarios.get(context)!
  scenario.recordsStatus = 503
  await page.goto('/patient/prescription-care-plan')
  await expect(page.getByRole('alert')).toContainText('We couldn’t load your records')
  await expect(page.getByText('No medications recorded', { exact: true })).toHaveCount(0)
  scenario.recordsStatus = 200
  scenario.records = { medications: [{ id: 'synthetic-record', name: 'Synthetic medication record', instructions: 'Exact clinician instruction from the fixture' }], care_plans: [] }
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic medication record' })).toBeVisible()
  await expect(page.getByText('Exact clinician instruction from the fixture')).toBeVisible()
  await expect(page.getByText(/Lisinopril|Refill ready|Same-day pickup/)).toHaveCount(0)
})

test('dashboard distinguishes slow and failed requests from an empty account', async ({ page, context }) => {
  await signIn(page, alpha)
  const scenario = scenarios.get(context)!
  let release!: () => void
  scenario.holdDashboard = new Promise<void>(resolve => { release = resolve })
  scenario.dashboardStatus = 503
  await page.goto('/patient/dashboard')
  try {
    await expect(page.getByText('Loading your dashboard…')).toBeVisible()
    await expect(page.getByText('Medication plan available', { exact: true })).toHaveCount(0)
    await expect(page.getByText('No health metrics have been added yet.', { exact: true })).toHaveCount(0)
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'We couldn’t load your dashboard' })).toBeVisible()
  scenario.dashboardStatus = 200
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('Loading your dashboard…')).toHaveCount(0)
  await expect(page.getByText('No health metrics have been added yet.', { exact: true })).toBeVisible()
  await expect(page.getByText('Medication plan available', { exact: true })).toHaveCount(0)
})

test('referrals and follow-up do not invent clinical records or recovery scores', async ({ page }) => {
  await signIn(page, alpha)
  await page.goto('/patient/referrals')
  await expect(page.getByRole('heading', { name: 'No referrals recorded' })).toBeVisible()
  await expect(page.getByText(/Naomi Mensah|Specialist appointment confirmed/)).toHaveCount(0)
  await page.goto('/patient/follow-up')
  await expect(page.getByRole('heading', { name: 'No follow-up instructions recorded' })).toBeVisible()
  await expect(page.getByText(/74%|81%|Steady recovery trend|120\/78/)).toHaveCount(0)
  await page.goto('/patient/consultation-summary?physicianId=fiction&appointmentId=fiction&doctorNotes=UNTRUSTED-URL-NOTES')
  await expect(page.getByRole('heading', { name: 'No consultation summary available' })).toBeVisible()
  await expect(page.getByText('UNTRUSTED-URL-NOTES')).toHaveCount(0)
})

test('sidebar logout clears private browser state and revokes the refresh session', async ({ page, context }) => {
  await signIn(page, alpha)
  await page.locator('#fullName').fill('Private logout draft')
  await expect(page.getByText('Draft saved in this tab', { exact: true })).toBeVisible()
  await page.goto('/patient/prescription-care-plan')
  await expect(page.getByRole('heading', { name: 'No medications recorded' })).toBeVisible()
  await page.locator('.pps-sidebar').getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  await expect.poll(() => scenarios.get(context)!.logoutCount || 0).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('qarevo_access_token'))).toBeNull()
  expect(await page.evaluate(() => Object.entries(sessionStorage).some(([key, value]) => key.includes(alpha) || value.includes('Private logout draft')))).toBe(false)
})

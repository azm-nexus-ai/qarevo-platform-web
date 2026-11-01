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
  settingsStatus?: number
  holdSettings?: Promise<void>
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
  const saved = new Map<string, Record<string, Record<string, unknown>>>()
  scenarios.set(context, scenario)
  await context.route('**/api/**', async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const owner = (request.headers().authorization || '').replace(/^Bearer (test|renewed)-access:/, '')
    const account = saved.get(owner) || {}
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/verify-email-code') {
      const body = request.postDataJSON()
      return route.fulfill({ headers: cors, json: tokens(body.email) })
    }
    if (pathname === '/api/v1/auth/forgot-password') return route.fulfill({ headers: cors, json: { message: 'If an account exists, instructions have been requested.' } })
    if (pathname === '/api/v1/auth/reset-password') return route.fulfill({ headers: cors, json: { message: 'Password has been reset successfully.' } })
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
      await scenario.holdSettings
      if (scenario.settingsStatus) return route.fulfill({ headers: cors, status: scenario.settingsStatus, json: { detail: 'Settings unavailable' } })
      const authorization = request.headers().authorization || ''
      if (scenario.expireAccess && authorization.startsWith('Bearer test-access:')) {
        scenario.rejectedAccess++
        return route.fulfill({ status: 401, headers: cors, json: { detail: 'Invalid or expired access token' } })
      }
      const email = authorization.replace(/^Bearer (test|renewed)-access:/, '')
      return route.fulfill({ headers: cors, json: { user_id: email, email, phone: '+4915112345678', emergency_contacts: [], ...(account.personal || {}) } })
    }
    if (pathname === '/api/v1/patient/settings/profile' && request.method() === 'PUT') {
      account.personal = request.postDataJSON()
      saved.set(owner, account)
      return route.fulfill({ headers: cors, json: { user_id: owner, email: owner, ...account.personal } })
    }
    if (pathname.startsWith('/api/v1/patient/settings/onboarding')) {
      if (request.method() === 'PUT') {
        const step = pathname.split('/').at(-1)!
        account[step] = request.postDataJSON()
        saved.set(owner, account)
      }
      const steps = ['personal', 'contact', 'health', 'coverage']
      const next = steps.find(step => !account[step]) || null
      return route.fulfill({ headers: cors, json: { ...account, personal: account.personal || {}, complete: !next, next_step: next, completed_steps: steps.filter(step => account[step]), coverage_verified: false, legal_ready: false, consent_version: 'dev-test-20261101' } })
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
  await expect(page.getByRole('heading', { name: 'We couldn’t load your records', exact: true })).toBeVisible()
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

test('all profile steps save, survive a fresh sign-in and keep funding distinct', async ({ page, context }) => {
  const savedBodies: Record<string, Record<string, unknown>> = {}
  context.on('request', request => {
    if (request.method() === 'PUT' && request.url().includes('/api/v1/patient/settings/')) savedBodies[new URL(request.url()).pathname.split('/').at(-1)!] = request.postDataJSON()
  })
  await signIn(page, alpha)
  await expect(page.getByLabel('Full Name (Required)', { exact: true })).toBeVisible()
  await page.locator('#fullName').fill('Synthetic Patient')
  await page.locator('#preferredName').fill('Test Name')
  await page.locator('#dob').fill('1998-05-21')
  await page.locator('#gender').selectOption('Female')
  await page.locator('#nationality').selectOption('German')
  await page.locator('#language').selectOption('German')
  await page.locator('#maritalStatus').selectOption('Single')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/contact-information$/)
  expect(savedBodies.profile).toMatchObject({ preferred_name: 'Test Name', nationality: 'German', language: 'German', marital_status: 'Single' })
  await page.locator('#country').selectOption('Germany')
  await expect(page.locator('#state option')).toHaveCount(17)
  await page.locator('#state').selectOption('Berlin')
  await page.locator('#city').fill('Berlin')
  await page.locator('#address').fill('Teststraße 12')
  await page.locator('#postalCode').fill('10115')
  await page.getByRole('button', { name: 'Email', exact: true }).click()
  await page.locator('#emergencyName').fill('Synthetic Contact')
  await page.getByLabel('Relationship (Required)', { exact: true }).selectOption('Friend')
  await page.locator('#emergencyPhone').fill('+49301234567')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/medical-history-allergies$/)
  expect(savedBodies.contact).toMatchObject({ address: 'Teststraße 12', postal_code: '10115', state: 'Berlin', preferred_contact_method: 'Email' })
  await page.getByRole('button', { name: 'None', exact: true }).click()
  await page.getByRole('button', { name: 'No', exact: true }).click()
  await page.getByRole('button', { name: 'No Known Allergies', exact: true }).click()
  await page.getByRole('button', { name: "I'm Not Taking Any Medication", exact: true }).click()
  await page.getByRole('button', { name: 'None Known', exact: true }).click()
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/insurance-privacy-consent$/)
  expect(savedBodies.health).toMatchObject({ medical_history: ['None'], surgeries_status: 'no', medications_status: 'none' })
  await page.getByLabel('Funding type (Required)').selectOption('GKV')
  await page.getByLabel('Insurance provider (Required)', { exact: true }).fill('Synthetic Insurer')
  await page.getByLabel('Insurance number (KVNR) (Required)', { exact: true }).fill('A123456789')
  for (const checkbox of await page.locator('input[type="checkbox"][required]').all()) await checkbox.check()
  await page.getByRole('button', { name: 'Complete Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Profile Completed', exact: true })).toBeVisible()
  expect(savedBodies.coverage).toMatchObject({ insurance_type: 'GKV', insurance_number: 'A123456789', consent_version: 'dev-test-20261101', consents: { marketing: false } })
  await signIn(page, alpha) // A new login clears tab drafts; the same account must restore saved data.
  await expect(page.locator('#fullName')).toHaveValue('Synthetic Patient')
  await expect(page.locator('#preferredName')).toHaveValue('Test Name')
  await page.goto('/auth/profile-setup/contact-information')
  await expect(page.locator('#address')).toHaveValue('Teststraße 12')
  await page.goto('/auth/profile-setup/medical-history-allergies')
  await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/auth/profile-setup/insurance-privacy-consent')
  await expect(page.locator('#coverage-type')).toHaveValue('GKV')
})

test('an unsaved account cannot claim a completed profile through a direct URL', async ({ page }) => {
  await signIn(page, alpha)
  await page.goto('/auth/profile-setup/profile-completed')
  await expect(page.getByRole('heading', { name: 'Your profile still needs a saved step' })).toBeVisible()
  await expect(page.getByText('100% Complete', { exact: true })).toHaveCount(0)
})


test('password recovery guides users through their email link and rejects a missing token', async ({ page }) => {
  await page.goto('/auth/forgot-password')
  await page.getByLabel('Email Address').fill(alpha)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('If an eligible account exists', { exact: false })).toBeVisible()
  await expect(page.locator('a[href="/auth/reset-password"]')).toHaveCount(0)
  await page.goto('/auth/reset-password')
  await expect(page.getByText('The password reset link is missing or invalid.', { exact: false })).toBeVisible()
  await page.goto('/auth/reset-password?token=synthetic-reset-token')
  await page.getByLabel('New Password', { exact: true }).fill('SyntheticNewPassword123!')
  await page.getByLabel('Confirm New Password', { exact: true }).fill('SyntheticNewPassword123!')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('Your password has been successfully updated.', { exact: false })).toBeVisible()
})


test('settings never expose editable defaults before loading and can retry an outage', async ({ page, context }) => {
  await signIn(page, alpha)
  const scenario = scenarios.get(context)!
  let release!: () => void
  scenario.holdSettings = new Promise<void>(resolve => { release = resolve })
  scenario.settingsStatus = 503
  await page.goto('/patient/settings')
  try {
    await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Profile and contact identity' })).toHaveCount(0)
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'We couldn’t load your settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toHaveCount(0)
  scenario.settingsStatus = undefined
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Profile and contact identity' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled()
})


test('onboarding explains invalid fields without locking Continue', async ({ page }) => {
  await signIn(page, alpha)
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.locator('[data-validation-summary]')).toContainText('Please enter your full name')
  await page.goto('/auth/profile-setup/contact-information')
  const next = page.getByRole('button', { name: /Continue/ })
  await expect(next).toBeEnabled()
  await page.locator('#postalCode').fill('ABC12')
  await page.locator('#primaryPhone').fill('123')
  await page.locator('#address').fill('Musterstraße')
  await next.click()
  await expect(page.locator('#postalCode-error')).toContainText('five-digit')
  await expect(page.locator('#primaryPhone-error')).toContainText('international')
  await expect(page.locator('#address-error')).toContainText('house number')
  await expect(page.locator('#primaryPhone')).toBeFocused()
  await expect(page.locator('#emergencyName-error')).toBeVisible()
  await page.locator('#postalCode').fill('01067')
  await page.locator('#primaryPhone').fill('+49 151 12345678')
  await page.locator('#address').fill('Musterstraße 12a')
  await expect(page.locator('#postalCode-error')).toHaveCount(0)
  await expect(page.locator('#primaryPhone-error')).toHaveCount(0)
  await expect(page.locator('#address-error')).toHaveCount(0)
  await page.goto('/auth/profile-setup/medical-history-allergies')
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.locator('[data-validation-summary]')).toContainText('medical history')
})

test('doctor registration exposes required fields and consent without a disabled-submit trap', async ({ page }) => {
  await page.goto('/auth/doctor-register')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('First name is required.', { exact: true })).toBeVisible()
  await expect(page.getByText('Acknowledge the development test conditions before continuing.', { exact: true })).toBeVisible()
  await expect(page.locator('input[aria-invalid=true]').first()).toBeFocused()
})

test('global theme survives refresh, route changes, logout and a fresh browser session', async ({ page, context, browser }) => {
  await signIn(page, alpha)
  await page.goto('/patient/settings')
  const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/patient/prescriptions')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const second = await context.newPage()
  await second.goto('/privacy')
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/patient/settings')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  const state = await context.storageState()
  const fresh = await browser.newContext({ storageState: { cookies: [], origins: state.origins.map(origin => ({ ...origin, localStorage: origin.localStorage.filter(item => item.name === 'qarevo.theme.v1') })) } })
  const freshPage = await fresh.newPage()
  await freshPage.goto('/auth/sign-in')
  await expect(freshPage.locator('html')).toHaveAttribute('data-theme', 'dark')
  await fresh.close()
})


for (const portal of ['doctor', 'admin'] as const) {
  test(`${portal} has persistent theme and readable controls on desktop and mobile`, async ({ page, context }) => {
    await context.addInitScript(role => {
      localStorage.setItem('qarevo_access_token', 'synthetic-role-token')
      localStorage.setItem('qarevo_refresh_token', 'synthetic-role-refresh')
      localStorage.setItem('qarevo_user_id', 'synthetic-role-owner')
      localStorage.setItem('qarevo_role', role)
    }, portal === 'doctor' ? 'PROVIDER' : 'ADMIN')
    await context.route(`**/api/v1/${portal}/**`, route => {
      const path = new URL(route.request().url()).pathname
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (path.endsWith('/profile')) return route.fulfill({ headers: cors, json: { full_name: 'Synthetic Doctor', specialty: 'General Medicine' } })
      if (path.endsWith('/admin-users')) return route.fulfill({ headers: cors, json: { admin_users: [], total: 0 } })
      return route.fulfill({ headers: cors, json: { patients: [], total_count: 0, filtered_count: 0, page: 1, page_size: 20, has_previous: false, has_next: false } })
    })
    const path = portal === 'admin' ? '/admin/admin-users' : '/doctor/patients'
    await page.goto(path)
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    if (portal === 'admin') {
      await page.getByRole('button', { name: 'Add Admin User', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Create Admin', exact: true }).click()
      await expect(page.locator('#admin-full_name-error')).toContainText('Full name is required')
      await expect(page.locator('#admin-email-error')).toContainText('valid email')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

test('administrator can review credentials and suspend access with visible validation', async ({ page, context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('qarevo_access_token', 'synthetic-admin-token')
    localStorage.setItem('qarevo_refresh_token', 'synthetic-admin-refresh')
    localStorage.setItem('qarevo_user_id', 'synthetic-admin-owner')
    localStorage.setItem('qarevo_role', 'ADMIN')
  })
  const clinician = { id: 'synthetic-provider', provider_id: 'synthetic-provider', user_id: 'synthetic-doctor', full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', email_verified: true, phone: null, specialty: 'General Practice', license_number: 'TEST-LICENCE', status: 'ACTIVE', verification_status: 'PENDING_VERIFICATION' }
  const decisions: Record<string, unknown>[] = []
  await context.route('**/api/v1/admin/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'PUT') {
      const body = request.postDataJSON(); decisions.push(body)
      if (body.approve) clinician.verification_status = 'VERIFIED'
      if (body.status) clinician.status = body.status
      return route.fulfill({ headers, json: clinician })
    }
    if (path.endsWith('/pending')) return route.fulfill({ headers, json: clinician.verification_status === 'VERIFIED' ? [] : [clinician] })
    if (path.endsWith('/verification')) return route.fulfill({ headers, json: clinician })
    return route.fulfill({ headers, json: { doctors: [clinician], total: 1, limit: 50, offset: 0 } })
  })
  await page.goto('/admin/doctors')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clinician review' })
  await expect(dialog.getByText('TEST-LICENCE', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog.locator('#review-reference-error')).toContainText('4–500')
  await expect(dialog.locator('#review-confirmed-error')).toBeVisible()
  expect(decisions).toHaveLength(0)
  await dialog.getByLabel('Review reference or reason (Required)').fill('Synthetic credential review reference 123')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(decisions[0]).toMatchObject({ approve: true, review_confirmed: true, review_reference: 'Synthetic credential review reference 123' })
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await dialog.getByLabel('Decision (Required)').selectOption('suspend')
  await dialog.getByLabel('Review reference or reason (Required)').fill('Synthetic suspension test')
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(decisions[1]).toEqual({ status: 'SUSPENDED', reason: 'Synthetic suspension test' })
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible()
})

test('intake requires visible consent and keeps clinical text out of navigation URLs', async ({ page, context }) => {
  const episodeId = '11111111-1111-4111-8111-111111111111'
  const providerId = '22222222-2222-4222-8222-222222222222'
  const created: Record<string, unknown>[] = []
  await context.route('**/api/v1/patient/episodes**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (path.endsWith('/episodes') && method === 'POST') created.push(route.request().postDataJSON())
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: path.endsWith('/intake') ? { responses: { raw_text: 'Synthetic private concern' } } : { id: episodeId } })
  })
  await context.route(`**/api/v1/patient/doctors/${providerId}`, route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { id: providerId, name: 'Synthetic Clinician', specialty: 'General Practice', languages: [], insurance: [], services: [] } }))
  await signIn(page, alpha)
  await page.goto(`/patient/consultation-booking/intake?physicianId=${providerId}&date=2027-01-04&slot=09:00&notes=discard-legacy-query`)
  await page.getByRole('button', { name: 'Continue to Review' }).click()
  await expect(page.locator('[data-validation-summary]')).toContainText('Confirm the required data-processing choice')
  expect(created).toHaveLength(0)
  await page.getByLabel('Chief Complaint (Required)').fill('Synthetic private concern')
  await page.getByLabel('I agree to processing this synthetic intake').check()
  await expect(page.getByLabel('Allow optional AI assistance')).not.toBeChecked()
  await page.getByRole('button', { name: 'Continue to Review' }).click()
  await expect(page).toHaveURL(/consultation-booking\/review\?/)
  expect(created).toHaveLength(1)
  expect(created[0].consent_data_processing).toBe(true)
  expect(created[0].consent_ai_assistance).toBe(false)
  expect(new URL(page.url()).searchParams.has('notes')).toBe(false)
  expect([...new URL(page.url()).searchParams.values()].join(' ')).not.toContain('Synthetic private concern')
  await expect(page.getByText('Synthetic private concern', { exact: true })).toBeVisible()
  await expect(page.getByText('A. Bello', { exact: true })).toHaveCount(0)
})


test('video preparation never invents a clinician connection or clinical content', async ({ page }) => {
  await signIn(page, alpha)
  for (const route of ['live', 'waiting-room']) {
    await page.goto(`/patient/video-consultation/${route}`)
    await expect(page.locator('#feature-availability-title')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Check camera and microphone', exact: true })).toHaveAttribute('href', '/patient/video-consultation/device-check')
    await expect(page.getByText('Recording • On', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Clinical notes')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Patient reports fatigue')
    await expect(page.locator('body')).not.toContainText('Lab Results.pdf')
  }
})

test('unapproved legal and technical materials are not presented as certifications', async ({ page }) => {
  await page.goto('/cookies')
  await expect(page.getByRole('heading', { name: 'Cookie information is under review' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('GDPR Compliant')
  await page.goto('/whitepaper')
  await expect(page.getByRole('heading', { name: 'Our technical overview is being updated' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Certified Infrastructure')
  await page.goto('/auth')
  await expect(page.locator('body')).not.toContainText('SOC 2 Type II')
})


test('main navigation exposes dark mode on desktop and mobile and synchronizes tabs', async ({ page, context }) => {
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true })
  const toggle = navigation.getByRole('button', { name: 'Dark mode', exact: true })
  await expect(toggle).toBeVisible()
  await expect(toggle).toContainText('Dark mode')
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toggle.click()
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'light')
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(toggle).toBeVisible()
    const bounds = await toggle.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
  }
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await second.close()
})

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { clinicalFields, type PublishedClinicalRecord } from '../lib/clinical-record'
import { seedPortalSession, type TestPortal, type TestPortalIdentity } from './helpers/portal-session'

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
  holdLogout?: Promise<void>
  preserveSessionAfterLogout?: boolean
  recordsStatus?: number
  dashboardStatus?: number
  records?: Record<string, unknown>
  settingsStatus?: number
  holdSettings?: Promise<void>
  logoutCount?: number
  onboardingComplete?: boolean
  sessionId?: string
}
const scenarios = new WeakMap<BrowserContext, RenewalScenario>()
const seededIdentities = new WeakMap<BrowserContext, Partial<Record<TestPortal, TestPortalIdentity>>>()
async function seedRole(context: BrowserContext, portal: TestPortal, details: Partial<TestPortalIdentity> = {}) {
  const identity = await seedPortalSession(context, portal, details)
  const identities = seededIdentities.get(context) || {}
  identities[portal] = identity
  seededIdentities.set(context, identities)
  return identity
}

function authSession(email: string, sessionId = 'test-session:' + email) {
  return {
    browser_session: { user_id: email, role: 'PATIENT' as const, session_id: sessionId },
    user_id: email, role: 'PATIENT', token_type: 'bearer', expires_in: 900,
    email_verified: true, phone_verified: false,
  }
}

// All API requests are intercepted: these tests never create real accounts or send email.
async function mockApi(context: BrowserContext) {
  const scenario: RenewalScenario = { expireAccess: false, failure: 'none', refreshes: 0, rejectedAccess: 0 }
  const renewedSessions = new Set<string>()
  let activePatient: TestPortalIdentity | undefined
  let sessionSequence = 0
  const saved = new Map<string, Record<string, Record<string, unknown>>>()
  scenarios.set(context, scenario)
  await context.route('**/api/**', async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    // Mock the server-side HttpOnly session authority; browser requests carry only
    // a public concurrency marker, never Authorization or refresh credentials.
    expect(request.headers().authorization).toBeUndefined()
    const portal = (request.headers()['x-qarevo-portal'] || 'patient') as TestPortal
    const current = (portal === 'patient' ? activePatient : undefined) || seededIdentities.get(context)?.[portal]
    const marker = request.headers()['x-qarevo-session']
    const owner = current?.user_id || ''
    const account = saved.get(owner) || {}
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (pathname === '/api/v1/browser-csrf') return route.fulfill({ json: { csrf_token: 'synthetic-browser-csrf' } })
    if (!pathname.startsWith('/api/v1/auth/') && current && marker && current.session_id !== marker) return route.fulfill({ status: 409, json: { detail: { error_code: 'SESSION_CHANGED', message: 'Your session changed.' } } })
    if (pathname === '/api/v1/patient/profile-image') return route.fulfill({headers:cors,json:{image:null}})
    if (pathname === '/api/v1/session' || pathname === '/api/v1/session/activity') return current ? route.fulfill({ headers: cors, json: { browser_session: current, server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now()+900_000).toISOString(), absolute_expires_at: new Date(Date.now()+28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } }) : route.fulfill({ status: 401, json: { detail: 'Please sign in.' } })
    if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/verify-email-code') {
      const body = request.postDataJSON()
      activePatient = authSession(body.email, `test-session:${body.email}:${++sessionSequence}`).browser_session
      scenario.sessionId = activePatient.session_id
      renewedSessions.delete(activePatient.session_id)
      return route.fulfill({ headers: cors, json: authSession(body.email, activePatient.session_id) })
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
      expect(request.postDataJSON()).toEqual({})
      if (scenario.failure === 'rejected' || !current || marker !== current.session_id) return route.fulfill({ status: 401, headers: cors, json: { detail: 'Refresh session rejected' } })
      if (activePatient && marker !== activePatient.session_id) return route.fulfill({ status: 409, headers: cors, json: { detail: { error_code: 'SESSION_CHANGED' } } })
      renewedSessions.add(current.session_id)
      return route.fulfill({ headers: cors, json: authSession(current.user_id, current.session_id) })
    }
    if (pathname === '/api/v1/patient/settings') {
      await scenario.holdSettings
      if (scenario.settingsStatus) return route.fulfill({ headers: cors, status: scenario.settingsStatus, json: { detail: 'Settings unavailable' } })
      if (scenario.expireAccess && current && !renewedSessions.has(current.session_id)) {
        scenario.rejectedAccess++
        return route.fulfill({ status: 401, headers: cors, json: { detail: 'Invalid or expired access token' } })
      }
      const email = owner
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
      const next = scenario.onboardingComplete ? null : steps.find(step => !account[step]) || null
      return route.fulfill({ headers: cors, json: { ...account, personal: account.personal || {}, complete: !next, next_step: next, completed_steps: steps.filter(step => account[step]), coverage_verified: false, legal_ready: false, consent_version: 'dev-test-20261101' } })
    }
    if (pathname === '/api/v1/auth/logout') {
      scenario.logoutCount = (scenario.logoutCount || 0) + 1
      await scenario.holdLogout
      if (!scenario.preserveSessionAfterLogout && portal === 'patient' && activePatient?.session_id === marker) activePatient = undefined
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
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('qarevo:patient:signup:v2') || '{}').email)).toBe(beta)
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

test('verification reload restores only the tab email after a stable anonymous hydration snapshot', async ({ page }) => {
  const hydrationErrors: string[] = []
  const recordHydrationError = (message: string) => {
    if (/hydrat|Minified React error #(?:418|423|425)/i.test(message)) hydrationErrors.push(message)
  }
  page.on('pageerror', error => recordHydrationError(error.message))
  page.on('console', message => { if (message.type() === 'error') recordHydrationError(message.text()) })
  await page.goto('/auth/verify-email')
  await page.evaluate(email => sessionStorage.setItem('qarevo:patient:signup:v2', JSON.stringify({ email, expires_at: Date.now() + 30 * 60 * 1000 })), beta)
  // Browser-only state is absent from server-rendered HTML.
  const server = await page.request.get('/auth/verify-email')
  expect(await server.text()).not.toContain(beta)
  await page.reload()
  await expect(page.getByText('be•••@example.invalid', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click()
  await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(6)
  expect(hydrationErrors).toEqual([])
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('qarevo:patient:signup:v2') || '{}').email)).toBe(beta)
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
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null')?.session_id)).toBe(scenario.sessionId)
    expect(await page.evaluate(() => localStorage.getItem('qarevo_refresh_token'))).toBeNull()
    expect(scenario.refreshes).toBe(1)
    scenario.failure = 'none'
    await page.clock.setFixedTime(new Date(Date.now() + 11_000))
    await page.reload()
    await expect.poll(() => scenario.refreshes).toBe(2)
    await expect(page.locator('#email')).toHaveValue(alpha)
    await expect(page.getByText("We couldn't renew your session right now. Please try again shortly.", { exact: true })).toHaveCount(0)
    await expect(page.locator('#emergencyName')).toHaveValue('Unsaved contact survives outage')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null')?.session_id)).toBe(scenario.sessionId)
    expect(await page.evaluate(() => localStorage.getItem('qarevo_refresh_token'))).toBeNull()
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
  expect(await page.evaluate(() => localStorage.getItem('qarevo:patient:identity'))).toBeNull()
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('qarevo.draft.v3:patient:')))).toEqual([])
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
  expect(await page.evaluate(() => localStorage.getItem('qarevo:patient:identity'))).toBeNull()
  expect(await page.evaluate(email => Object.entries(sessionStorage).some(([key, value]) => key.includes(email) || value.includes('Private logout draft')), alpha)).toBe(false)
})

test('queued logout hides private UI until revocation settles and refuses stale cookie-only restoration', async ({ page, context }) => {
  await signIn(page, alpha)
  await page.goto('/patient/prescription-care-plan')
  await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toBeVisible()
  const scenario = scenarios.get(context)!
  let releaseRefresh!: () => void, releaseLogout!: () => void
  scenario.holdRefresh = new Promise<void>(resolve => { releaseRefresh = resolve })
  scenario.holdLogout = new Promise<void>(resolve => { releaseLogout = resolve })
  // Deliberately retain the synthetic server authority after logout so the
  // browser tombstone, rather than a mocked server rejection, proves this gate.
  scenario.preserveSessionAfterLogout = true
  scenario.expireAccess = true
  await page.reload()
  try {
    await expect.poll(() => scenario.refreshes).toBe(1)
    await page.locator('.pps-sidebar').getByRole('button', { name: 'Logout', exact: true }).click()
    const signingOut = page.getByRole('status').filter({ hasText: 'Signing out securely' })
    await expect(signingOut).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/patient\/prescription-care-plan$/)
    expect(scenario.logoutCount || 0).toBe(0)
    releaseRefresh()
    await expect.poll(() => scenario.logoutCount || 0).toBe(1)
    await expect(signingOut).toBeVisible()
    await expect(page).toHaveURL(/\/patient\/prescription-care-plan$/)
  } finally { releaseRefresh(); releaseLogout() }
  await expect(page).toHaveURL(/\/auth\/sign-in(?:\?|$)/)
  expect(await page.evaluate(() => localStorage.getItem('qarevo:patient:logout-pending'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('qarevo:patient:signed-out'))).toBe(scenario.sessionId)
  await page.goto('/patient/prescription-care-plan')
  await expect(page).toHaveURL(/\/auth\/sign-in(?:\?|$)/)
  await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toHaveCount(0)
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
  // Revisit within this same session: a stale autosave must not override the
  // successful server save, even before a fresh sign-in clears tab drafts.
  await page.goto('/auth/profile-setup/medical-history-allergies')
  await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/insurance-privacy-consent$/)
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
  await expect(page.locator('body')).not.toContainText('encrypted end-to-end')
  await page.locator('button[type=submit]').click()
  await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('form').getByRole('alert')).toContainText('Email address is required')
  await expect(page.locator('button[type=submit]')).toBeEnabled()
  await page.getByLabel('Email Address').fill(alpha)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('If an eligible account exists', { exact: false })).toBeVisible()
  await expect(page.locator('a[href="/auth/reset-password"]')).toHaveCount(0)
  await page.goto('/auth/reset-password')
  await expect(page.getByText('The password reset link is missing or invalid.', { exact: false })).toBeVisible()
  await page.goto('/auth/reset-password#token=synthetic-reset-token')
  await expect(page).toHaveURL(/\/auth\/reset-password$/)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('input[aria-invalid=true]')).toHaveCount(2)
  await page.getByLabel('New Password (Required)', { exact: true }).fill('SyntheticNewPassword123!')
  await page.getByLabel('Confirm New Password (Required)', { exact: true }).fill('SyntheticNewPassword123!')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('Your password has been successfully updated.', { exact: false })).toBeVisible()
  const portals = page.getByRole('navigation', { name: 'Choose your sign-in portal' })
  await expect(portals.getByRole('link', { name: 'Administrator sign-in' })).toHaveAttribute('href', '/auth/admin/login')
  await expect(portals.getByRole('link', { name: 'Clinician sign-in' })).toHaveAttribute('href', '/auth/doctor/login')
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

test('patient theme survives refresh, route changes and a fresh browser session', async ({ page, context, browser }) => {
  await signIn(page, alpha)
  await page.goto('/patient/settings')
  const toggle = page.getByRole('button', { name: /^(Dark|Light) mode$/ })
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
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  const state = await context.storageState()
  const fresh = await browser.newContext({ storageState: { cookies: [], origins: state.origins.map(origin => ({ ...origin, localStorage: origin.localStorage.filter(item => item.name === 'qarevo:patient:theme') })) } })
  const freshPage = await fresh.newPage()
  await freshPage.goto('/auth/sign-in')
  await expect(freshPage.locator('html')).toHaveAttribute('data-theme', 'dark')
  await fresh.close()
})


for (const portal of ['doctor', 'admin'] as const) {
  test(`${portal} has persistent theme and readable controls on desktop and mobile`, async ({ page, context }) => {
    await seedRole(context, portal, { user_id: 'synthetic-role-owner' })
    await context.route(`**/api/v1/${portal}/**`, route => {
      const path = new URL(route.request().url()).pathname
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (path.endsWith('/profile')) return route.fulfill({ headers: cors, json: { full_name: 'Synthetic Doctor', specialty: 'General Medicine' } })
      if (path.endsWith('/admin-users')) return route.fulfill({ headers: cors, json: { admin_users: [], total: 0, limit: 50, offset: 0, can_manage: true, current_admin_id: 'synthetic-owner' } })
      return route.fulfill({ headers: cors, json: { patients: [], total_count: 0, filtered_count: 0, page: 1, page_size: 20, has_previous: false, has_next: false } })
    })
    const path = portal === 'admin' ? '/admin/admin-users' : '/doctor/patients'
    await page.goto(path)
    await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    if (portal === 'admin') {
      await page.getByRole('button', { name: 'Invite administrator', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click()
      await expect(page.locator('#admin-full_name-error')).toContainText('Full name is required')
      await expect(page.locator('#admin-email-error')).toContainText('valid email')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: /^(Dark|Light) mode$/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

test('administrator can review credentials and suspend access with visible validation', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await seedRole(context, 'admin', { user_id: 'synthetic-admin-owner' })
  const clinician = { id: 'synthetic-provider', provider_id: 'synthetic-provider', user_id: 'synthetic-doctor', full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', email_verified: true, phone: null, specialty: 'General Practice', license_number: 'TEST-LICENCE', status: 'ACTIVE', verification_status: 'PENDING_VERIFICATION', can_review: true,
    clinical_access: { status: 'blocked', reason: 'approval_required', message: 'Administrator review and approval are required before clinical access.' } }
  const decisions: Record<string, unknown>[] = []
  await context.route('**/api/v1/admin/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'PUT') {
      const body = request.postDataJSON(); decisions.push(body)
      if (body.approve) { clinician.verification_status = 'VERIFIED'; clinician.clinical_access = { status: 'enabled', reason: 'approved', message: 'Clinical access is enabled.' } }
      if (body.status) { clinician.status = body.status; clinician.clinical_access = { status: 'blocked', reason: 'account_not_active', message: 'The clinician account is not active.' } }
      return route.fulfill({ headers, json: clinician })
    }
    if (path.endsWith('/pending')) return route.fulfill({ headers, json: clinician.verification_status === 'VERIFIED' ? [] : [clinician] })
    if (path.endsWith('/verification')) return route.fulfill({ headers, json: clinician })
    return route.fulfill({ headers, json: { doctors: [clinician], total: 1, limit: 50, offset: 0 } })
  })
  await page.goto('/admin/doctors')
  const card = page.getByRole('article', { name: 'Synthetic Clinician' })
  await expect(card.getByText('ACTIVE', { exact: true })).toBeVisible()
  await expect(card.getByText('Blocked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
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
  await expect(card.getByText('Enabled', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await dialog.getByLabel('Decision (Required)').selectOption('suspend')
  await dialog.getByLabel('Review reference or reason (Required)').fill('Synthetic suspension test')
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(decisions[1]).toEqual({ status: 'SUSPENDED', reason: 'Synthetic suspension test' })
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible()
  await expect(card.getByText('Blocked', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(card.getByText('Blocked', { exact: true })).toBeVisible()
})

test('read-only administrator can inspect clinical eligibility without approval controls', async ({ page, context }) => {
  await seedRole(context, 'admin', { user_id: 'synthetic-support' })
  const clinician = { id: 'synthetic-provider', provider_id: 'synthetic-provider', full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', status: 'ACTIVE', verification_status: 'PENDING_VERIFICATION', can_review: false,
    clinical_access: { status: 'blocked', reason: 'approval_required', message: 'Administrator review and approval are required before clinical access.' } }
  const writes: string[] = []
  await context.route('**/api/v1/admin/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() !== 'GET') { writes.push(path); return route.fulfill({ status: 403, headers, json: { detail: 'Operations access required' } }) }
    if (path.endsWith('/verification')) return route.fulfill({ headers, json: clinician })
    if (path.endsWith('/pending')) return route.fulfill({ headers, json: [clinician] })
    return route.fulfill({ headers, json: { doctors: [clinician], total: 1 } })
  })
  await page.goto('/admin/doctors')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clinician review' })
  await expect(dialog.getByRole('status')).toContainText('operations administrator access is required')
  await expect(dialog.getByText(clinician.clinical_access.message, { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save decision' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close clinician review' }).click()
  expect(writes).toEqual([])
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

test.describe('booking time contract in a different browser timezone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })
  test('confirmation submits the Berlin slot unchanged and displays a stale-slot error', async ({ page, context }) => {
    const providerId = '22222222-2222-4222-8222-222222222222'
    const episodeId = '11111111-1111-4111-8111-111111111111'
    const slot = { label: '9:00 AM', start_at: '2030-07-10T07:00:00+00:00', end_at: '2030-07-10T07:30:00+00:00', time_zone: 'Europe/Berlin', duration_minutes: 30 }
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    const booked: Record<string, unknown>[] = []
    let available = true
    await context.route(`**/api/v1/patient/doctors/${providerId}`, route => route.fulfill({ headers, json: { id: providerId, name: 'Synthetic Clinician', languages: [], insurance: [], services: [] } }))
    await context.route('**/api/v1/patient/booking-datetime/slots?**', route => route.fulfill({ headers, json: { date: '2030-07-10', slots: available ? [slot.label] : [], slot_details: available ? [slot] : [], schedule_ready: true } }))
    await context.route(`**/api/v1/patient/episodes/${episodeId}/intake`, route => route.fulfill({ headers, json: { responses: { raw_text: 'Synthetic rehearsal only' } } }))
    await context.route('**/api/v1/patient/appointments', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      booked.push(route.request().postDataJSON())
      return route.fulfill({ headers, json: { id: '33333333-3333-4333-8333-333333333333', episode_id: episodeId, consultation_id: '44444444-4444-4444-8444-444444444444', ...slot } })
    })
    await signIn(page, alpha)
    const query = new URLSearchParams({ physicianId: providerId, date: '2030-07-10', slot: slot.label, start_at: slot.start_at, episode_id: episodeId, intake_submitted: 'true' })
    const review = `/patient/consultation-booking/review?${query}`
    await page.goto(review)
    await expect(page.getByText('9:30 AM', { exact: true })).toBeVisible()
    await page.getByLabel('I have reviewed my synthetic booking information').check()
    await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
    await expect(page).toHaveURL(/consultation-booking\/success\?/)
    expect(booked).toHaveLength(1)
    expect(booked[0].start_at).toBe(slot.start_at)
    expect(booked[0].end_at).toBe(slot.end_at)
    available = false
    await page.goto(review)
    await expect(page.getByRole('alert').filter({ hasText: 'no longer available' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
    expect(booked).toHaveLength(1)
  })
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
  const toggle = navigation.getByRole('button', { name: /^(Dark|Light) mode$/ })
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
    await expect.poll(async () => {
      const bounds = await toggle.boundingBox()
      return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= width
    }).toBe(true)
  }
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await second.close()
})


test('patient dashboard and discovery retain the shared theme control outside the standard shell', async ({ page, context }) => {
  await signIn(page, alpha)
  scenarios.get(context)!.onboardingComplete = true
  await page.goto('/auth/profile-setup/profile-completed')
  await page.getByRole('link', { name: 'Continue to Dashboard', exact: true }).click()
  for (const route of ['/patient/dashboard', '/patient/find-doctor']) {
    await page.goto(route)
    const toggle = page.getByRole('button', { name: /^(Dark|Light) mode$/ })
    await expect(toggle).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Navigation menu', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 844 })
    await expect(toggle).toBeVisible()
    await expect.poll(async () => {
      const bounds = await toggle.boundingBox()
      return bounds ? bounds.x + bounds.width : Infinity
    }).toBeLessThanOrEqual(320)
    await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Navigation menu', exact: true })).toBeVisible()
    await page.getByRole('dialog', { name: 'Navigation menu', exact: true }).getByRole('button', { name: 'Close navigation menu', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Navigation menu', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 1280, height: 900 })
  }
})

 test('legacy password reset links are scrubbed and still submit the captured token', async ({ page, context }) => {
  let submitted: Record<string, unknown> | null = null
  await context.route('**/api/v1/auth/reset-password', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
    submitted = route.request().postDataJSON()
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { message: 'Password updated' } })
  })
  await page.goto('/auth/reset-password?token=legacy-synthetic-token&lang=de')
  await expect(page).toHaveURL(/reset-password\?lang=de$/)
  await page.getByLabel('New Password (Required)', { exact: true }).fill('SyntheticNewPassword123!')
  await page.getByLabel('Confirm New Password (Required)', { exact: true }).fill('SyntheticNewPassword123!')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByText('Your password has been successfully updated.', { exact: false })).toBeVisible()
  expect(submitted).toMatchObject({ token: 'legacy-synthetic-token' })
})

test('public preview avoids fabricated clinical outcomes, credentials and appointment availability', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'One place to prepare for your care' })).toBeVisible()
  for (const claim of ['ISO 27001', 'HIPAA', 'SOC 2', 'EMA Standards', 'Confidence score: 92%', 'Dr. Sarah Jenkins', 'Dr. Sarah Chen', 'AI-powered treatment recommendations', 'Oct 12, 14:00 CET']) {
    await expect(page.locator('body')).not.toContainText(claim)
  }
  await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toHaveCount(0)
})

async function mockAppointmentManagement(context: BrowserContext) {
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  const appointment = { id: '11111111-1111-4111-8111-111111111111', consultation_id: '22222222-2222-4222-8222-222222222222', provider_id: '33333333-3333-4333-8333-333333333333', provider_name: 'Synthetic Clinician', specialty: 'General medicine', status: 'BOOKED', consultation_modality: 'video', start_at: '2030-07-10T07:00:00Z', end_at: '2030-07-10T07:45:00Z', time_zone: 'Europe/Berlin' }
  const slot = { label: '10:00 AM', start_at: '2030-07-11T08:00:00Z', end_at: '2030-07-11T08:45:00Z', time_zone: 'Europe/Berlin', duration_minutes: 45 }
  const state = { available: true, cancelFailure: false, reschedules: [] as Record<string, unknown>[], cancellations: [] as { url: string; body: unknown }[] }
  await context.route('**/api/v1/patient/appointments**', route => route.fulfill({ headers, json: new URL(route.request().url()).pathname.endsWith(appointment.id) ? appointment : { appointments: [appointment], time_zone: 'Europe/Berlin' } }))
  await context.route('**/api/v1/patient/booking-datetime/availability**', route => route.fulfill({ headers, json: { availability: [{ date: '2030-07-11', slot_count: 1, status: 'available' }] } }))
  await context.route('**/api/v1/patient/booking-datetime/slots**', route => route.fulfill({ headers, json: { slot_details: state.available ? [slot] : [] } }))
  await context.route(`**/api/v1/appointments/${appointment.id}/reschedule`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    state.reschedules.push(route.request().postDataJSON())
    appointment.start_at = slot.start_at; appointment.end_at = slot.end_at
    return route.fulfill({ headers, json: { status: 'rescheduled' } })
  })
  await context.route(`**/api/v1/appointments/${appointment.id}/cancel`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    state.cancellations.push({ url: route.request().url(), body: route.request().postDataJSON() })
    if (state.cancelFailure) return route.fulfill({ headers, status: 503, json: { detail: 'Synthetic cancellation outage. Your appointment remains booked.' } })
    appointment.status = 'CANCELLED'
    return route.fulfill({ headers, json: { status: 'cancelled' } })
  })
  return { appointment, slot, state }
}

test('rescheduling saves exact server times and details survive a refresh', async ({ page, context }) => {
  const { appointment, slot, state } = await mockAppointmentManagement(context)
  await signIn(page, alpha)
  await page.goto('/patient/appointments')
  await expect(page.getByText('· 45 min', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reschedule appointment', exact: true })
  await dialog.getByRole('button', { name: 'Confirm reschedule', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Select an available date and time')
  await dialog.getByLabel('Date — required').selectOption('2030-07-11')
  await dialog.getByLabel('Time — required').selectOption(slot.start_at)
  await dialog.getByRole('button', { name: 'Confirm reschedule', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.reschedules).toEqual([{ start_at: slot.start_at, end_at: slot.end_at, reason: 'Patient requested reschedule' }])
  await page.getByRole('button', { name: 'View Details', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`appointmentId=${appointment.id}`))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Synthetic Clinician', exact: true })).toBeVisible()
  await expect(page.getByText(/Thu, 11 July 2030/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open video room' })).toHaveAttribute('href', new RegExp(appointment.consultation_id))
  await expect(page.locator('body')).not.toContainText('Your selected plan is verified')
})

test('stale reschedule and failed cancellation remain visible without false refund claims', async ({ page, context }) => {
  const { slot, state } = await mockAppointmentManagement(context)
  await signIn(page, alpha)
  await page.goto('/patient/appointments')
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  const reschedule = page.getByRole('dialog', { name: 'Reschedule appointment', exact: true })
  await reschedule.getByLabel('Date — required').selectOption('2030-07-11')
  await reschedule.getByLabel('Time — required').selectOption(slot.start_at)
  state.available = false
  await reschedule.getByRole('button', { name: 'Confirm reschedule', exact: true }).click()
  await expect(reschedule.getByRole('alert')).toContainText('no longer available')
  expect(state.reschedules).toHaveLength(0)
  await reschedule.getByRole('button', { name: 'Keep current appointment' }).click()
  await page.getByRole('button', { name: 'Cancel Appointment', exact: true }).click()
  const cancellation = page.getByRole('dialog', { name: 'Cancel appointment?', exact: true })
  await cancellation.getByLabel('Reason for cancellation — optional').fill('SYNTHETIC-PRIVATE-REASON')
  state.cancelFailure = true
  await cancellation.getByRole('button', { name: 'Cancel appointment', exact: true }).click()
  await expect(cancellation.getByRole('alert')).toContainText('Synthetic cancellation outage')
  state.cancelFailure = false
  await cancellation.getByRole('button', { name: 'Cancel appointment', exact: true }).click()
  await expect(cancellation).toHaveCount(0)
  expect(state.cancellations[0].body).toEqual({ reason: 'SYNTHETIC-PRIVATE-REASON' })
  expect(state.cancellations.every(request => !request.url.includes('reason='))).toBe(true)
  await expect(page.getByRole('status')).toContainText('No payment or refund was processed')
  await expect(page.getByText('Payment Refunded', { exact: true })).toHaveCount(0)
})

for (const role of ['patient', 'doctor'] as const) {
  test(`${role} video room exposes provider errors and never pretends to connect`, async ({ page, context }) => {
    const id = '55555555-5555-4555-8555-555555555555'
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    let joins = 0
    let allowed = true
    const awsRequests: string[] = []
    page.on('request', request => { if (new URL(request.url()).hostname.endsWith('amazonaws.com')) awsRequests.push(request.url()) })
    await context.route(`**/api/v1/consultations/${id}**`, route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      if (route.request().url().endsWith('/join')) {
        joins++
        return route.fulfill({ status: 503, headers, json: { detail: 'Live video is not enabled in this development environment. Your appointment remains saved.' } })
      }
      return allowed ? route.fulfill({ headers, json: { consultation_id: id, status: 'SCHEDULED', scheduled_at: '2030-07-10T07:00:00Z' } }) : route.fulfill({ status: 404, headers, json: { detail: 'Consultation not found' } })
    })
    if (role === 'patient') await signIn(page, alpha)
    else {
      await seedRole(context, 'doctor', { user_id: 'synthetic-role-owner' })
      await context.route('**/api/v1/doctor/profile', route => route.fulfill({ headers, json: { full_name: 'Synthetic Doctor', specialty: 'General Medicine' } }))
    }
    const path = role === 'patient' ? '/patient/video-consultation/waiting-room' : '/doctor/video-consultation'
    await page.goto(`${path}?consultationId=${id}`)
    await expect(page.getByRole('button', { name: 'Join consultation', exact: true })).toBeVisible()
    expect(joins).toBe(0)
    await page.getByRole('button', { name: 'Join consultation', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Live video is not enabled' })).toBeVisible()
    expect(joins).toBe(1)
    expect(awsRequests).toEqual([])
    await expect(page.getByText('Connected · Other participant present', { exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    allowed = false
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: 'Consultation not found' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join consultation', exact: true })).toHaveCount(0)
    expect(joins).toBe(1)
  })
}

const recordConsultation = '66666666-6666-4666-8666-666666666666'
const approvedRecord: PublishedClinicalRecord = {
  id: '77777777-7777-4777-8777-777777777777', episode_id: '88888888-8888-4888-8888-888888888888',
  consultation_id: recordConsultation, revision: 1, version: 2, language: 'en', summary: 'Synthetic patient summary',
  history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: 'Synthetic care plan',
  safety_net: 'Synthetic safety advice', authored_by: 'synthetic-clinician', approved_by: 'synthetic-clinician',
  published_at: '2030-07-10T08:00:00Z', created_at: '2030-07-10T07:45:00Z', updated_at: '2030-07-10T08:00:00Z', amendment_reason: null,
}

test('clinician draft persists and requires explicit review, with recoverable publication and amendments', async ({ page, context }) => {
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  let draft: PublishedClinicalRecord | null = null
  let published: PublishedClinicalRecord | null = null
  let publicationFailure = true
  let publications = 0
  const savedBodies: Record<string, unknown>[] = []
  await seedRole(context, 'doctor', { user_id: 'synthetic-role-owner' })
  await context.route('**/api/v1/doctor/profile', route => route.fulfill({ headers, json: { full_name: 'Synthetic Doctor', specialty: 'General Medicine' } }))
  await context.route(`**/api/v1/doctor/workspace/${recordConsultation}**`, route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const url = new URL(request.url()).pathname
    if (url.endsWith('/clinical-record/publish')) {
      publications++
      if (publicationFailure) return route.fulfill({ status: 503, headers, json: { detail: 'Publication could not be confirmed. Retry to recover safely.' } })
      expect(request.postDataJSON()).toMatchObject({ record_id: draft!.id, expected_version: draft!.version, reviewed: true })
      published = { ...draft!, approved_by: 'synthetic-clinician', published_at: approvedRecord.published_at, version: draft!.version + 1 }
      draft = null
      return route.fulfill({ headers, json: published })
    }
    if (url.endsWith('/clinical-record')) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON(); savedBodies.push(body)
        draft = { ...approvedRecord, ...body, id: published ? '99999999-9999-4999-8999-999999999999' : approvedRecord.id,
          revision: published ? 2 : 1, version: draft ? draft.version + 1 : 1, published_at: null, approved_by: null }
        return route.fulfill({ headers, json: draft })
      }
      return route.fulfill({ headers, json: { draft, published } })
    }
    return route.fulfill({ headers, json: { consultation: { consultation_id: recordConsultation, patient_name: 'Synthetic Patient', patient_id: 'synthetic-patient', status: published ? 'ENDED' : 'STARTED', started_at: '2030-07-10T07:00:00Z' }, can_join_video: false, can_complete: !published } })
  })
  await page.goto(`/doctor/workspace/${recordConsultation}`)
  await page.getByRole('button', { name: 'Approve and publish', exact: true }).click()
  await expect(page.getByText('Patient summary is required before publication.', { exact: true })).toBeVisible()
  expect(publications).toBe(0)
  for (const field of clinicalFields) await page.locator(`#record-${field.key}`).fill(approvedRecord[field.key])
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('It is not visible to the patient')
  await page.reload()
  await expect(page.locator('#record-summary')).toHaveValue(approvedRecord.summary)
  await page.getByRole('button', { name: 'Approve and publish', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Confirm that you reviewed' })).toBeVisible()
  expect(publications).toBe(0)
  await page.getByRole('checkbox', { name: /I have reviewed this saved record/ }).check()
  await page.getByRole('button', { name: 'Approve and publish', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Publication could not be confirmed' })).toBeVisible()
  await expect(page.locator('#record-summary')).toHaveValue(approvedRecord.summary)
  publicationFailure = false
  await page.getByRole('button', { name: 'Approve and publish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Published care summary' })).toBeVisible()
  await page.getByRole('button', { name: 'Create amendment', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByText('Enter an amendment reason of 4–500 characters.', { exact: true })).toBeVisible()
  await page.getByLabel('Amendment reason (required)').fill('Synthetic correction')
  await page.locator('#record-summary').fill('Corrected synthetic patient summary')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('It is not visible to the patient')
  expect(savedBodies[1]).toMatchObject({ record_id: approvedRecord.id, expected_version: 2, amendment_reason: 'Synthetic correction' })
  expect(published!.summary).toBe(approvedRecord.summary)
  const storageText = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storageText).not.toContain('Synthetic patient summary')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('patient sees no unsigned summary and reads the approved version after refresh', async ({ page, context }) => {
  let published = false
  await context.route('**/api/v1/patient/consultation-summary**', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' }, status: published ? 200 : 404,
    json: published ? approvedRecord : { detail: 'No published summary is available' },
  }))
  await signIn(page, alpha)
  await page.goto(`/patient/consultation-summary?consultationId=${recordConsultation}`)
  await expect(page.getByRole('heading', { name: 'No consultation summary available' })).toBeVisible()
  await expect(page.getByText(approvedRecord.summary, { exact: true })).toHaveCount(0)
  published = true
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Clinician-approved consultation summary' })).toBeVisible()
  await expect(page.getByText(approvedRecord.safety_net, { exact: true })).toBeVisible()
  await expect(page.getByText('Revision 1', { exact: false })).toBeVisible()
})

for (const width of [320, 820, 1440]) {
  test(`coverage at ${width}px explains invalid input and preserves dark mode`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await signIn(page, alpha)
    await page.goto('/auth/profile-setup/insurance-privacy-consent')
    const submit = page.getByRole('button', { name: 'Complete Profile', exact: true })
    await expect(submit).toBeEnabled()
    await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
    await submit.click()
    await expect(page.locator('#coverage-type-error')).toHaveText('Select a funding type.')
    await expect(page.locator('input[type=checkbox][required][aria-invalid=true]')).toHaveCount(4)
    await page.getByLabel('Funding type (Required)').selectOption('GKV')
    await page.getByLabel('Insurance number (KVNR) (Required)', { exact: true }).fill('garbage')
    await submit.click()
    const number = page.getByLabel('Insurance number (KVNR) (Required)', { exact: true })
    await expect(number).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await number.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.getByRole('alert').filter({ hasText: 'Use one capital letter and nine digits.' })).toBeVisible()
    await expect(submit).toBeEnabled()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(number).toHaveValue('garbage')
    await page.screenshot({ path: testInfo.outputPath(`coverage-${width}-dark.png`), fullPage: true })
  })
}

for (const role of ['admin', 'doctor']) {
  test(`${role} sign-in exposes required labels, errors and safe password recovery`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto(`/auth/${role}/login`)
    await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
    const passwordField = page.getByLabel('Password (Required)', { exact: true })
    await expect(passwordField).toHaveAttribute('autocomplete', 'current-password')
    await page.locator('button[type=submit]').click()
    await expect(page.locator('input[aria-invalid=true]')).toHaveCount(2)
    await expect(passwordField).toHaveAttribute('aria-describedby', /.+/)
    await expect(page.locator('form').getByRole('alert').filter({ hasText: /password/i })).toBeVisible()
    await expect(page.locator('button[type=submit]')).toBeEnabled()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByRole('link', { name: /Forgot.*password/ }).click()
    await expect(page).toHaveURL(new RegExp(`/auth/${role}/forgot-password$`))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
}


for (const [portal, route] of [
  ['administrator', '/auth/admin/login'],
  ['clinician', '/auth/doctor/login'],
] as const) {
  test(`${portal} sign-in explains backend lockout instead of hiding it`, async ({page,context}) => {
    await context.route('**/api/v1/auth/**/login', route => route.request().method()==='OPTIONS' ? route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}}) : route.fulfill({status:429,
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},
      json:{detail:{error_code:'TOO_MANY_LOGIN_ATTEMPTS',message:'Too many failed login attempts. Try again in 15 minutes.',retry_after_seconds:900}}}))
    await page.goto(route)
    await page.locator('input[autocomplete="email"],input[autocomplete="username"]').fill('synthetic@example.com')
    await page.getByLabel('Password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('alert').filter({hasText:'Password recovery remains available.'})).toBeVisible()
    await expect(page.getByRole('link',{name:/Forgot.*password/})).toBeVisible()
  })
}

test('administrator invitation validates passwords, clears the URL secret and requires explicit sign-in', async ({page,context}) => {
  let submitted = 0
  await context.route('**/api/v1/auth/admin/invitations/validate', route => route.fulfill({json:submitted ? {valid:false} : {valid:true,expires_at:new Date(Date.now()+86400000).toISOString()}}))
  await context.route('**/api/v1/auth/admin/invitations/accept', route => {
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
    submitted++
    expect(route.request().postDataJSON().token).toBe('synthetic-invitation-only')
    return route.fulfill({headers:{'access-control-allow-origin':'*'},json:{message:'Activated'}})
  })
  await page.goto('/auth/admin/accept-invitation#token=synthetic-invitation-only')
  await expect(page).toHaveURL(/\/accept-invitation$/)
  await page.getByRole('button',{name:'Activate administrator account'}).click()
  await expect(page.locator('#invite-password-error')).toBeVisible()
  expect(submitted).toBe(0)
  await page.getByLabel('New password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
  await page.getByLabel('Confirm password (Required)',{exact:true}).fill('different')
  await page.getByRole('button',{name:'Activate administrator account'}).click()
  await expect(page.locator('#invite-confirm-error')).toBeVisible()
  await page.getByLabel('Confirm password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
  await page.getByRole('button',{name:'Activate administrator account'}).click()
  await expect(page.getByRole('link',{name:'Continue to administrator sign-in'})).toHaveAttribute('href','/auth/admin/login')
  expect(submitted).toBe(1)
  await page.goto('/auth/admin/accept-invitation#token=synthetic-invitation-only')
  await expect(page.getByRole('heading',{name:'Invitation unavailable'})).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Forgot your password?'})).toBeVisible()
  expect(submitted).toBe(1)
})

for (const managing of [true, false]) {
  test(`administrator directory enforces ${managing ? 'owner controls and canonical contracts' : 'read-only controls'}`, async ({page,context}) => {
    await seedRole(context, 'admin', { user_id: 'synthetic-owner-user' })
    const rows = [{id:'synthetic-owner',user_id:'synthetic-owner-user',email:'owner@example.invalid',full_name:'Synthetic Owner',role:'super_admin',status:'ACTIVE',created_at:'2026-11-03T00:00:00Z',last_login_at:null}]
    const writes: Record<string,unknown>[]=[]
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    await context.route('**/api/v1/admin/admin-users**',route=>{
      const request=route.request()
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers})
      if(request.method()==='POST') {
        const body=request.postDataJSON();writes.push(body)
        expect(body.role).toBe('operations_admin');expect(body.password).toBeUndefined()
        const invited={...rows[0],...body,id:'synthetic-invite',user_id:'synthetic-invite-user',status:'INVITED'}
        rows.push(invited)
        return route.fulfill({status:201,headers,json:invited})
      }
      if(request.method()==='PUT')return route.fulfill({status:400,headers,json:{detail:'Cannot remove the last active super administrator. Activate another super administrator first.'}})
      return route.fulfill({headers,json:{admin_users:rows,total:rows.length,limit:50,offset:0,can_manage:managing,current_admin_id:'synthetic-owner'}})
    })
    await page.setViewportSize({width:390,height:844})
    await page.goto('/admin/admin-users')
    await expect(page.getByRole('heading',{name:'Synthetic Owner (you)'})).toBeVisible()
    if(!managing) {
      await expect(page.getByRole('button',{name:'Invite administrator',exact:true})).toHaveCount(0)
      await expect(page.getByRole('button',{name:'Suspend access',exact:true})).toHaveCount(0)
      return
    }
    await page.getByRole('button',{name:'Invite administrator',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.getByLabel('Full Name (Required)',{exact:true}).fill('Synthetic Colleague')
    await dialog.getByLabel('Email (Required)',{exact:true}).fill('colleague@example.invalid')
    await dialog.getByLabel('Role (Required)',{exact:true}).selectOption('operations_admin')
    await dialog.getByRole('button',{name:'Send invitation',exact:true}).click()
    await expect(page.getByRole('status').filter({hasText:'Invitation accepted for email delivery'})).toBeVisible()
    await expect(page.getByRole('heading',{name:'Synthetic Colleague'})).toBeVisible()
    expect(writes).toHaveLength(1)
    await page.getByRole('button',{name:'Suspend access',exact:true}).click()
    await dialog.getByLabel('Reason (Required)',{exact:true}).fill('Synthetic guard test')
    await dialog.getByRole('button',{name:'Save changes',exact:true}).click()
    await expect(dialog.getByText('Cannot remove the last active super administrator. Activate another super administrator first.',{exact:true})).toBeVisible()
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  })
}


for (const [portal,path,endpoint] of [
  ['administrator','/auth/admin/login','/api/v1/auth/admin/login'],
  ['patient','/auth/sign-in','/api/v1/auth/login'],
  ['clinician','/auth/doctor/login','/api/v1/auth/doctor/login'],
] as const) {
  test(`${portal} distinguishes incorrect credentials from email format validation`, async ({page,context}) => {
    let submitted = 0
    await context.route('**'+endpoint, route => {
      if (route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
      submitted++
      if(portal!=='clinician') expect(route.request().postDataJSON().email).toBe('synthetic@example.com')
      return route.fulfill({status:401,json:{detail:'Invalid email or password'}})
    })
    await page.goto(path)
    await page.locator('input[autocomplete="email"],input[autocomplete="username"]').fill(' synthetic@example.com ')
    await page.getByLabel('Password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('alert').filter({hasText:/Incorrect email or password|Invalid email, username, phone, or password/})).toBeVisible()
    await expect(page.getByText('Enter a valid email address.',{exact:true})).toHaveCount(0)
    expect(submitted).toBe(1)
  })
}

test('invitation check fails closed, allows retry, and rejects consumption in another tab', async ({page,context}) => {
  let checks=0
  await context.route('**/api/v1/auth/admin/invitations/validate',route=>{
    checks++
    return checks===1 ? route.fulfill({status:503,json:{detail:'Synthetic outage'}}) : route.fulfill({json:{valid:true,expires_at:new Date(Date.now()+86400000).toISOString()}})
  })
  await context.route('**/api/v1/auth/admin/invitations/accept',route=>route.fulfill({status:400,json:{detail:'This invitation is invalid, expired or already used.'}}))
  await page.goto('/auth/admin/accept-invitation#token=synthetic-race-token')
  await expect(page.getByRole('button',{name:'Retry invitation check'})).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await page.getByRole('button',{name:'Retry invitation check'}).click()
  await page.getByLabel('New password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
  await page.getByLabel('Confirm password (Required)',{exact:true}).fill('Synthetic-only-Password42!')
  await page.getByRole('button',{name:'Activate administrator account'}).click()
  await expect(page.getByRole('heading',{name:'Invitation unavailable'})).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
})

test('invitation form expires while open without sending a password', async ({page,context}) => {
  let writes=0
  await context.route('**/api/v1/auth/admin/invitations/validate',route=>route.fulfill({json:{valid:true,expires_at:new Date(Date.now()+2500).toISOString()}}))
  await context.route('**/api/v1/auth/admin/invitations/accept',route=>{writes++;return route.fulfill({json:{message:'Unexpected'}})})
  await page.goto('/auth/admin/accept-invitation#token=synthetic-expiring-token')
  await expect(page.getByRole('button',{name:'Activate administrator account'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Invitation unavailable'})).toBeVisible({timeout:10000})
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  expect(writes).toBe(0)
})

for (const role of ['admin', 'doctor'] as const) {
  test(`${role} recovery keeps portal context and accepts fragment links once`, async ({ page, context }) => {
    let resets = 0
    await context.route('**/api/v1/auth/reset-password', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
      resets++
      expect(route.request().postDataJSON().token).toBe('synthetic-role-reset')
      return route.fulfill({json:{message:'Password has been reset successfully.'}})
    })
    await page.setViewportSize({width:320,height:900})
    await page.goto(`/auth/${role}/forgot-password`)
    await expect(page.getByRole('heading',{name:role==='admin'?'Recover administrator access':'Recover clinician access'})).toBeVisible()
    await expect(page.getByRole('link',{name:'Create New Account'})).toHaveCount(0)
    await expect(page.getByRole('link',{name:'Back to Sign In'}).first()).toHaveAttribute('href',`/auth/${role}/login`)
    await page.getByLabel('Email Address').fill(alpha)
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('button',{name:/Resend available in/})).toBeDisabled()
    await expect(page.getByText('requesting another link replaces earlier links.',{exact:false})).toBeVisible()
    await page.goto(`/auth/${role}/reset-password#token=synthetic-role-reset`)
    await expect(page).toHaveURL(new RegExp(`/auth/${role}/reset-password$`))
    await page.getByLabel('New Password (Required)',{exact:true}).fill('SyntheticNewPassword123!')
    await page.getByLabel('Confirm New Password (Required)',{exact:true}).fill('SyntheticNewPassword123!')
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('link',{name:'Continue to Sign In'})).toHaveAttribute('href',`/auth/${role}/login`)
    expect(resets).toBe(1)
    await expect(page.locator('input[type=password]')).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Reopen the full link from your newest reset email.',{exact:false})).toBeVisible()
    await expect(page.getByRole('link',{name:'Request New Reset Link'})).toHaveAttribute('href',`/auth/${role}/forgot-password`)
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true)
  })
}

for (const [role,path,endpoint] of [
  ['admin','/auth/admin/login','/api/v1/auth/admin/login'],
  ['doctor','/auth/doctor/login','/api/v1/auth/doctor/login'],
  ['patient','/auth/sign-in','/api/v1/auth/login'],
] as const) {
  test(`${role} login visibly counts down a server lockout without retrying`, async ({page,context}) => {
    let attempts=0
    await context.route('**'+endpoint, route=>{
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
      attempts++
      return route.fulfill({status:429,json:{detail:{error_code:'TOO_MANY_LOGIN_ATTEMPTS',retry_after_seconds:2,message:'Too many failed login attempts.'}}})
    })
    await page.goto(path)
    await page.locator('input[autocomplete="email"],input[autocomplete="username"]').fill(alpha)
    await page.getByLabel('Password (Required)',{exact:true}).fill('Synthetic-only-password42!')
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('alert').filter({hasText:'Password recovery remains available.'})).toBeVisible()
    await expect(page.locator('button[type=submit]')).toBeDisabled()
    await expect(page.getByRole('alert').filter({hasText:'The retry window has ended.'})).toBeVisible({timeout:5000})
    await expect(page.locator('button[type=submit]')).toBeEnabled()
    expect(attempts).toBe(1)
  })
}


test('patient profile image previews, validates, saves and removes without changing another identity',async({page,context})=>{
  let image:string|null=null
  let saves=0
  await context.route('**/api/v1/patient/profile-image',route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
    if(route.request().method()==='POST'){saves++;image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAMAjAsK7KkT4RPLhGQR4MZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncV4Htj5g3AEAi5NIywAAAABJRU5ErkJggg=='}
    if(route.request().method()==='DELETE')image=null
    return route.fulfill({json:{image}})
  })
  await signIn(page,alpha)
  await page.goto('/patient/settings')
  const editor=page.getByRole('region',{name:'Profile image',exact:true})
  await editor.getByLabel('Profile image',{exact:true}).setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')})
  await expect(editor.getByRole('alert').filter({hasText:'Choose a JPEG, PNG or WebP image, up to 2 MB.'})).toBeVisible()
  expect(saves).toBe(0)
  await editor.getByLabel('Profile image',{exact:true}).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAMAjAsK7KkT4RPLhGQR4MZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncV4Htj5g3AEAi5NIywAAAABJRU5ErkJggg==','base64')})
  await expect(editor.getByAltText('Selected profile image preview')).toBeVisible()
  await editor.getByRole('button',{name:'Save image',exact:true}).click()
  await expect(editor.getByRole('status').filter({hasText:'Profile image updated.'})).toBeVisible()
  expect(saves).toBe(1)
  await page.reload()
  await expect(editor.getByRole('button',{name:'Remove image',exact:true})).toBeVisible()
  await editor.getByRole('button',{name:'Remove image',exact:true}).click()
  await expect(editor.getByRole('status').filter({hasText:'Profile image removed.'})).toBeVisible()
  await expect(editor.getByRole('button',{name:'Remove image',exact:true})).toHaveCount(0)
})

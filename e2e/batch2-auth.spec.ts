import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
async function providers(context: BrowserContext, enabled = false) {
  await context.route('**/api/v1/browser-csrf',route=>route.fulfill({json:{csrf_token:'synthetic-csrf'}}))
  await context.route(url => url.pathname === '/api/v1/auth/social/providers', route => route.fulfill({ headers: cors, json: { google: { enabled, message: null }, apple: { enabled, message: null } } }))
}

test('sign-in policy never promises extended persistence and unsupported passkeys cannot start authentication', async ({ page, context }) => {
  await providers(context)
  await context.addInitScript(() => Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: undefined }))
  let passkeyRequests = 0
  await context.route('**/api/v1/auth/passkeys/**', route => {
    passkeyRequests++
    return route.fulfill({ status: 400, headers: cors, json: { detail: 'Unexpected synthetic passkey request' } })
  })
  for (const path of ['/auth/sign-in', '/auth/doctor/login', '/auth/admin/login']) {
    await page.goto(path)
    await expect(page.getByText('For your security, sessions expire after inactivity or the maximum session duration. Save your work when an expiry warning appears.', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /remember/i })).toHaveCount(0)
    await expect(page.getByText(/30 days|AES-256|Personalised clinical intelligence|HD video with verified physicians/)).toHaveCount(0)
    if (path === '/auth/sign-in') {
      const passkey = page.getByRole('button', { name: 'Sign in with passkey', exact: true })
      await expect(passkey).toBeDisabled()
      await expect(passkey).toHaveAttribute('aria-describedby', 'patient-passkey-help')
      await expect(page.locator('#patient-passkey-help')).toHaveText('Passkeys require a supported browser on HTTPS or localhost. Use your password to sign in.')
    }
  }
  expect(passkeyRequests).toBe(0)
})

for (const [portal, opposite, path, endpoint, intended, action] of [
  ['PATIENT', 'PROVIDER', '/auth/sign-in', '/api/v1/auth/login', '/doctor/appointments', 'Continue to physician sign-in'],
  ['PROVIDER', 'PATIENT', '/auth/doctor/login', '/api/v1/auth/doctor/login', '/patient/appointments', 'Continue to patient sign-in'],
] as const) {
  test(`${portal} sign-in explains a password-proven wrong portal without issuing a session`, async ({ page, context }) => {
    await providers(context)
    let calls = 0
    await context.route('**' + endpoint, route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      calls++
      return route.fulfill({ status: 403, headers: cors, json: { detail: { error_code: 'WRONG_PORTAL', portal: opposite, sign_in_path: 'https://untrusted.invalid', message: 'Password-proven portal mismatch' } } })
    })
    await page.goto(path + '?' + new URLSearchParams({ next: intended }))
    await page.locator('input[autocomplete="email"],input[autocomplete="username"]').fill('synthetic-role@example.com')
    await page.getByLabel('Password (Required)', { exact: true }).fill('Synthetic-password42!')
    await page.locator('button[type=submit]').click()
    const expectedPath = opposite === 'PATIENT' ? '/auth/sign-in' : '/auth/doctor/login'
    await expect(page.getByRole('link', { name: action, exact: true })).toHaveAttribute('href', expectedPath + '?' + new URLSearchParams({ next: intended }))
    await expect(page.getByRole('alert').filter({ hasText: 'This account is registered for' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('qarevo_access_token'))).toBeNull()
    expect(calls).toBe(1)
    await page.getByRole('link', { name: action, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(expectedPath + '\\?next='))
  })
}

test('patient and physician secondary sign-in references are visible and never offer role escalation', async ({ page, context }) => {
  await providers(context)
  await page.goto('/auth/sign-in')
  await expect(page.getByRole('navigation', { name: 'Other sign-in portal' }).getByRole('link', { name: 'Physician sign-in' })).toHaveAttribute('href', '/auth/doctor/login')
  await page.goto('/auth/doctor/login')
  await expect(page.getByRole('navigation', { name: 'Other sign-in portal' }).getByRole('link', { name: 'Patient sign-in' })).toHaveAttribute('href', '/auth/sign-in')
  await expect(page.getByRole('navigation', { name: 'Other sign-in portal' }).getByRole('link', { name: /admin/i })).toHaveCount(0)
})

for (const width of [320, 820, 1440]) {
  test(`provider buttons keep recognizable marks and stable theme states at ${width}px`, async ({ page, context }, testInfo) => {
    await providers(context)
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/auth/sign-in')
    const options = page.getByRole('region', { name: 'Alternative sign-in' })
    await expect(options.getByRole('button', { name: 'Continue with Google', exact: true })).toBeDisabled()
    await expect(options.getByRole('button', { name: 'Continue with Apple', exact: true })).toBeDisabled()
    await expect(options.locator('svg')).toHaveCount(2)
    await expect(options.getByRole('status')).toContainText('configuration is completed')
    await expect(options.getByRole('link', { name: 'Connect a provider after signing in', exact: true })).toHaveClass(/q-button/)
    await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`batch2-provider-${width}.png`), fullPage: true })
  })
}

test('provider start shows accessible loading, blocks duplicate starts and exposes provider failure', async ({ page, context }) => {
  await providers(context, true)
  let release: () => void = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  let starts = 0
  await context.route('**/api/v1/auth/social/google/start', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    starts++
    await held
    return route.fulfill({ status: 503, headers: cors, json: { detail: 'Synthetic provider temporarily unavailable.' } })
  })
  await page.goto('/auth/sign-in')
  const google = page.getByRole('button', { name: 'Continue with Google', exact: true })
  await expect(google).toBeEnabled()
  await google.click()
  await expect(google).toHaveAttribute('aria-busy', 'true')
  await expect(google).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Continue with Apple', exact: true })).toBeDisabled()
  release()
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic provider temporarily unavailable.' })).toBeVisible()
  await expect(google).toBeEnabled()
  expect(starts).toBe(1)
})

test('security password fields have visibility, inline validation, cancel and confirmed session revocation', async ({ page, context }) => {
  const identity = await seedPortalSession(context, 'admin', {user_id:'synthetic-batch2-owner'})
  let revocations = 0
  await context.route('**/api/v1/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if (path.startsWith('/api/v1/session')) return route.fulfill({ headers: cors, json:{browser_session:identity,server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path === '/api/v1/security') return route.fulfill({ headers: cors, json: { password_change_available: true, mfa: { enabled: false, available: false, method: null, message: 'Administrator MFA enrollment is not implemented yet.' }, sessions: [], sessions_total: 0 } })
    if (path === '/api/v1/security/sessions/revoke-others') { revocations++; return route.fulfill({ headers: cors, json: { message: 'Other devices signed out.', current_session_revoked: false } }) }
    return route.fulfill({ status: 404, headers: cors, json: { detail: 'No synthetic fixture' } })
  })
  await page.setViewportSize({ width: 320, height: 1000 })
  await page.goto('/admin/settings')
  const password = page.getByLabel('New password (Required)', { exact: true })
  await page.getByRole('button', { name: 'Change password and sign out', exact: true }).click()
  await expect(page.getByLabel('Current password (Required)', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert').filter({ hasText: 'Enter your current password.' })).toBeVisible()
  await password.fill('Synthetic-password42!')
  await page.getByRole('button', { name: 'Show new password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide new password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Cancel password edit', exact: true }).click()
  await expect(password).toHaveValue('')
  await page.getByRole('button', { name: 'Sign out other devices', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(revocations).toBe(0)
  await page.getByRole('button', { name: 'Sign out other devices', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out other devices', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Other devices signed out.' })).toBeVisible()
  expect(revocations).toBe(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('a callback for a different environment is rejected before leaving the current site', async ({page,context})=>{
  await providers(context,true)
  await context.route('**/api/v1/auth/social/google/start',route=>route.request().method()==='OPTIONS'?route.fulfill({status:204,headers:cors}):route.fulfill({headers:cors,json:{authorization_url:'https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2Fother-environment.invalid%2Fauth%2Fsocial%2Fcallback',state:'synthetic-state',expires_in:300}}))
  await page.goto('/auth/sign-in')
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'configured for a different environment'})).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  expect(await page.evaluate(()=>sessionStorage.getItem('qarevo.social.transaction'))).toBeNull()
})

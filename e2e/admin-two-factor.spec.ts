import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming, type TestPortalIdentity } from './helpers/portal-session'

const BASE = '/api/v1/admin/security/two-factor'
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
const CODES = Array.from({ length: 10 }, (_, index) => `synth-${String(index).padStart(5, '0')}`)
const OWNER = 'aaaaaaaa-1111-4111-8111-111111111111', OTHER = 'bbbbbbbb-2222-4222-8222-222222222222'
type Status = { enabled: boolean; confirmed_at: string | null; recovery_codes_remaining: number; required: boolean; required_by: string | null; setup_required: boolean }

async function prepare(context: BrowserContext, initial: Partial<Status> = {}) {
  const identity = await seedPortalSession(context, 'admin', { user_id: 'synthetic-admin' })
  const state = {
    status: { enabled: false, confirmed_at: null, recovery_codes_remaining: 0, required: false, required_by: null, setup_required: false, ...initial } as Status,
    confirms: [] as string[], resets: [] as { path: string; reason: string }[], policies: [] as boolean[],
    roster: { [OWNER]: false, [OTHER]: true } as Record<string, boolean>,
  }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname
    const body = request.postData() ? JSON.parse(request.postData()!) : {}
    if (endpoint.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (endpoint.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity as TestPortalIdentity) })
    if (endpoint === BASE) return route.fulfill({ json: state.status })
    if (endpoint === `${BASE}/setup`) return route.fulfill({ json: { secret: SECRET, otpauth_uri: `otpauth://totp/Qarevo%20Health:owner%40example.com?secret=${SECRET}&issuer=Qarevo%20Health`, account: 'owner@example.com', issuer: 'Qarevo Health', expires_in: 900 } })
    if (endpoint === `${BASE}/confirm`) {
      state.confirms.push(body.code)
      if (body.code !== '123456') return route.fulfill({ status: 400, json: { detail: { error_code: 'CODE_INVALID', message: 'Synthetic wrong code.' } } })
      state.status = { ...state.status, enabled: true, confirmed_at: '2026-11-28T10:00:00Z', recovery_codes_remaining: 10, setup_required: false }
      state.roster[OWNER] = true
      return route.fulfill({ json: { recovery_codes: CODES, status: state.status } })
    }
    if (endpoint === `${BASE}/policy`) {
      state.policies.push(body.required)
      state.status = { ...state.status, required: body.required, required_by: body.required ? 'policy' : null }
      return route.fulfill({ json: state.status })
    }
    if (endpoint === `${BASE}/roster`) return route.fulfill({ json: { required: state.status.required, admins: state.roster } })
    if (endpoint.startsWith(`${BASE}/admins/`) && endpoint.endsWith('/reset')) {
      state.resets.push({ path: endpoint, reason: body.reason }); state.roster[OTHER] = false
      return route.fulfill({ json: { admin_id: OTHER, had_authenticator: true, sessions_signed_out: 2, message: 'Reset.' } })
    }
    if (endpoint === '/api/v1/admin/admin-users') return route.fulfill({ json: {
      admin_users: [
        { id: OWNER, user_id: 'synthetic-admin', full_name: 'Synthetic Owner', email: 'owner@example.com', role: 'super_admin', status: 'ACTIVE', created_at: null, last_login_at: null },
        { id: OTHER, user_id: 'synthetic-other', full_name: 'Synthetic Colleague', email: 'colleague@example.com', role: 'operations_admin', status: 'ACTIVE', created_at: null, last_login_at: null },
      ], total: 2, limit: 100, offset: 0, can_manage: true, current_admin_id: OWNER } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

const own = (page: Page) => page.getByRole('region', { name: 'Two-factor authentication', exact: true })
const team = (page: Page) => page.getByRole('region', { name: 'Two-factor authentication for all administrators', exact: true })

test('an administrator sets up the authenticator app and stores recovery codes', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/security')
  await expect(own(page).getByText('Off', { exact: true })).toBeVisible()
  await own(page).getByRole('button', { name: 'Set up authenticator app', exact: true }).click()
  await expect(own(page).getByRole('img', { name: 'QR code for your authenticator app', exact: true }).locator('svg')).toBeVisible()
  await expect(own(page).getByLabel('Set-up key', { exact: true })).toContainText('JBSW')
  const code = own(page).getByLabel('6-digit code from your app', { exact: true })
  await code.fill('000000'); await own(page).getByRole('button', { name: 'Confirm and switch on', exact: true }).click()
  await expect(own(page).getByRole('alert')).toContainText('not correct or was already used')
  await code.fill('123456'); await own(page).getByRole('button', { name: 'Confirm and switch on', exact: true }).click()
  await expect(own(page).getByRole('list', { name: 'Recovery codes', exact: true }).getByRole('listitem')).toHaveCount(10)
  const done = own(page).getByRole('button', { name: 'Done', exact: true })
  await expect(done).toBeDisabled()
  await own(page).getByLabel('I have stored these recovery codes in a safe place.', { exact: true }).check()
  await done.click()
  await expect(own(page).getByText('On', { exact: true })).toBeVisible()
  await expect(own(page)).toContainText('10 recovery codes left')
  await expect(own(page).getByRole('status')).toContainText('Two-factor authentication is set up')
  expect(state.confirms).toEqual(['000000', '123456'])
})

test('a super administrator requires 2FA for everyone and resets a colleague with a reason', async ({ page, context }) => {
  const state = await prepare(context, { enabled: true, confirmed_at: '2026-11-28T10:00:00Z', recovery_codes_remaining: 2 })
  state.roster[OWNER] = true
  await page.goto('/admin/security')
  await expect(own(page).getByText('You are running low on recovery codes', { exact: false })).toBeVisible()
  await team(page).getByRole('button', { name: 'Require for all administrators', exact: true }).click()
  await expect(team(page).getByRole('status')).toContainText('now required for all administrators')
  expect(state.policies).toEqual([true])
  // Required: switching one's own off is no longer offered.
  await expect(own(page).getByRole('button', { name: 'Turn off', exact: true })).toHaveCount(0)
  await team(page).getByRole('listitem').filter({ hasText: 'Synthetic Colleague' }).getByRole('button', { name: 'Reset', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reset two-factor authentication for Synthetic Colleague?', exact: true })
  await dialog.getByLabel('Reason (at least 10 characters)', { exact: true }).fill('lost')
  await dialog.getByRole('button', { name: 'Reset and sign out', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('at least 10 characters')
  await dialog.getByLabel('Reason (at least 10 characters)', { exact: true }).fill('Lost the phone with the authenticator')
  await dialog.getByRole('button', { name: 'Reset and sign out', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(team(page).getByRole('status')).toContainText('Synthetic Colleague was reset')
  expect(state.resets).toEqual([{ path: `${BASE}/admins/${OTHER}/reset`, reason: 'Lost the phone with the authenticator' }])
})

test('enforced set-up sends every admin page to the security page', async ({ page, context }) => {
  await prepare(context, { required: true, required_by: 'policy', setup_required: true })
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL(/\/admin\/security\?setup=required$/)
  await expect(page.getByText('Two-factor authentication is required for administrators. Set up an authenticator app', { exact: false })).toBeVisible()
})

test('sign-in asks for the authenticator code and accepts a recovery code instead', async ({ page, context }) => {
  const posted: { path: string; body: Record<string, string> }[] = []
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname
    const body = request.postData() ? JSON.parse(request.postData()!) : {}
    if (endpoint.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (endpoint === '/api/v1/auth/admin/login') return route.fulfill({ json: { mfa_pending: true, mfa_required: true, mfa_method: 'totp', token_type: 'TEMP_AUTH', expires_in: 600, email_verified: true, phone_verified: false } })
    if (endpoint === '/api/v1/auth/admin/mfa/verify-app') {
      posted.push({ path: endpoint, body })
      return route.fulfill({ status: 400, json: { detail: { error_code: 'RECOVERY_CODE_INVALID', message: 'This recovery code is not correct or was already used.' } } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  await page.goto('/auth/admin/login')
  await page.getByLabel('Email', { exact: false }).first().fill('owner@example.com')
  await page.locator('input[type=password]').fill('Synthetic-Password-1')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await expect(page.getByText('Enter the 6-digit code from your authenticator app.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /Send a new code/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use a recovery code instead', exact: true }).click()
  await page.getByLabel('Recovery code', { exact: true }).fill('k7m2q-x9p4t')
  await page.getByRole('button', { name: 'Confirm and sign in', exact: true }).click()
  await expect.poll(() => posted.length).toBe(1)
  expect(posted).toEqual([{ path: '/api/v1/auth/admin/mfa/verify-app', body: { recovery_code: 'k7m2q-x9p4t' } }])
  // A rejected code stays on the step with a message and the input enabled for another try.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()
  await expect(page.getByLabel('Recovery code', { exact: true })).toBeEnabled()
})

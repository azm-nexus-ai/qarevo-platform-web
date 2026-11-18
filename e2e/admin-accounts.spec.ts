import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

// Synthetic accounts only.
const patientId = '6a1d0c4e-1111-4a2b-9c3d-000000000001'
const summary = { user_id: patientId, role: 'patient', name: 'Synthetic Patient', email: 'patient@example.test', status: 'ACTIVE', registered_at: '2030-05-01T08:00:00Z',
  last_login_at: '2030-06-01T09:30:00Z', email_verified: true, verification: 'verified', active_sessions: 1, deletion_pending: false }
const plan = [
  { category: 'Sign-in and sessions', handling: 'Blocked and revoked immediately', retention: null },
  { category: 'Medical documentation (episodes, consultation records, prescriptions)', handling: 'Retained, then erased when the retention period ends', retention: '10 years after the last treatment (§ 630f Abs. 3 BGB)' },
]
const detail = (can: Record<string, boolean>, overrides: Record<string, unknown> = {}) => ({
  ...summary, phone: '+••••••••••78', phone_verified: false, sessions: [{ id: 's1', device: 'Synthetic phone', browser: 'Synthetic browser', os: null, network: '203.0.113.0/24', started_at: '2030-06-01T09:30:00Z', last_seen_at: '2030-06-01T10:00:00Z' }],
  activity: [{ event: 'LOGIN_SUCCESS', category: 'AUTH', success: true, at: '2030-06-01T09:30:00Z' }], admin_history: [], deletion: null,
  retention_plan: plan, retention_confirmed: false, can: { suspend: false, reactivate: false, request_deletion: false, cancel_deletion: false, ...can }, ...overrides,
})

async function prepare(context: BrowserContext, can: Record<string, boolean>) {
  const identity = await seedPortalSession(context, 'admin')
  const state = { writes: [] as { path: string; body: Record<string, unknown> }[], queries: [] as string[], current: detail(can) as Record<string, unknown> }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === '/api/v1/admin/accounts') { state.queries.push(url.search); return route.fulfill({ json: { total: 1, limit: 25, offset: 0, accounts: [summary] } }) }
    if (path === `/api/v1/admin/accounts/${patientId}`) return route.fulfill({ json: state.current })
    if (path.startsWith(`/api/v1/admin/accounts/${patientId}/`) && request.method() === 'POST') {
      const body = request.postDataJSON()
      state.writes.push({ path: path.slice(`/api/v1/admin/accounts/${patientId}`.length), body })
      if (path.endsWith('/suspend')) state.current = detail({ reactivate: true }, { status: 'SUSPENDED', sessions: [], admin_history: [{ action: 'SUSPEND_ACCOUNT', by: 'Synthetic operations_admin', reason: body.reason, at: '2030-06-02T08:00:00Z' }] })
      if (path.endsWith('/deletion')) state.current = detail({ cancel_deletion: true }, { status: 'DEACTIVATED', sessions: [], deletion: { state: 'PENDING', requested_at: '2030-06-02T08:00:00Z', requested_by: 'Synthetic compliance_admin', reason: body.reason, erase_contact_data_after: '2030-07-02T08:00:00Z', erasure_job: 'not enabled' } })
      return route.fulfill({ json: state.current })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

test('admins find a patient and see masked account facts without clinical data', async ({ page, context }) => {
  const state = await prepare(context, {})
  await page.goto('/admin/accounts')
  await page.getByLabel('Search by name or email').fill('synthetic')
  await expect.poll(() => state.queries.some(q => q.includes('search=synthetic') && q.includes('role=patient'))).toBe(true)
  await page.getByRole('button', { name: 'Open account Synthetic Patient' }).click()
  const panel = page.getByRole('region', { name: 'Synthetic Patient' })
  await expect(panel.getByText('+••••••••••78')).toBeVisible()
  await expect(panel.getByText(/Network 203\.0\.113\.0\/24/)).toBeVisible()
  await expect(panel.getByText('Login success')).toBeVisible()
  await expect(panel.getByText('Your administrator role can view this account but not change it.')).toBeVisible()
  await expect(panel.getByRole('button', { name: /Suspend|Request deletion/ })).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`account=${patientId}`))
})

test('old patient administration links land on accounts', async ({ page, context }) => {
  await prepare(context, {})
  await page.goto('/admin/patients')
  await expect(page).toHaveURL(/\/admin\/accounts\?role=patient$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
})

test('suspension needs a stored reason and records it in the history', async ({ page, context }) => {
  const state = await prepare(context, { suspend: true, request_deletion: false })
  await page.goto(`/admin/accounts?role=patient&account=${patientId}`)
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Suspend account' })
  await expect(dialog.getByLabel('Reason (Required)')).toBeFocused()
  await dialog.getByRole('button', { name: 'Suspend account' }).click()
  await expect(dialog.getByText('Give a reason of at least 10 characters.', { exact: false })).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await dialog.getByLabel('Reason (Required)').fill('Synthetic support ticket requested suspension')
  await dialog.getByRole('button', { name: 'Suspend account' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Account suspended and sessions ended.' })).toBeVisible()
  expect(state.writes).toEqual([{ path: '/suspend', body: { reason: 'Synthetic support ticket requested suspension' } }])
  await expect(page.getByText(/Suspended by Synthetic operations_admin/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible()
})

test('deletion shows the retention plan and requires the account email typed exactly', async ({ page, context }) => {
  const state = await prepare(context, { request_deletion: true })
  await page.goto(`/admin/accounts?role=patient&account=${patientId}`)
  await page.getByRole('button', { name: 'Request deletion', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Request account deletion' })
  await expect(dialog.getByText(/630f Abs\. 3 BGB/)).toBeVisible()
  await expect(dialog.getByText('Retention periods are awaiting legal confirmation. Automatic erasure is not enabled yet.')).toBeVisible()
  await dialog.getByLabel('Reason (Required)').fill('Synthetic erasure request received in writing')
  await dialog.getByLabel(/Type the account’s email address/).fill('someone-else@example.test')
  await dialog.getByRole('button', { name: 'Request deletion' }).click()
  await expect(dialog.getByText('Type the account’s email address exactly.')).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await dialog.getByLabel(/Type the account’s email address/).fill('patient@example.test')
  await dialog.getByRole('button', { name: 'Request deletion' }).click()
  await expect(page.getByRole('note').filter({ hasText: 'Deletion requested' })).toBeVisible()
  expect(state.writes[0]).toEqual({ path: '/deletion', body: { reason: 'Synthetic erasure request received in writing', confirm_email: 'patient@example.test' } })
  await expect(page.getByRole('button', { name: 'Cancel deletion request' })).toBeVisible()
})

test('Escape closes a confirmation without changing anything', async ({ page, context }) => {
  const state = await prepare(context, { suspend: true })
  await page.goto(`/admin/accounts?role=patient&account=${patientId}`)
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
})

test('accounts fit a 320px screen in both themes', async ({ page, context }) => {
  await prepare(context, { suspend: true })
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(`/admin/accounts?role=patient&account=${patientId}`)
  await expect(page.getByRole('region', { name: 'Synthetic Patient' })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
})

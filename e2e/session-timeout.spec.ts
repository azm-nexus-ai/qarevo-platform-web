import { test, expect, type BrowserContext } from '@playwright/test'

async function prepare(context: BrowserContext, role: 'PATIENT' | 'PROVIDER' | 'ADMIN', seconds = 90) {
  const state = { activity: 0, reads: 0, logouts: 0, unavailable: false, absolute: false, seconds }
  await context.addInitScript(role => {
    if (sessionStorage.getItem('synthetic-session-seeded')) return
    sessionStorage.setItem('synthetic-session-seeded', '1')
    localStorage.setItem('qarevo_access_token', 'synthetic-access')
    localStorage.setItem('qarevo_refresh_token', 'synthetic-refresh')
    localStorage.setItem('qarevo_user_id', 'synthetic-session-user')
    localStorage.setItem('qarevo_role', role)
  }, role)
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path === '/api/v1/session' || path === '/api/v1/session/activity') {
      if (path.endsWith('activity')) state.activity++; else state.reads++
      if (state.unavailable) return route.fulfill({ status: 503, headers, json: { detail: 'Synthetic outage' } })
      if (path.endsWith('activity')) state.seconds = 900
      return route.fulfill({ headers, json: { server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now()+state.seconds*1000).toISOString(), absolute_expires_at: new Date(Date.now()+(state.absolute ? state.seconds : 28_800)*1000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    }
    if (path === '/api/v1/auth/logout') { state.logouts++; return route.fulfill({ headers, json: { message: 'Logged out' } }) }
    if (path.endsWith('/settings')) return route.fulfill({ headers, json: { user_id: 'synthetic-session-user', emergency_contacts: [] } })
    if (path.endsWith('/billing')) return route.fulfill({ headers, json: { status: 'not_configured', payment_provider_enabled: false, invoices: [], payment_methods: [], payment_history: [], upcoming_charges: [], insurance_summary: { status: 'unverified' } } })
    if (path.endsWith('/workspace')) return route.fulfill({ headers, json: { consultations: [], page: 1, filtered_count: 0, total_count: 0 } })
    if (path.endsWith('/episodes')) return route.fulfill({ headers, json: { episodes: [], page: 1, total_count: 0 } })
    if (path.endsWith('/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Doctor' } })
    if (path.endsWith('/overview')) return route.fulfill({ headers, json: { patients: { total: 0 }, doctors: { total: 0 }, users: { total: 0 }, exceptions: { active: 0 } } })
    if (path.endsWith('/health')) return route.fulfill({ headers, json: { status: 'healthy', pending_verifications: 0, critical_exceptions: 0, high_exceptions: 0 } })
    if (path.endsWith('/activity')) return route.fulfill({ headers, json: { period_days: 7, date_from: '2030-01-01', date_to: '2030-01-07', new_patients: 0, new_doctors: 0, new_exceptions: 0 } })
    if (path.endsWith('/doctors-summary')) return route.fulfill({ headers, json: { by_specialty: {} } })
    if (path.endsWith('/workflow-delivery')) return route.fulfill({ headers, json: { status: 'disabled', jobs: [], pending_count: 0, failed_count: 0, can_retry: false } })
    return route.fulfill({ headers, json: {} })
  })
  return state
}

for (const [role, path, login] of [
  ['PATIENT', '/patient/billing', '/auth/sign-in'],
  ['PROVIDER', '/doctor/workspace', '/auth/doctor/login'],
  ['ADMIN', '/admin/dashboard', '/auth/admin/login'],
] as const) {
  test(`${role}: warning is keyboard accessible and explicit activity continues the session`, async ({ page, context }) => {
    const state = await prepare(context, role)
    await page.goto(path)
    const warning = page.getByRole('dialog', { name: 'Your session is ending soon' })
    await expect(warning).toBeVisible()
    await expect(warning.getByRole('button', { name: 'Stay signed in' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(warning).toBeVisible()
    expect(state.activity).toBe(0)
    await warning.getByRole('button', { name: 'Stay signed in' }).click()
    await expect(warning).not.toBeVisible()
    expect(state.activity).toBe(1)
    await page.reload()
    await expect(page.getByRole('region', { name: 'Session verification' })).toHaveCount(0)
    expect(state.activity).toBe(1)
  })
  test(`${role}: expiry removes credentials and returns to the correct sign-in`, async ({ page, context }) => {
    const state = await prepare(context, role, 4)
    await page.goto(path)
    await expect(page.getByRole('dialog', { name: 'Your session is ending soon' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(login+'$'), { timeout: 10_000 })
    expect(await page.evaluate(() => localStorage.getItem('qarevo_access_token'))).toBeNull()
    expect(state.logouts).toBe(1)
  })
}

test('failed renewal keeps an actionable warning and never claims extension', async ({ page, context }) => {
  const state = await prepare(context, 'PATIENT')
  await page.goto('/patient/billing')
  const warning = page.getByRole('dialog', { name: 'Your session is ending soon' })
  await expect(warning).toBeVisible()
  state.unavailable = true
  await warning.getByRole('button', { name: 'Stay signed in' }).click()
  await expect(warning.getByRole('alert')).toContainText('could not confirm your session')
  await expect(warning.getByRole('button', { name: 'Stay signed in' })).toBeEnabled()
  await expect(warning).toBeVisible()
  state.unavailable = false
  await warning.getByRole('button', { name: 'Stay signed in' }).click()
  await expect(warning).not.toBeVisible()
})

test('absolute expiry warning permits saving work but does not offer renewal', async ({ page, context }) => {
  const state = await prepare(context, 'PATIENT')
  state.absolute = true
  await page.goto('/patient/billing')
  const warning = page.getByRole('dialog', { name: 'Your session is ending soon' })
  await expect(warning).toBeVisible()
  await expect(warning.getByRole('button', { name: 'Stay signed in' })).toHaveCount(0)
  await warning.getByRole('button', { name: 'Return to work and save' }).click()
  await expect(warning).not.toBeVisible()
  expect(state.activity).toBe(0)
})

test('unavailable authority blocks private content with retry and sign-out', async ({ page, context }) => {
  const state = await prepare(context, 'PATIENT', 900)
  state.unavailable = true
  await page.goto('/patient/billing')
  await expect(page.getByRole('heading', { name: 'Billing & Payments' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Session verification' }).getByRole('alert')).toContainText('could not confirm your session')
  state.unavailable = false
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByRole('heading', { name: 'Billing & Payments' })).toBeVisible()
})

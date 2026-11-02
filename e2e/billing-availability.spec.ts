import { test, expect, type BrowserContext } from '@playwright/test'

async function prepare(context: BrowserContext) {
  const state = { status: 200, hold: Promise.resolve(), insuranceStatus: 'unverified' }
  await context.addInitScript(() => {
    localStorage.setItem('qarevo_access_token', 'synthetic-patient-token')
    localStorage.setItem('qarevo_refresh_token', 'synthetic-patient-refresh')
    localStorage.setItem('qarevo_user_id', 'synthetic-patient')
    localStorage.setItem('qarevo_role', 'PATIENT')
  })
  await context.route('**/api/v1/**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/billing')) {
      await state.hold
      if (state.status !== 200) return route.fulfill({ status: state.status, headers, json: { detail: 'Synthetic billing service unavailable.' } })
      return route.fulfill({ headers, json: { status: 'not_configured', current_balance: null, insurance_coverage: null, amount_due: null,
        currency: 'EUR', payment_provider_enabled: false, payment_methods: [], invoices: [], payment_history: [], upcoming_charges: [],
        insurance_summary: { status: state.insuranceStatus, provider_name: 'Synthetic insurer', claims: [], authorizations: [] } } })
    }
    if (path.endsWith('/settings')) return route.fulfill({ headers, json: { user_id: 'synthetic-patient', first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    return route.fulfill({ status: 404, headers, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

test('loading and unconfigured billing never flash a zero balance or active insurance', async ({ page, context }) => {
  const state = await prepare(context)
  let release = () => {}
  state.hold = new Promise<void>(resolve => { release = resolve })
  await page.goto('/patient/billing')
  await expect(page.getByRole('heading', { name: 'Billing & Payments' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay Now' })).toHaveCount(0)
  await expect(page.getByText(/[$€]0/)).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Billing availability' })).toHaveCount(0)
  release()
  await expect(page.getByRole('status', { name: 'Billing availability' })).toContainText('not available yet')
  await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Pay Now|Add Card|Download Receipt/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Review insurance details' })).toHaveAttribute('href', '/patient/settings')
})

test('billing outage shows a retry and no empty financial account', async ({ page, context }) => {
  const state = await prepare(context)
  state.status = 503
  await page.goto('/patient/billing')
  await expect(page.getByRole('alert')).toContainText('Synthetic billing service unavailable')
  await expect(page.getByRole('status', { name: 'Billing availability' })).toHaveCount(0)
  await expect(page.getByText('Nothing due right now', { exact: true })).toHaveCount(0)
  state.status = 200
  await page.getByRole('button', { name: 'Retry billing' }).click()
  await expect(page.getByRole('status', { name: 'Billing availability' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('billing remains readable on mobile with persistent dark mode and legacy insurance status', async ({ page, context }) => {
  const state = await prepare(context)
  state.insuranceStatus = 'active'
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/patient/billing')
  await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('status', { name: 'Billing availability' })).toBeVisible()
})

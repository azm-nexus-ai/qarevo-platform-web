import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'
import type { PatientBillingReadiness } from '../lib/api'

const pending = (reason_code: string, message: string) => ({ status: 'not_configured' as const, reason_code, message })
const readiness: PatientBillingReadiness = {
  schema_version: 1,
  checkout: { enabled: false, reason_code: 'CHECKOUT_NOT_IMPLEMENTED', message: 'Online checkout is unavailable. No payment can be attempted.' },
  requested_methods: ([['CARD','Card'],['PAYPAL','PayPal'],['APPLE_PAY','Apple Pay'],['GOOGLE_PAY','Google Pay'],['KLARNA','Klarna']] as const)
    .map(([method,label]) => ({ method, label, ...pending('PAYMENT_PROVIDER_NOT_CONFIGURED','This payment method is not available.') })),
  accepted_methods: [],
  patient_payments: pending('PAYMENT_PROVIDER_NOT_CONFIGURED','Online patient payments are unavailable.'),
  medical_invoicing: pending('MEDICAL_INVOICING_NOT_CONFIGURED','Automated medical invoices from treating practices are unavailable.'),
  practice_fee_invoicing: pending('PRACTICE_FEE_BILLING_NOT_CONFIGURED','Separate platform usage invoicing for practices is unavailable.'),
  practice_settlement: pending('PRACTICE_SETTLEMENT_NOT_CONFIGURED','Payments to connected practice accounts are unavailable.'),
  intended_model: { medical_invoice_issuer:'treating_practice',patient_payment_recipient:'connected_practice_account',platform_usage_fee_payer:'treating_practice',configured_practice_id:null },
  funding_rules: { requires_case_funding_confirmation:true,covered_gkv_patient_checkout:'excluded',insurance_declaration_confirms_coverage:false,insurance_declaration_authorizes_self_pay:false,self_pay_requires_explicit_cost_agreement:true,unverified_funding_checkout:'blocked' },
}

async function prepare(context: BrowserContext) {
  const state = { status: 200, hold: Promise.resolve(), insuranceStatus: 'unverified', legacyReady: false, includeReadiness: true, financialMutations: 0 }
  const identity = await seedPortalSession(context, 'patient', {user_id:'synthetic-patient'})
  await context.route('**/api/v1/**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET' && /\/(?:billing|checkout|payments)(?:\/|$)/.test(path)) state.financialMutations++
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if (path === '/api/v1/session' || path === '/api/v1/session/activity') return route.fulfill({ headers: headers, json:{browser_session:identity,server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now()+900_000).toISOString(), absolute_expires_at: new Date(Date.now()+28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/billing')) {
      await state.hold
      if (state.status !== 200) return route.fulfill({ status: state.status, headers, json: { detail: 'Synthetic billing service unavailable.' } })
      return route.fulfill({ headers, json: { status: state.legacyReady ? 'ready' : 'not_configured', current_balance: null, insurance_coverage: null, amount_due: state.legacyReady ? 10 : null,
        currency: 'EUR', payment_provider_enabled: state.legacyReady, payment_methods: [], invoices: [], payment_history: [], upcoming_charges: [],
        ...(state.includeReadiness ? {readiness} : {}),
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
  await expect(page.getByRole('alert', { name: 'Billing error' })).toContainText('Synthetic billing service unavailable')
  await expect(page.getByRole('status', { name: 'Billing availability' })).toHaveCount(0)
  await expect(page.getByText('Nothing due right now', { exact: true })).toHaveCount(0)
  state.status = 200
  await page.getByRole('button', { name: 'Retry billing' }).click()
  await expect(page.getByRole('status', { name: 'Billing availability' })).toBeVisible()
  await expect(page.getByRole('alert', { name: 'Billing error' })).toHaveCount(0)
})

test('billing remains readable on mobile with persistent dark mode and legacy insurance status', async ({ page, context }) => {
  const state = await prepare(context)
  state.insuranceStatus = 'active'
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/patient/billing')
  await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('status', { name: 'Billing availability' })).toBeVisible()
})

test('requested payment methods remain unavailable with separate invoice and funding explanations', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/patient/billing')
  const methods = page.getByRole('list', { name: 'Requested payment methods' })
  await expect(methods.getByRole('listitem')).toHaveCount(5)
  for (const label of ['Card','PayPal','Apple Pay','Google Pay','Klarna']) {
    await expect(methods.getByRole('listitem').filter({ hasText: label }).getByText('Not available', { exact: true })).toBeVisible()
  }
  await expect(page.getByText('Automated medical invoices from treating practices are unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByText(/Covered GKV consultations do not use patient checkout/)).toBeVisible()
  await expect(page.getByText(/Selecting self-pay does not authorize a charge/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Pay Now|Add Card/ })).toHaveCount(0)
  expect(state.financialMutations).toBe(0)
})

test('legacy ready/provider flags cannot activate an unimplemented checkout or card collection flow', async ({ page, context }) => {
  const state = await prepare(context)
  state.legacyReady = true
  state.includeReadiness = false
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/patient/billing')
  await expect(page.getByRole('button', { name: 'Pay Now', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add Card', exact: true })).toBeDisabled()
  await expect(page.getByText('Online checkout is not available. No payment can be attempted.', { exact: true })).toBeVisible()
  await expect(page.getByText(/No card details are collected on this page/)).toBeVisible()
  expect(state.financialMutations).toBe(0)
})

test('an older unconfigured server without readiness fields retains the truthful unavailable screen', async ({ page, context }) => {
  const state = await prepare(context)
  state.includeReadiness = false
  await page.goto('/patient/billing')
  await expect(page.getByRole('status', { name: 'Billing availability' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Requested payment methods' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Pay Now|Add Card/ })).toHaveCount(0)
  expect(state.financialMutations).toBe(0)
})

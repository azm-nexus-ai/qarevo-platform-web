import { seedPortalSession } from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'

// Synthetic data only: one clinician, booking options from the treating-entity API.
const PROVIDER = '22222222-2222-4222-8222-222222222222', EPISODE = '11111111-1111-4111-8111-111111111111'
const PRACTICE = '55555555-5555-4555-8555-555555555555', OTHER = '66666666-6666-4666-8666-666666666666'
const slot = { label: '9:00 AM', start_at: '2030-07-10T07:00:00+00:00', end_at: '2030-07-10T07:30:00+00:00', time_zone: 'Europe/Berlin', duration_minutes: 30 }
const entity = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, entity_type: 'PRACTICE', city: 'Berlin', postcode: '10115', country: 'DE', jurisdiction: 'DE', currency: 'EUR', public_insurance_eligible: true, ...extra,
})

async function prepare(context: BrowserContext, options: unknown, extra: { coverage?: string; appointmentStatus?: number; appointmentBody?: unknown } = {}) {
  const identity = await seedPortalSession(context, 'patient', { user_id: 'synthetic-patient' })
  const state = { booked: [] as Record<string, unknown>[], searches: [] as string[] }
  const now = Date.now()
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ headers, json: { browser_session: identity, server_time: new Date(now).toISOString(), idle_expires_at: new Date(now + 900000).toISOString(), absolute_expires_at: new Date(now + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/patient/settings')) return route.fulfill({ headers, json: { first_name: 'Synthetic', last_name: 'Patient', email: 'patient@example.invalid', emergency_contacts: [], insurance: extra.coverage ? { id: 'ins', insurance_type: extra.coverage, insurance_provider_name: 'Synthetic BKK' } : undefined } })
    if (path === '/api/v1/patient/booking/options') { expect(url.searchParams.get('provider_id')).toBe(PROVIDER); return route.fulfill({ headers, json: options }) }
    if (path === `/api/v1/patient/doctors/${PROVIDER}`) return route.fulfill({ headers, json: { id: PROVIDER, name: 'Synthetic Clinician', languages: [], insurance: [], services: [] } })
    if (path === '/api/v1/patient/doctors') { state.searches.push(url.searchParams.get('coverage') ?? ''); return route.fulfill({ headers, json: { doctors: [], total: 0, total_count: 0, filtered_count: 0, page: 1, page_size: 12, has_next: false, has_previous: false } }) }
    if (path === '/api/v1/patient/booking-datetime/slots') return route.fulfill({ headers, json: { date: '2030-07-10', slots: [slot.label], slot_details: [slot], schedule_ready: true } })
    if (path === `/api/v1/patient/episodes/${EPISODE}/intake`) return route.fulfill({ headers, json: { responses: { raw_text: 'Synthetic rehearsal only' } } })
    if (path === '/api/v1/patient/appointments' && route.request().method() === 'POST') {
      state.booked.push(route.request().postDataJSON())
      return route.fulfill({ headers, status: extra.appointmentStatus ?? 200, json: extra.appointmentBody ?? { id: '33333333-3333-4333-8333-333333333333', episode_id: EPISODE, consultation_id: '44444444-4444-4444-8444-444444444444', ...slot } })
    }
    return route.fulfill({ headers, status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

const review = `/patient/consultation-booking/review?${new URLSearchParams({ physicianId: PROVIDER, date: '2030-07-10', slot: slot.label, start_at: slot.start_at, episode_id: EPISODE, intake_submitted: 'true' })}`

test('self-pay booking shows the treating practice and needs the price confirmed', async ({ page, context }) => {
  const state = await prepare(context, { verification_required: true, coverage_type: 'SELF_PAY', entities: [entity(PRACTICE, 'Synthetic Praxis Mitte', { coverage_type: 'SELF_PAY', self_pay_fee_minor: 2547, self_pay_fee_basis: 'GOÄ Nr. 3 und Nr. 70, jeweils 2,3-facher Satz', self_pay_fee_is_reference: true })] })
  await page.goto(review)
  await expect(page.getByRole('heading', { name: 'Your treating practice' })).toBeVisible()
  await expect(page.getByText('Synthetic Praxis Mitte')).toBeVisible()
  await expect(page.getByText('25,47 €', { exact: true })).toBeVisible()
  await expect(page.getByText(/Reference price: GOÄ Nr\. 3/)).toBeVisible()
  await page.getByLabel('I have reviewed my synthetic booking information').check()
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page.getByText('Confirm the self-pay price before booking.')).toBeVisible()
  expect(state.booked).toHaveLength(0)
  await page.getByLabel(/I confirm I will pay 25,47 €/).check()
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page).toHaveURL(/consultation-booking\/success\?/)
  expect(state.booked[0]).toMatchObject({ treating_entity_id: PRACTICE, confirmed_self_pay_fee_minor: 2547, start_at: slot.start_at })
})

test('a clinician with several practices needs a choice; GKV shows no price', async ({ page, context }) => {
  const state = await prepare(context, { verification_required: true, coverage_type: 'GKV', entities: [entity(PRACTICE, 'Synthetic Praxis Mitte', { coverage_type: 'GKV' }), entity(OTHER, 'Synthetic Praxis Nord', { coverage_type: 'GKV' })] })
  await page.goto(review)
  await expect(page.getByText('Statutory insurance (GKV)')).toBeVisible()
  await page.getByLabel('I have reviewed my synthetic booking information').check()
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page.getByText('Choose the practice you want to be treated by.')).toBeVisible()
  await page.getByLabel(/Synthetic Praxis Nord/).check()
  await expect(page.getByText(/€/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page).toHaveURL(/consultation-booking\/success\?/)
  expect(state.booked[0].treating_entity_id).toBe(OTHER)
  expect(state.booked[0]).not.toHaveProperty('confirmed_self_pay_fee_minor')
})

test('a doctor who cannot treat this coverage cannot be booked', async ({ page, context }) => {
  const state = await prepare(context, { verification_required: true, coverage_type: 'GKV', entities: [] })
  await page.goto(review)
  await expect(page.getByText(/can’t treat patients with statutory insurance \(gkv\) through Qarevo/)).toBeVisible()
  await page.getByLabel('I have reviewed my synthetic booking information').check()
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page.getByText('This doctor can’t be booked for your coverage. Choose another doctor.')).toBeVisible()
  expect(state.booked).toHaveLength(0)
})

test('before verification is enabled booking works exactly as before', async ({ page, context }) => {
  const state = await prepare(context, { verification_required: false, coverage_type: 'SELF_PAY', entities: [] })
  await page.goto(review)
  await page.getByLabel('I have reviewed my synthetic booking information').check()
  await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).click()
  await expect(page).toHaveURL(/consultation-booking\/success\?/)
  await expect(page.getByRole('heading', { name: 'Your treating practice' })).toHaveCount(0)
  expect(state.booked[0]).not.toHaveProperty('treating_entity_id')
})

test('doctor search sends the patient coverage so unbookable doctors are hidden', async ({ page, context }) => {
  const state = await prepare(context, { verification_required: true, coverage_type: 'GKV', entities: [] }, { coverage: 'GKV' })
  await page.goto('/patient/find-doctor')
  await expect.poll(() => state.searches.includes('GKV')).toBe(true)
})

for (const width of [320, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`booking review with a treating practice fits ${width}px in ${scheme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme })
    await prepare(context, { verification_required: true, coverage_type: 'SELF_PAY', entities: [entity(PRACTICE, 'Synthetic Praxis Mitte', { coverage_type: 'SELF_PAY', self_pay_fee_minor: 2547, self_pay_fee_basis: 'GOÄ', self_pay_fee_is_reference: true })] })
    await page.goto(review)
    await expect(page.getByRole('heading', { name: 'Your treating practice' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

// Synthetic practices and accounts only.
const PRACTICE = '11111111-1111-4111-8111-111111111111', INDEPENDENT = '22222222-2222-4222-8222-222222222222'
const DUE = '6a1d0c4e-1111-4a2b-9c3d-000000000009'
const flags = { clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true }
const entity = (type: 'PRACTICE' | 'INDEPENDENT', verified: boolean) => ({ entity_type: type, jurisdiction: 'DE', currency: 'EUR', time_zone: 'Europe/Berlin', locale: 'de-DE',
  verification_status: verified ? 'VERIFIED' : 'UNVERIFIED', verified_at: verified ? '2026-11-19T10:00:00Z' : null, public_insurance_eligible: false, verified_submission_id: null })
const row = (id: string, name: string, type: 'PRACTICE' | 'INDEPENDENT', verified: boolean) => ({ id, name, status: verified ? 'REVIEWED' : 'DRAFT', version: 1, contact_email: null, phone: null,
  address_line1: null, address_line2: null, city: 'Berlin', postcode: '10115', country: 'DE', created_at: '2026-11-19T09:00:00Z', updated_at: '2026-11-19T09:00:00Z', ...flags,
  entity: entity(type, verified), bookable: verified })
const rows = [row(PRACTICE, 'Synthetic Praxis Mitte', 'PRACTICE', false), row(INDEPENDENT, 'Synthetic Independent', 'INDEPENDENT', true)]
const retained = ['Name, date of birth and gender that identify the patient in the medical documentation', 'Billing and settlement records']

async function prepare(context: BrowserContext, options: { planStatus?: number; enabled?: boolean } = {}) {
  const identity = await seedPortalSession(context, 'admin')
  const state = { queries: [] as string[], writes: [] as Record<string, unknown>[], due: 1 }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const respond = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    if (path.endsWith('/browser-csrf')) return respond({ csrf_token: 'synthetic-csrf' })
    if (path.startsWith('/api/v1/session')) return respond(testSessionTiming(identity))
    if (path === '/api/v1/practice/capabilities') return respond({ enabled: true, ...flags })
    if (path === '/api/v1/admin/practices') {
      state.queries.push(url.search)
      const type = url.searchParams.get('entity_type'), status = url.searchParams.get('verification_status')
      const shown = rows.filter(item => (!type || item.entity.entity_type === type) && (!status || item.entity.verification_status === status))
      return respond({ practices: shown, total: shown.length, limit: 25, offset: 0, has_next: false, has_previous: false, can_manage: false })
    }
    if (path === '/api/v1/admin/accounts') return respond({ total: 0, limit: 25, offset: 0, accounts: [] })
    if (path === '/api/v1/admin/account-erasure/plan') {
      if (options.planStatus) return respond({ detail: 'Super admin or compliance admin access required' }, options.planStatus)
      const due = state.due ? [{ user_id: DUE, role: 'patient', requested_at: '2026-10-01T08:00:00+00:00', erase_contact_data_after: '2026-10-31T08:00:00+00:00',
        fields_to_erase: ['user.email', 'user.phone', 'user.password_hash', 'patient.marketing_emails', 'patient.profile_image'] }] : []
      return respond({ dry_run: true, erasure_enabled: !!options.enabled, generated_at: '2026-11-19T10:00:00+00:00', due, due_count: due.length, waiting_count: 2, retained, pending_input: 'PENDING-INPUT(21)' })
    }
    if (path === '/api/v1/admin/account-erasure/run') {
      const body = request.postDataJSON(); state.writes.push(body)
      state.due = 0
      return respond({ dry_run: false, erased_count: 1, erased: [{ user_id: DUE, role: 'patient', erased_fields: ['user.email'] }], erased_at: '2026-11-19T10:05:00+00:00', pending_input: 'PENDING-INPUT(21)' })
    }
    return respond({ detail: 'No synthetic fixture' }, 404)
  })
  return state
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

test('the registry shows both entity types with verification and bookability and filters them', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/practices')
  const independent = page.getByRole('listitem').filter({ hasText: 'Synthetic Independent' })
  await expect(independent.getByText('Independent practitioner')).toBeVisible()
  await expect(independent.getByText('Verified', { exact: true })).toBeVisible()
  await expect(independent.getByText('Bookable', { exact: true })).toBeVisible()
  const practice = page.getByRole('listitem').filter({ hasText: 'Synthetic Praxis Mitte' })
  await expect(practice.getByText('Not verified')).toBeVisible()
  await expect(practice.getByText('Not bookable')).toBeVisible()

  await page.getByLabel('Entity type').selectOption('INDEPENDENT')
  await expect(page.getByRole('listitem').filter({ hasText: 'Synthetic Praxis Mitte' })).toHaveCount(0)
  expect(state.queries.at(-1)).toContain('entity_type=INDEPENDENT')
  await page.getByLabel('Verification').selectOption('UNVERIFIED')
  await expect(page.getByText('No practices registered')).toBeVisible()
  expect(state.queries.at(-1)).toContain('verification_status=UNVERIFIED')
  await expect(page.getByLabel('Entity type')).toBeVisible()
})

test('the erasure plan is a dry run until erasure is enabled', async ({ page, context }) => {
  await prepare(context)
  await page.goto('/admin/accounts')
  await expect(page.getByText('Dry run only')).toBeVisible()
  await expect(page.getByText('1 account due · 2 still in the cooling-off period')).toBeVisible()
  await expect(page.getByText(`Patient account ${DUE}`)).toBeVisible()
  await expect(page.getByText('Would erase: email, phone, password, communication preference, profile photo')).toBeVisible()
  await expect(page.getByText(/Erasing is switched off on this deployment/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Erase contact data' })).toHaveCount(0)
})

test('an enabled erasure needs a reason and the reviewed count, then confirms', async ({ page, context }) => {
  const state = await prepare(context, { enabled: true })
  await page.goto('/admin/accounts')
  await expect(page.getByText('Erasure enabled')).toBeVisible()
  await page.getByRole('button', { name: 'Erase contact data' }).click()
  await expect(page.getByLabel('Reason (Required)')).toBeFocused()
  await expect(page.getByText('Type 1, the number of accounts listed above.').first()).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await page.getByLabel('Reason (Required)').fill('Synthetic cooling-off period ended for this request.')
  await page.getByLabel('Number of accounts to erase (Required)').fill('1')
  await page.getByRole('button', { name: 'Erase contact data' }).click()
  await expect(page.getByText('Contact data erased for 1 account.').first()).toBeVisible()
  expect(state.writes[0]).toEqual({ reason: 'Synthetic cooling-off period ended for this request.', expected_accounts: 1 })
  await expect(page.getByText('0 accounts due · 2 still in the cooling-off period')).toBeVisible()
})

test('roles without erasure rights do not see the erasure card', async ({ page, context }) => {
  await prepare(context, { planStatus: 403 })
  await page.goto('/admin/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
  await expect(page.getByText('0 patient accounts')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Erasure after deletion requests' })).toHaveCount(0)
})

for (const width of [320, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`registry and erasure fit ${width}px in ${scheme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme })
    await prepare(context, { enabled: true })
    await page.goto('/admin/practices')
    await expect(page.getByText('Synthetic Independent')).toBeVisible()
    await noHorizontalOverflow(page)
    await page.goto('/admin/accounts')
    await expect(page.getByText(`Patient account ${DUE}`)).toBeVisible()
    await noHorizontalOverflow(page)
  })
}

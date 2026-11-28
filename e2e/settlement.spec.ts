import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// Synthetic entities, consultations and amounts only.
const PRACTICE = '11111111-1111-4111-8111-111111111111', INDEPENDENT = '22222222-2222-4222-8222-222222222222', STATEMENT = '99999999-9999-4999-8999-999999999991'
const OWNER = '33333333-3333-4333-8333-333333333333', CLINICIAN = '44444444-4444-4444-8444-444444444444', MEMBERSHIP = '55555555-5555-4555-8555-555555555555'
const REF = '88888888-8888-4888-8888-888888888888', INVOICE_URL = 'https://files.example.invalid/synthetic-invoice.pdf'
const flags = { clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true }
const names = ['patient', 'doctor', 'admin', 'practice'] as const
type Portal = typeof names[number]

const lines = [
  { consultation_id: 'c0000000-0000-4000-8000-000000000001', completed_at: '2026-10-03T09:12:00+00:00', coverage_type: 'PUBLIC', segment: 'GKV_KNOWN', band: 1, joint_seconds: 412, schedule_key: 'PRICE_LIST_V2', fee_e4: 50952, tariff_e4_per_minute: '6369.0000' },
  { consultation_id: 'c0000000-0000-4000-8000-000000000002', completed_at: '2026-10-14T15:40:00+00:00', coverage_type: 'PUBLIC', segment: 'GKV_UNKNOWN', band: 1, joint_seconds: 300, schedule_key: 'PRICE_LIST_V2', fee_e4: 42537, tariff_e4_per_minute: '5317.1250' },
  { consultation_id: 'c0000000-0000-4000-8000-000000000003', completed_at: '2026-10-28T22:30:00+00:00', coverage_type: 'PRIVATE', segment: 'PRIVATE', band: 1, joint_seconds: 495, schedule_key: 'PRICE_LIST_V2', fee_e4: 124803, tariff_e4_per_minute: '15600.3750' },
]
// 218292 e4 = 21.8292 € → 21.83 € net, 4.15 € VAT, 25.98 € total. Rounded once, on the total.
const totals = { net_e4: 218292, net_minor: 2183, vat_rate_percent: '19', vat_minor: 415, gross_minor: 2598 }

type Row = { id: string; practice_id: string; practice_name: string; period: string; currency: string; status: 'DRAFT' | 'ISSUED'; line_count: number; invoice_number: string | null; invoice_sha256: string | null; issued_at: string | null; version: number } & typeof totals

const practiceView = (id: string, name: string) => ({ id, name, status: 'REVIEWED', version: 2, contact_email: null, phone: null, address_line1: null, address_line2: null, city: 'Berlin', postcode: '10115', country: 'DE', ...flags })

async function prepare(context: BrowserContext, options: { issued?: boolean } = {}) {
  const identities = Object.fromEntries(names.map((portal, i) => [portal, { user_id: portal === 'doctor' ? CLINICIAN : OWNER, role: { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN', practice: 'PRACTICE' }[portal], session_id: `${i + 1}9999999-9999-4999-8999-999999999999`, ...(portal === 'doctor' ? { provider_id: CLINICIAN } : {}) }])) as Record<Portal, { user_id: string; role: string; session_id: string }>
  await context.addInitScript(({ identities }) => {
    for (const portal of ['patient', 'doctor', 'admin', 'practice'] as const) {
      const marker = 'qarevo:test:settlement-seeded:' + portal
      if (!sessionStorage.getItem(marker)) { localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify(identities[portal])); sessionStorage.setItem(marker, 'true') }
    }
  }, { identities })
  const state = {
    statements: [] as Row[], writes: [] as { path: string; body: unknown; ifMatch?: string }[], invoiceOpened: 0, changedElsewhere: false,
  }
  const issuedRow = (row: Row): Row => ({ ...row, status: 'ISSUED', invoice_number: 'QH-2026-000001', invoice_sha256: 'b'.repeat(64), issued_at: '2026-11-02T08:00:00+00:00', version: row.version + 1 })
  const draft = (): Row => ({ id: STATEMENT, practice_id: PRACTICE, practice_name: 'Synthetic Praxis Mitte', period: '2026-10', currency: 'EUR', status: 'DRAFT', line_count: 3, invoice_number: null, invoice_sha256: null, issued_at: null, version: 1, ...totals })
  if (options.issued) state.statements.push(issuedRow(draft()))
  const timing = (portal: Portal) => ({ ...identities[portal], browser_session: identities[portal], server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 })
  // Served as a small page: headless Chromium in CI turns a PDF response into an aborted download, and the test only needs the tab to arrive.
  await context.route(INVOICE_URL, route => { state.invoiceOpened++; return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic invoice</title><p>Synthetic invoice</p>' }) })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), portal = (request.headers()['x-qarevo-portal'] || 'patient') as Portal
    expect(request.headers()['authorization']).toBeUndefined()
    const respond = (body: unknown, status = 200) => route.fulfill({ status, headers: { 'X-Request-ID': REF }, json: body })
    if (path.endsWith('/browser-csrf')) return respond({ csrf_token: 'synthetic-settlement-csrf' })
    if (path === '/api/v1/practice/capabilities') return respond({ enabled: true, ...flags })
    if (path.startsWith('/api/v1/session') || path.startsWith('/api/v1/practice/session')) return respond(timing(portal))
    if (path === '/api/v1/auth/social/providers') return respond({ google: { enabled: false }, apple: { enabled: false } })
    if (path === '/api/v1/admin/practices') return respond({ practices: [practiceView(PRACTICE, 'Synthetic Praxis Mitte'), practiceView(INDEPENDENT, 'Synthetic Independent')], total: 2, limit: 100, offset: 0, has_next: false, has_previous: false, can_manage: true })
    if (path === '/api/v1/practice/workspace') return respond({ practices: [{ practice: practiceView(PRACTICE, 'Synthetic Praxis Mitte'), membership: { id: MEMBERSHIP, practice_id: PRACTICE, user_id: OWNER, role: 'OWNER', status: 'ACTIVE', version: 1, can_revoke: false } }] })
    if (path === '/api/v1/admin/settlement/statements') {
      if (method === 'POST') {
        const body = request.postDataJSON(); state.writes.push({ path, body })
        let row = state.statements.find(item => item.practice_id === body.practice_id && item.period === body.period)
        if (!row) { row = { ...draft(), period: body.period }; state.statements.push(row) }
        return respond({ ...row, lines })
      }
      return respond({ statements: state.statements.filter(row => row.period === url.searchParams.get('period')) })
    }
    const admin = path.match(/^\/api\/v1\/admin\/settlement\/statements\/([^/]+)(?:\/(issue|invoice))?$/)
    if (admin) {
      const index = state.statements.findIndex(row => row.id === admin[1])
      if (index < 0) return respond({ detail: 'Not found' }, 404)
      const row = state.statements[index]
      if (admin[2] === 'invoice') return row.status === 'ISSUED' ? respond({ url: INVOICE_URL, expires_in: 300 }) : respond({ detail: 'Not issued' }, 409)
      if (admin[2] === 'issue') {
        const ifMatch = request.headers()['if-match']; state.writes.push({ path, body: request.postDataJSON(), ifMatch })
        if (state.changedElsewhere || ifMatch !== `"${row.version}"`) return respond({ detail: { error_code: 'SETTLEMENT_STATEMENT_CHANGED', message: 'This statement changed. Refresh it before issuing.' } }, 412)
        state.statements[index] = issuedRow(row)
        return respond({ ...state.statements[index], lines })
      }
      return respond({ ...row, lines })
    }
    const entity = path.match(/^\/api\/v1\/(?:practice\/practices|doctor\/independent-practice)\/([^/]+)\/statements(?:\/([^/]+)(?:\/(invoice))?)?$/)
    if (entity) {
      const own = state.statements.filter(row => row.practice_id === entity[1] && row.status === 'ISSUED')
      if (!entity[2]) return respond({ statements: own })
      const row = own.find(item => item.id === entity[2])
      if (!row) return respond({ detail: 'Not found' }, 404)
      return entity[3] ? respond({ url: INVOICE_URL, expires_in: 300 }) : respond({ ...row, lines })
    }
    if (path === '/api/v1/doctor/independent-practice') return respond({ practice: null })
    return respond({ detail: 'No synthetic fixture.' }, 404)
  })
  return state
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function pickMonth(page: Page) {
  await page.getByLabel('Month').fill('2026-10')
  await expect(page.getByLabel('Month')).toHaveValue('2026-10')
}

test('an admin creates a draft, reads the exact lines and issues the invoice with the statement version', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/settlement')
  await expect(page.getByRole('heading', { name: 'Settlement', exact: true })).toBeVisible()
  await pickMonth(page)
  await expect(page.getByText('No statements for this month')).toBeVisible()

  await page.getByRole('button', { name: 'Create or refresh draft' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a practice or independent practitioner.' }).first()).toBeVisible()
  await expect(page.getByLabel(/Treating entity/)).toBeFocused()
  await page.getByLabel(/Treating entity/).selectOption({ label: 'Synthetic Praxis Mitte' })
  await page.getByRole('button', { name: 'Create or refresh draft' }).click()
  await expect(page.getByText('Draft updated: 3 billable consultations.')).toBeVisible()
  expect(state.writes[0]).toEqual({ path: '/api/v1/admin/settlement/statements', body: { practice_id: PRACTICE, period: '2026-10' } })

  const card = page.getByRole('heading', { name: 'Synthetic Praxis Mitte · 2026-10' }).locator('xpath=ancestor::*[.//dl][1]')
  await expect(card.getByText('Draft', { exact: true })).toBeVisible()
  await expect(card.getByText('€21.8292')).toBeVisible()
  await expect(card.getByText('€21.83')).toBeVisible()
  await expect(card.getByText('€4.15')).toBeVisible()
  await expect(card.getByText('€25.98')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Open invoice PDF' })).toHaveCount(0)

  await card.getByRole('button', { name: 'Show lines' }).click()
  const table = card.getByRole('region', { name: 'Statement lines' })
  await expect(table.getByRole('row')).toHaveCount(4)
  await expect(table.getByRole('row').nth(1)).toContainText('GKV, known patient')
  await expect(table.getByRole('row').nth(1)).toContainText('6 min 52 s')
  await expect(table.getByRole('row').nth(1)).toContainText('€5.0952')
  // 22:30 UTC on 28 October is still 28 October in Berlin (CET, UTC+1). English uses en-GB formats.
  await expect(table.getByRole('row').nth(3)).toContainText('28/10/2026')
  await expect(table.getByRole('row').nth(3)).toContainText('PKV / self-pay')

  await card.getByRole('button', { name: 'Issue invoice' }).click()
  await card.getByRole('button', { name: 'Confirm and issue' }).click()
  await expect(card.getByText('Confirm that you checked the statement.')).toBeVisible()
  expect(state.writes).toHaveLength(1)
  await card.getByLabel(/I checked this statement/).check()
  await card.getByRole('button', { name: 'Confirm and issue' }).click()
  await expect(page.getByText('Invoice QH-2026-000001 issued for 2026-10.').first()).toBeVisible()
  expect(state.writes[1]).toMatchObject({ path: `/api/v1/admin/settlement/statements/${STATEMENT}/issue`, ifMatch: '"1"' })
  await expect(card.getByText('Invoiced', { exact: true })).toBeVisible()
  await expect(card.getByText(/Invoice QH-2026-000001/).first()).toBeVisible()
  await expect(card.getByRole('button', { name: 'Issue invoice' })).toHaveCount(0)

  const popup = page.waitForEvent('popup')
  await card.getByRole('button', { name: 'Open invoice PDF' }).click()
  const tab = await popup
  await tab.waitForURL(INVOICE_URL)
  expect(await tab.evaluate(() => window.opener)).toBeNull()
  expect(page.url()).toContain('/admin/settlement')
})

test('a stale statement version is refused and nothing is issued', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/admin/settlement')
  await pickMonth(page)
  await page.getByLabel(/Treating entity/).selectOption({ label: 'Synthetic Praxis Mitte' })
  await page.getByRole('button', { name: 'Create or refresh draft' }).click()
  await expect(page.getByText('Draft updated: 3 billable consultations.')).toBeVisible()
  // Another administrator refreshed the draft after this page loaded it.
  state.changedElsewhere = true
  await page.getByRole('button', { name: 'Issue invoice' }).click()
  await page.getByLabel(/I checked this statement/).check()
  await page.getByRole('button', { name: 'Confirm and issue' }).click()
  await expect(page.getByText('This statement changed. Refresh it before issuing.')).toBeVisible()
  expect(state.statements[0].status).toBe('DRAFT')
  expect(state.writes[1].ifMatch).toBe('"1"')
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
})

test('the practice owner sees issued invoices only and opens the PDF', async ({ page, context }) => {
  const state = await prepare(context, { issued: true })
  state.statements.push({ ...state.statements[0], id: '99999999-9999-4999-8999-999999999992', period: '2026-11', status: 'DRAFT', invoice_number: null, issued_at: null, version: 1 })
  await page.goto('/practice/statements')
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Invoices' }).first()).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Synthetic Praxis Mitte · 2026-10')).toBeVisible()
  await expect(page.getByText('2026-11')).toHaveCount(0)
  await expect(page.getByText('€25.98')).toBeVisible()
  await page.getByRole('button', { name: 'Show consultations' }).click()
  await expect(page.getByRole('region', { name: 'Statement lines' }).getByRole('row')).toHaveCount(4)
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open invoice PDF' }).click()
  await (await popup).waitForURL(INVOICE_URL)
  expect(state.invoiceOpened).toBe(1)
})

for (const width of [320, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`settlement screens fit ${width}px in ${scheme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme })
    await prepare(context, { issued: true })
    await page.goto('/admin/settlement')
    await pickMonth(page)
    await expect(page.getByText('Synthetic Praxis Mitte · 2026-10')).toBeVisible()
    await page.getByRole('button', { name: 'Show lines' }).click()
    await expect(page.getByRole('region', { name: 'Statement lines' })).toBeVisible()
    await noHorizontalOverflow(page)
    await page.goto('/practice/statements')
    await expect(page.getByText('Synthetic Praxis Mitte · 2026-10')).toBeVisible()
    await noHorizontalOverflow(page)
  })
}

test.describe('in German', () => {
  test.use({ storageState: { cookies: [{ name: 'qarevo_locale', value: 'de', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] } })

  test('the practice owner reads the invoice in German with German formats', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL! }])
    await prepare(context, { issued: true })
    await page.goto('/practice/statements')
    await expect(page.getByRole('heading', { name: 'Rechnungen', exact: true })).toBeVisible()
    await expect(page.getByText('3 abrechenbare Sprechstunden · Rechnung QH-2026-000001')).toBeVisible()
    await expect(page.getByText('In Rechnung gestellt')).toBeVisible()
    await expect(page.getByText('25,98 €')).toBeVisible()
    await page.getByRole('button', { name: 'Sprechstunden anzeigen' }).click()
    const table = page.getByRole('region', { name: 'Abrechnungspositionen' })
    await expect(table.getByRole('row').nth(1)).toContainText('GKV, bereits bekannt')
    await expect(table.getByRole('row').nth(1)).toContainText('6 Min. 52 Sek.')
    await expect(table.getByRole('row').nth(3)).toContainText('28.10.2026')
    await expect(page.getByRole('button', { name: 'Rechnung (PDF) öffnen' })).toBeVisible()
  })
})

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const ALPHA = '11111111-1111-4111-8111-111111111111', BETA = '22222222-2222-4222-8222-222222222222'
const TITLE = 'Synthetic private creation intent', CURRENT = 'Synthetic current edited instruction'
type Kind = 'medication' | 'care_plan' | 'lab_request'
const kinds: Kind[] = ['medication', 'care_plan', 'lab_request']
const contracts = {
  medication: { route: '/doctor/prescriptions', api: 'prescriptions', singular: 'medication', plural: 'medications', prefix: 'med-', add: 'Add Medication', submit: 'Add Medication' },
  care_plan: { route: '/doctor/care-plans', api: 'care-plans', singular: 'care_plan', plural: 'care_plans', prefix: 'cp-', add: 'Add Care Plan', submit: 'Create Care Plan' },
  lab_request: { route: '/doctor/lab-orders', api: 'lab-orders', singular: 'lab_test', plural: 'test_requests', prefix: '', add: 'Order Lab Test', submit: 'Create Lab Request' },
} as const
function hold() { let release!: () => void, start!: () => void, finish!: () => void; return { wait: new Promise<void>(resolve => { release = resolve }), entered: new Promise<void>(resolve => { start = resolve }), settled: new Promise<void>(resolve => { finish = resolve }), release: () => release(), start: () => start(), finish: () => finish() } }
async function prepare(context: BrowserContext) {
  const doctor = await seedPortalSession(context, 'doctor'), patient = await seedPortalSession(context, 'patient'); await context.addInitScript(() => sessionStorage.setItem('qarevo:active-portal', 'doctor'))
  const state = { mode: 'success', rows: { medication: { [ALPHA]: [], [BETA]: [] }, care_plan: { [ALPHA]: [], [BETA]: [] }, lab_request: { [ALPHA]: [], [BETA]: [] } } as Record<Kind, Record<string, Record<string, unknown>[]>>, requests: [] as { kind: Kind; body: Record<string, unknown> }[], receipts: new Map<string, { kind: Kind; patient: string; record: string; body: string }>(), mutations: 0, held: null as ReturnType<typeof hold> | null, revoked: false, reads: 0 }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(request.headers()['x-qarevo-portal'] === 'patient' ? patient : doctor) })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const body = path.endsWith('/search') ? request.postDataJSON() : null, id = body?.patient_id || url.searchParams.get('patient_id'), size = Number(body?.page_size || url.searchParams.get('page_size') || 25)
      const patients = [{ patient_id: ALPHA, name: 'Synthetic Alpha' }, { patient_id: BETA, name: 'Synthetic Beta' }].filter(row => !id || (!state.revoked && row.patient_id === id))
      return route.fulfill({ json: { patients, total_count: 2, filtered_count: patients.length, page: 1, page_size: size, has_next: false, has_previous: false } })
    }
    if (path.endsWith('/patient/prescription-care-plan')) return route.fulfill({ json: { medications: state.rows.medication[ALPHA], care_plans: state.rows.care_plan[ALPHA] } })
    if (path.endsWith('/patient/lab-requests')) return route.fulfill({ json: { test_requests: state.rows.lab_request[ALPHA], partner_labs: [], preparation: [], recent_uploads: [], summary: { requested_tests: state.rows.lab_request[ALPHA].length, pending_tests: state.rows.lab_request[ALPHA].length, completed_tests: 0 } } })
    const match = path.match(/^\/api\/v1\/doctor\/(prescriptions|care-plans|lab-orders)(?:\/([^/]+))?$/)
    if (match) {
      const kind = kinds.find(item => contracts[item].api === match[1])!, c = contracts[kind]
      if (method === 'GET') { state.reads++; return route.fulfill({ json: { patient_id: match[2], [c.plural]: state.rows[kind][match[2]] || [] } }) }
      if (method === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>; state.requests.push({ kind, body }); const creationId = String(body.creation_id), patientId = String(body.patient_id), prior = state.receipts.get(creationId)
        if (state.mode === 'validation') return route.fulfill({ status: 422, json: { detail: [{ loc: ['body', kind === 'medication' ? 'dosage' : 'title'], msg: 'Synthetic exact creation field error' }] } })
        if (prior && (prior.kind !== kind || prior.patient !== patientId || prior.body !== JSON.stringify(body))) return route.fulfill({ status: 409, json: { detail: 'This creation intent cannot be reused with changed information.' } })
        const recordId = prior?.record || c.prefix + randomUUID()
        if (!prior) {
          const clinical = { ...body }; delete clinical.creation_id
          const row = { ...clinical, id: recordId, status: clinical.status || (kind === 'lab_request' ? 'Pending' : 'Active'), times: clinical.times || [], can_edit: true, can_delete: true, can_upload_result: true, result_file_id: null, result_review: { state: 'unavailable', file_id: null, review_id: null, reviewed_at: null, reviewer_provider_id: null, reviewer_name: null } }
          state.rows[kind][patientId].push(row); state.receipts.set(creationId, { kind, patient: patientId, record: recordId, body: JSON.stringify(body) }); state.mutations++
        }
        const pending = state.held; state.held = null; if (pending) { pending.start(); await pending.wait }
        try {
          if (state.mode === 'lost-ack') return await route.fulfill({ status: 503, json: { detail: 'Synthetic creation confirmation is temporarily unavailable.' } })
          const current = state.rows[kind][patientId].find(row => row.id === recordId) || null
          return await route.fulfill({ json: { patient_id: patientId, [c.singular]: current, [c.plural]: state.rows[kind][patientId], creation_receipt: { creation_id: state.mode === 'malformed' ? BETA : creationId, kind, record_id: recordId, available: Boolean(current), replayed: Boolean(prior) } } })
        } finally { pending?.finish() }
      }
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
async function open(page: Page, kind: Kind) {
  const c = contracts[kind]; await page.goto(c.route); await page.getByLabel(kind === 'lab_request' ? 'Select patient' : 'Select Patient', { exact: true }).selectOption(ALPHA)
  if (kind === 'lab_request') await expect(page.getByText('No lab requests yet for this patient.', { exact: true })).toBeVisible()
  else await expect(page.getByRole('region', { name: 'Saved clinical instructions', exact: true })).toBeVisible()
  await page.getByRole('button', { name: c.add, exact: true }).click(); await fill(page, kind)
}
async function fill(page: Page, kind: Kind, title = TITLE) {
  if (kind === 'lab_request') await page.getByLabel('Test title (required)', { exact: true }).fill(title)
  else if (kind === 'care_plan') await page.locator('#instruction-title').fill(title)
  else for (const [field, text] of Object.entries({ name: title, strength: 'Synthetic strength', dosage: 'Synthetic dose', frequency: 'Synthetic frequency', duration: 'Synthetic duration' })) await page.locator('#instruction-' + field).fill(text)
}
const submit = (page: Page, kind: Kind) => kind === 'lab_request' ? page.getByRole('button', { name: contracts[kind].submit, exact: true }) : page.locator('form[novalidate]').getByRole('button', { name: contracts[kind].submit, exact: true })
async function readyRetry(page: Page, kind: Kind) {
  if (kind !== 'lab_request') await expect(page.getByRole('button', { name: kind === 'medication' ? 'Load Medications' : 'Load Care Plans', exact: true })).toBeEnabled()
  const button = page.getByRole('button', { name: 'Retry same creation', exact: true }); await expect(button).toBeEnabled(); return button
}
async function saved(page: Page, kind: Kind) { await expect(page.getByRole('status').filter({ hasText: kind === 'lab_request' ? /Lab order saved|already saved|has not been restored/ : /instructions saved|Care plan saved|already saved|has not been restored/ })).toBeVisible() }
async function privateStorage(page: Page) { expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Synthetic private creation|Synthetic current edited|Synthetic dose/); expect(page.url()).not.toContain('Synthetic') }

for (const kind of kinds) {
  test(`${kind}: lost acknowledgment retry confirms one creation and projects later edits rather than original content`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'lost-ack'; await open(page, kind); await submit(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'confirmation is temporarily unavailable' })).toBeVisible(); const row = state.rows[kind][ALPHA][0]; row[kind === 'medication' ? 'instructions' : 'description'] = CURRENT
    state.mode = 'success'; await (await readyRetry(page, kind)).click(); await saved(page, kind); expect(state.requests).toHaveLength(2); expect(state.requests[1].body).toEqual(state.requests[0].body); expect(state.mutations).toBe(1); expect(state.receipts.size).toBe(1)
    await expect(page.getByText(CURRENT, { exact: true })).toBeVisible(); await privateStorage(page); await page.goto(kind === 'lab_request' ? '/patient/lab-requests' : '/patient/prescription-care-plan'); await expect(page.getByText(CURRENT, { exact: true })).toBeVisible(); await privateStorage(page)
  })
  test(`${kind}: a deleted replay confirms absence without restoring or creating another record`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'lost-ack'; await open(page, kind); await submit(page, kind).click(); await expect(page.getByRole('button', { name: 'Retry same creation', exact: true })).toBeVisible(); state.rows[kind][ALPHA] = []; state.mode = 'success'; await (await readyRetry(page, kind)).click(); await saved(page, kind)
    await expect(page.getByRole('status').filter({ hasText: 'has not been restored' })).toBeVisible(); expect(state.mutations).toBe(1); expect(state.rows[kind][ALPHA]).toHaveLength(0); expect(state.requests[1].body.creation_id).toBe(state.requests[0].body.creation_id)
  })
  test(`${kind}: malformed receipts preserve the original form and recover the same creation UUID`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'malformed'; await open(page, kind); await submit(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'creation could not be confirmed' })).toBeVisible(); state.mode = 'success'; await (await readyRetry(page, kind)).click(); await saved(page, kind); expect(state.requests[1].body.creation_id).toBe(state.requests[0].body.creation_id); expect(state.mutations).toBe(1)
  })
  test(`${kind}: changed uncertain details cannot send until explicit saved-list review and discard starts a new intent`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'lost-ack'; await open(page, kind); await submit(page, kind).click(); await expect(page.getByRole('button', { name: 'Retry same creation', exact: true })).toBeVisible(); await fill(page, kind, TITLE + ' changed'); await (await readyRetry(page, kind)).click(); await expect(page.getByRole('alert').filter({ hasText: 'These details differ' })).toBeVisible(); expect(state.requests).toHaveLength(1)
    if (kind === 'lab_request') { await page.getByRole('button', { name: 'Refresh saved orders', exact: true }).click(); await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Cancel', exact: true }).click() }
    else { await page.getByRole('button', { name: 'Reload saved instructions', exact: true }).click(); await expect(page.getByRole('button', { name: 'Discard edits', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Discard edits', exact: true }).click() }
    await page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true }).getByRole('button', { name: 'Discard and leave', exact: true }).click(); state.mode = 'success'; await page.getByRole('button', { name: contracts[kind].add, exact: true }).click(); await fill(page, kind, TITLE + ' new intent'); await submit(page, kind).click(); await saved(page, kind); expect(state.requests).toHaveLength(2); expect(state.requests[1].body.creation_id).not.toBe(state.requests[0].body.creation_id); expect(state.mutations).toBe(2)
  })
  test(`${kind}: initial structured422 permits correction but a later422 cannot release an uncertain identity`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'validation'; await open(page, kind); await submit(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'Synthetic exact creation field error' }).first()).toBeVisible(); state.mode = 'lost-ack'; await fill(page, kind, TITLE + ' corrected'); await submit(page, kind).click(); await expect(page.getByRole('button', { name: 'Retry same creation', exact: true })).toBeVisible(); expect(state.requests[1].body.creation_id).not.toBe(state.requests[0].body.creation_id)
    state.mode = 'validation'; await (await readyRetry(page, kind)).click(); await expect(page.getByRole('alert').filter({ hasText: 'Synthetic exact creation field error' }).first()).toBeVisible(); state.mode = 'success'; await (await readyRetry(page, kind)).click(); await saved(page, kind); expect(state.requests[2].body.creation_id).toBe(state.requests[1].body.creation_id); expect(state.requests[3].body.creation_id).toBe(state.requests[1].body.creation_id); expect(state.mutations).toBe(1)
  })
  test(`${kind}: duplicate submits and late account-swapped confirmations cannot restore private form data`, async ({ page, context }) => {
    const state = await prepare(context); const pending = hold(); state.held = pending; await open(page, kind)
    if (kind === 'lab_request') await submit(page, kind).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
    else await page.locator('form[novalidate]').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await pending.entered; expect(state.requests).toHaveLength(1); await page.evaluate(() => { const key = 'qarevo:doctor:identity', newValue = JSON.stringify({ user_id: 'other-clinician', role: 'PROVIDER', provider_id: 'other-provider', session_id: 'other-session' }); localStorage.setItem(key, newValue); dispatchEvent(new StorageEvent('storage', { key, newValue })) }); await expect(page).toHaveURL(/\/auth\/doctor\/login/); pending.release(); await pending.settled; await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0); await privateStorage(page); expect(state.mutations).toBe(1)
  })
  test(`${kind}: same-tick query changes block stale creation before UUID submission`, async ({ page, context }) => {
    const state = await prepare(context); await open(page, kind)
    if (kind === 'lab_request') await submit(page, kind).evaluate(button => { history.pushState({}, '', location.pathname + '?changed=1'); (button as HTMLButtonElement).click() })
    else await page.locator('form[novalidate]').evaluate(form => { history.pushState({}, '', location.pathname + '?changed=1'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(state.requests).toHaveLength(0); await privateStorage(page)
  })
}
for (const width of [320, 820, 1440]) test(`creation-recovery controls remain usable in all three editors and both themes at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await prepare(context); await page.setViewportSize({ width, height: 900 })
  for (const kind of kinds) for (const theme of ['light', 'dark']) {
    state.mode = 'lost-ack'; await open(page, kind); await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); await submit(page, kind).click(); const retry = await readyRetry(page, kind); await expect(retry).toBeEnabled(); await retry.focus(); await expect(retry).toBeFocused(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`creation-${kind}-${width}-${theme}.png`), animations: 'disabled' }); await expectEnabledControlContrast(retry); await privateStorage(page)
    state.mode = 'success'; await retry.press('Enter'); await saved(page, kind)
  }
})

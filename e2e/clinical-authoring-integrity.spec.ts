import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'

const ALPHA = '11111111-1111-4111-8111-111111111111', BETA = '22222222-2222-4222-8222-222222222222'
const MED = 'med-33333333-3333-4333-8333-333333333333', PLAN = 'cp-44444444-4444-4444-8444-444444444444'
const SENTINEL = 'Synthetic private medication sentinel'
function medication(extra: Record<string, unknown> = {}) { return { id: MED, name: SENTINEL, strength: 'Synthetic strength', dosage: 'Synthetic dose', frequency: 'Synthetic frequency', duration: 'Synthetic duration', instructions: 'Synthetic instruction', brand: null, food: null, refill: null, times: ['Morning'], status: 'Active', can_mark_taken: true, taken_today: false, ...extra } }
function plan(extra: Record<string, unknown> = {}) { return { id: PLAN, title: 'Synthetic care plan', status: 'Monitoring', description: 'Synthetic plan instruction', progress: null, ...extra } }
function hold() { let release!: () => void, entered!: () => void, settled!: () => void; return { release: () => release(), wait: new Promise<void>(resolve => { release = resolve }), entered: new Promise<void>(resolve => { entered = resolve }), start: () => entered(), settled: new Promise<void>(resolve => { settled = resolve }), finish: () => settled() } }
type Hold = ReturnType<typeof hold>
async function prepare(context: BrowserContext, role: 'doctor' | 'patient' = 'doctor') {
  const identities = { doctor: await seedPortalSession(context, 'doctor'), patient: await seedPortalSession(context, 'patient') }
  const state = { meds: { [ALPHA]: [] as Record<string, unknown>[], [BETA]: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>, plans: { [ALPHA]: [] as Record<string, unknown>[], [BETA]: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>, writes: [] as { method: string; body: Record<string, unknown>; path: string }[], failWrite: false, failReport: false, reportBodies: [] as Record<string, unknown>[], readHold: null as Hold | null, writeHold: null as Hold | null }
  const dashboard = () => ({ patient_name: 'Synthetic Patient', medications: state.meds[ALPHA], care_plans: state.plans[ALPHA], summary_cards: [], appointments: [], notifications: [] })
  await context.addInitScript(portal => sessionStorage.setItem('qarevo:active-portal', portal), role)
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    expect(request.headers().authorization).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) { const portal = request.headers()['x-qarevo-portal'] === 'doctor' ? 'doctor' : 'patient'; return route.fulfill({ json: testSessionTiming(identities[portal]) }) }
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const search = path.endsWith('/search') ? request.postDataJSON() : null
      const selectedId = search?.patient_id || url.searchParams.get('patient_id'), size = Number(search?.page_size || url.searchParams.get('page_size') || 25)
      const patients = [{ patient_id: ALPHA, name: 'Synthetic Alpha' }, { patient_id: BETA, name: 'Synthetic Beta' }].filter(patient => !selectedId || patient.patient_id === selectedId)
      return route.fulfill({ json: { patients, total_count: 2, filtered_count: patients.length, page: 1, page_size: size, has_next: false, has_previous: false } })
    }
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/dashboard/medications/mark-taken')) {
      const body = request.postDataJSON(); state.reportBodies.push(body)
      if (state.failReport) return route.fulfill({ status: 503, json: { detail: 'Synthetic report could not be saved. Retry your report.' } })
      state.meds[ALPHA] = state.meds[ALPHA].map(med => med.id === body.medication_id ? { ...med, taken_today: true, adherence: { source: 'patient-reported', reported_today: true, reported_at: '2030-07-13T22:30:00Z', recorded_on: '2030-07-14', time_zone: 'Europe/Berlin' } } : med)
      return route.fulfill({ json: dashboard() })
    }
    if (path.endsWith('/patient/dashboard')) return route.fulfill({ json: dashboard() })
    if (path.endsWith('/patient/activity/notifications')) return route.fulfill({ json: { notifications: [] } })
    if (path.endsWith('/patient/prescription-care-plan')) return route.fulfill({ json: { medications: state.meds[ALPHA], care_plans: state.plans[ALPHA] } })
    const match = path.match(/^\/api\/v1\/doctor\/(prescriptions|care-plans)(?:\/([^/]+))?(?:\/([^/]+))?$/)
    if (match) {
      const kind = match[1], patientId = method === 'GET' ? match[2] : method === 'DELETE' ? match[2] : String(request.postDataJSON().patient_id), key = kind === 'prescriptions' ? 'medications' : 'care_plans', collection = kind === 'prescriptions' ? state.meds : state.plans
      if (method === 'GET') {
        const rows = JSON.parse(JSON.stringify(collection[patientId] || [])), pending = patientId === ALPHA ? state.readHold : null
        if (pending) { state.readHold = null; pending.start(); await pending.wait }
        try { await route.fulfill({ json: { patient_id: patientId, [key]: rows } }) } finally { pending?.finish() }
        return
      }
      const body = method === 'DELETE' ? {} : request.postDataJSON(); state.writes.push({ method, body, path })
      if (state.failWrite) return route.fulfill({ status: 422, json: { detail: [{ loc: ['body', kind === 'prescriptions' ? 'dosage' : 'title'], msg: 'Synthetic exact clinician validation error' }] } })
      if (method === 'POST') collection[patientId] = [...(collection[patientId] || []), kind === 'prescriptions' ? medication({ ...body, id: MED }) : plan({ ...body, id: PLAN })]
      if (method === 'PUT') { const id = kind === 'prescriptions' ? body.medication_id : match[3]; collection[patientId] = (collection[patientId] || []).map(record => record.id === id ? { ...record, ...body } : record) }
      if (method === 'DELETE') collection[patientId] = (collection[patientId] || []).filter(record => record.id !== match[3])
      const response = JSON.parse(JSON.stringify({ patient_id: patientId, [key]: collection[patientId] })), pending = state.writeHold
      if (pending) { state.writeHold = null; pending.start(); await pending.wait }
      try { await route.fulfill({ json: response }) } finally { pending?.finish() }
      return
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
async function selectPatient(page: Page, route = '/doctor/prescriptions') { await page.goto(route); await page.getByLabel('Select Patient', { exact: true }).selectOption(ALPHA); await expect(page.getByRole('region', { name: 'Saved clinical instructions' })).toBeVisible() }
async function openMedication(page: Page) { await page.getByRole('button', { name: 'Add Medication', exact: true }).click() }
async function fillMedication(page: Page) { for (const [key, value] of Object.entries({ name: SENTINEL, strength: 'Synthetic strength', dosage: 'Synthetic dose', frequency: 'Synthetic frequency', duration: 'Synthetic duration' })) await page.locator(`#instruction-${key}`).fill(value) }

for (const [route, kind] of [['/doctor/prescriptions', 'medication'], ['/doctor/care-plans', 'care-plan']] as const) test(`${kind}: historical gaps are explicit and duplicate identifiers disable corrections`, async ({ page, context }) => {
  const state = await prepare(context); state.meds[ALPHA] = [{ id: MED, name: SENTINEL, times: {}, status: 'Taken today' }, { id: MED, name: 'Synthetic duplicate', times: null }]; state.plans[ALPHA] = [plan({ progress: null }), plan({ title: 'Synthetic duplicate' })]
  await selectPatient(page, route)
  const records = page.getByRole('region', { name: 'Saved clinical instructions' })
  await expect(records.getByText('Not recorded', { exact: true }).first()).toBeVisible()
  await expect(records.getByRole('button', { name: 'Edit', exact: true }).first()).toBeDisabled()
  await expect(records.getByRole('button', { name: 'Delete', exact: true }).first()).toBeDisabled()
  await expect(records.getByText('This record identifier is duplicated.', { exact: false }).first()).toBeVisible()
  if (kind === 'medication') await expect(records.getByText('Schedule unavailable; ask your clinician to clarify.', { exact: true })).toBeVisible()
  else await expect(records.locator('progress')).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
})

test('medication authoring displays every required validation and an exact server error before safe retry', async ({ page, context }) => {
  const state = await prepare(context); await selectPatient(page); await openMedication(page)
  const submit = page.locator('form[novalidate]').getByRole('button', { name: 'Add Medication', exact: true })
  await submit.click()
  for (const label of ['Medication Name', 'Strength', 'Dosage', 'Frequency', 'Duration']) await expect(page.getByRole('alert').filter({ hasText: `${label} is required.` })).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await fillMedication(page); await page.locator('#instruction-times').fill('25:00'); await submit.click(); await expect(page.locator('#instruction-times-error')).toBeVisible(); expect(state.writes).toHaveLength(0)
  await page.locator('#instruction-times').fill('08:00'); state.failWrite = true; await submit.click(); await expect(page.locator('#instruction-dosage-error')).toHaveText('Synthetic exact clinician validation error')
  await expect(page.locator('#instruction-name')).toHaveValue(SENTINEL)
  state.failWrite = false; await submit.click(); await expect(page.getByRole('article', { name: 'Medication instructions' })).toBeVisible()
  expect(state.writes).toHaveLength(2); expect(state.writes[1].body.times).toEqual(['08:00'])
})

test('correction submits only changed fields, preserves historical gaps, and propagates to the patient view', async ({ page, context }) => {
  const state = await prepare(context); state.meds[ALPHA] = [{ id: MED, name: SENTINEL, instructions: 'Synthetic legacy note', times: null, status: 'Active' }]
  await selectPatient(page); await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('#instruction-episode_id')).toHaveCount(0)
  await page.locator('#instruction-instructions').fill('Synthetic corrected instruction'); await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changed clinical fields saved.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Saved clinical instructions' }).getByText('Synthetic corrected instruction', { exact: true })).toBeVisible()
  expect(state.writes[0].body).toEqual({ patient_id: ALPHA, medication_id: MED, instructions: 'Synthetic corrected instruction' })
  await page.goto('/patient/prescription-care-plan'); await expect(page.getByText('Synthetic corrected instruction', { exact: true })).toBeVisible()
  await expect(page.getByText('Not recorded', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic corrected instruction')
  state.meds[ALPHA] = []; await page.evaluate(() => dispatchEvent(new Event('focus'))); await expect(page.getByRole('heading', { name: 'No medications recorded', exact: true })).toBeVisible()
})

test('care-plan creation distinguishes unknown progress from explicitly entered zero and allows an explicit clear', async ({ page, context }) => {
  const state = await prepare(context); await selectPatient(page, '/doctor/care-plans'); await page.getByRole('button', { name: 'Add Care Plan', exact: true }).click()
  await expect(page.locator('#instruction-progress')).toHaveValue(''); await page.locator('#instruction-title').fill('Synthetic unknown plan'); await page.getByRole('button', { name: 'Create Care Plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic unknown plan', exact: true })).toBeVisible(); expect(state.writes[0].body.progress).toBeNull()
  await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('#instruction-progress').fill('0'); await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('0%', { exact: true })).toBeVisible(); expect(state.writes[1].body.progress).toBe(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('#instruction-progress').fill(''); await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Care plan' }).locator('progress')).toHaveCount(0); expect(state.writes[2].body.progress).toBeNull()
})

for (const route of ['/doctor/prescriptions', '/doctor/care-plans']) test(`${route}: a delayed previous-patient read cannot replace the selected patient's instructions`, async ({ page, context }) => {
  const state = await prepare(context); state.meds[ALPHA] = [medication()]; state.meds[BETA] = [medication({ name: 'Synthetic Beta medication' })]; state.plans[ALPHA] = [plan()]; state.plans[BETA] = [plan({ title: 'Synthetic Beta plan' })]
  const pending = hold(); state.readHold = pending; await page.goto(route); await page.getByLabel('Select Patient', { exact: true }).selectOption(ALPHA); await pending.entered
  await page.getByLabel('Select Patient', { exact: true }).selectOption(BETA); await expect(page.getByRole('heading', { name: route.endsWith('prescriptions') ? 'Synthetic Beta medication' : 'Synthetic Beta plan', exact: true })).toBeVisible()
  pending.release(); await pending.settled; await expect(page.getByRole('heading', { name: route.endsWith('prescriptions') ? SENTINEL : 'Synthetic care plan', exact: true })).toHaveCount(0)
})

test('duplicate submits are blocked and a late save cannot restore clinical text after an account change', async ({ page, context }) => {
  const state = await prepare(context); await selectPatient(page); await openMedication(page); await fillMedication(page)
  const pending = hold(); state.writeHold = pending; await page.locator('form[novalidate]').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await pending.entered
  expect(state.writes).toHaveLength(1)
  await page.evaluate(() => { const key = 'qarevo:doctor:identity', value = JSON.stringify({ user_id: 'different-synthetic-doctor', role: 'PROVIDER', provider_id: 'different-provider', session_id: 'different-session' }); localStorage.setItem(key, value); dispatchEvent(new StorageEvent('storage', { key, newValue: value })) })
  await expect(page).toHaveURL(/\/auth\/doctor\/login/); pending.release(); await pending.settled
  await expect(page.getByText(SENTINEL, { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(SENTINEL)
})

test('stale doctor controls cannot submit after a same-tick switch to the coexisting patient portal', async ({ page, context }) => {
  const state = await prepare(context); await selectPatient(page); await openMedication(page); await fillMedication(page)
  await page.locator('form[novalidate]').evaluate(form => { history.pushState({}, '', '/patient/dashboard'); sessionStorage.setItem('qarevo:active-portal', 'patient'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(state.writes).toHaveLength(0)
})

test('patient adherence uses an opaque ID, shows retry errors and never changes the clinician status or exposes names in URLs', async ({ page, context }) => {
  const state = await prepare(context, 'patient'); state.meds[ALPHA] = [medication()]; state.failReport = true
  await page.goto('/patient/dashboard'); const button = page.getByRole('button', { name: 'Report taken today', exact: true }); await button.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic report could not be saved.' })).toBeVisible(); expect(state.reportBodies).toEqual([{ medication_id: MED }])
  state.failReport = false; await page.getByRole('button', { name: 'Retry report taken today', exact: true }).click()
  await expect(page.getByText('Patient-reported: taken today', { exact: false })).toContainText('2030-07-14 (Europe/Berlin)')
  await expect(page.locator('[data-clinical-status="Active"]')).toBeVisible(); expect(state.meds[ALPHA][0].status).toBe('Active')
  await expect(page.getByRole('button', { name: 'Report taken today', exact: true })).toBeDisabled()
  const link = page.getByRole('link', { name: 'View Details', exact: true }); await expect(link).toHaveAttribute('href', '/patient/prescription-care-plan'); await link.click()
  expect(page.url()).not.toContain('medication='); expect(page.url()).not.toContain(encodeURIComponent(SENTINEL))
})

for (const width of [320, 820, 1440]) test(`clinical instructions remain responsive, keyboard reachable and theme compatible at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await prepare(context); state.meds[ALPHA] = [medication({ status: 'Stopped', times: null })]
  await page.setViewportSize({ width, height: 900 }); await selectPatient(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    const edit = page.getByRole('button', { name: 'Edit', exact: true }); await edit.focus(); await expect(edit).toBeFocused()
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath(`clinical-instructions-${width}-${theme}.png`), fullPage: true, animations: 'disabled' })
    await expectEnabledControlContrast(edit); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(page.locator('[data-clinical-status="Stopped"]')).toHaveAttribute('data-status-tone', 'neutral')
    await page.getByRole('button', { name: 'Add Medication', exact: true }).click()
    const input = page.locator('#instruction-name'); await input.focus(); await expect(input).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.locator('#instruction-brand')).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`clinical-authoring-form-${width}-${theme}.png`), fullPage: true, animations: 'disabled' })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expectEnabledControlContrast(page.locator('form[novalidate]').getByRole('button', { name: 'Add Medication', exact: true }))
    await page.getByRole('button', { name: 'Close form', exact: true }).click()
  }
})

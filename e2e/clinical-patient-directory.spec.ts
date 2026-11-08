import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
import type { DoctorPatient } from '../lib/api'
const ids = Array.from({ length: 30 }, (_, index) => `000000${(index + 1).toString(16).padStart(2, '0')}-1111-4111-8111-111111111111`)
const patients: DoctorPatient[] = ids.map((id, index) => ({ patient_id: id, name: `Synthetic Patient ${String(index + 1).padStart(2, '0')}`, email: `synthetic-${index + 1}@example.test`, phone: null, age: 30, gender: 'Not specified', last_visit: null, total_consultations: 1, status: index % 2 === 0 ? 'active' : 'inactive' }))
function hold() { let release!: () => void, entered!: () => void, settled!: () => void; return { release: () => release(), wait: new Promise<void>(resolve => { release = resolve }), entered: new Promise<void>(resolve => { entered = resolve }), start: () => entered(), settled: new Promise<void>(resolve => { settled = resolve }), finish: () => settled() } }
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const state = { fail: false, revoked: false, activity: 0, requests: [] as { page: number; query: string; id: string | null }[], writes: [] as Record<string, unknown>[], heldWrite: null as ReturnType<typeof hold> | null, heldQuery: null as { query: string; pending: ReturnType<typeof hold> } | null, heldExact: null as { id: string; pending: ReturnType<typeof hold> } | null }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) { if (path.endsWith('/activity')) state.activity++; return route.fulfill({ json: testSessionTiming(identity) }) }
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const body = path.endsWith('/search') ? request.postDataJSON() : null
      if (body) { expect(request.method()).toBe('POST'); expect(url.search).toBe('') }
      expect(url.searchParams.has('q')).toBe(false)
      const page = Number(body?.page || url.searchParams.get('page') || 1), size = Number(body?.page_size || url.searchParams.get('page_size') || 25), query = body?.q || '', id = body?.patient_id || url.searchParams.get('patient_id'); state.requests.push({ page, query, id })
      if (!id && state.fail) return route.fulfill({ status: 503, json: { detail: 'Synthetic patient directory unavailable.' } })
      const filtered = patients.filter(patient => id ? !state.revoked && patient.patient_id === id : patient.name.toLowerCase().includes(query.toLowerCase()) || (patient.email || '').includes(query.toLowerCase()))
      const response = { patients: filtered.slice((page - 1) * size, page * size), total_count: patients.length, filtered_count: filtered.length, page, page_size: size, has_next: page * size < filtered.length, has_previous: page > 1 }
      const held = id && state.heldExact?.id === id ? state.heldExact : !id && state.heldQuery?.query === query ? state.heldQuery : null
      if (held) { if (id) state.heldExact = null; else state.heldQuery = null; held.pending.start(); await held.pending.wait }
      try { await route.fulfill({ json: response }) } finally { held?.pending.finish() }
      return
    }
    const match = path.match(/^\/api\/v1\/doctor\/(prescriptions|care-plans)(?:\/([^/]+))?$/)
    if (match) {
      const key = match[1] === 'prescriptions' ? 'medications' : 'care_plans'
      if (request.method() !== 'GET') {
        state.writes.push(request.postDataJSON()); const pending = state.heldWrite; state.heldWrite = null
        if (pending) { pending.start(); await pending.wait }
        try { await route.fulfill({ json: { [key]: [] } }) } finally { pending?.finish() }
        return
      }
      const name = patients.find(patient => patient.patient_id === match[2])?.name || 'Unknown'
      return route.fulfill({ json: { [key]: key === 'medications' ? [{ id: 'med-' + match[2], name: `${name} medication`, status: 'Active', times: [] }] : [{ id: 'cp-' + match[2], title: `${name} plan`, status: 'Monitoring', progress: null }] } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const select = (page: Page) => page.getByLabel('Select Patient', { exact: true })
async function search(page: Page, value: string) { await page.getByLabel('Find an assigned patient', { exact: true }).fill(value); await page.getByRole('button', { name: 'Search patients', exact: true }).click() }

for (const [route, add, placeholder] of [['/doctor/prescriptions', 'Add Medication', 'e.g., Amlodipine'], ['/doctor/care-plans', 'Add Care Plan', 'Care plan title']] as const) test(`${route}: all assigned patient pages are reachable and off-page selection remains editable`, async ({ page, context }) => {
  const state = await prepare(context); await page.goto(route); await page.getByRole('button', { name: 'Next patients', exact: true }).click()
  await expect(select(page).locator('option[value="' + ids[25] + '"]')).toHaveText('Synthetic Patient 26')
  await select(page).selectOption(ids[25]); await page.getByRole('button', { name: add, exact: true }).click(); await page.getByPlaceholder(placeholder, { exact: true }).fill('Synthetic unsaved page-two instruction')
  await page.getByRole('button', { name: 'Previous patients', exact: true }).click(); await expect(select(page)).toHaveValue(ids[25]); await expect(page.getByPlaceholder(placeholder, { exact: true })).toHaveValue('Synthetic unsaved page-two instruction')
  await select(page).selectOption(ids[0]); const dialog = page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true }); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(select(page)).toHaveValue(ids[25]); await select(page).selectOption(ids[0]); await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click(); await expect(select(page)).toHaveValue(ids[0])
  await expect(page.getByRole('heading', { name: route.endsWith('prescriptions') ? 'Synthetic Patient 01 medication' : 'Synthetic Patient 01 plan', exact: true })).toBeVisible()
  expect(state.requests.some(request => request.id === ids[25])).toBe(true); expect(state.writes).toHaveLength(0)
})

test('search is submitted once, resets pagination and never changes the current selected patient', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await select(page).selectOption(ids[0]); await expect(page.getByRole('heading', { name: 'Synthetic Patient 01 medication', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next patients', exact: true }).click(); await expect(page.getByText('Page 2 · Up to 25 patients per page', { exact: true })).toBeVisible()
  const before = state.requests.length; await page.getByLabel('Find an assigned patient', { exact: true }).fill('Patient 30'); expect(state.requests).toHaveLength(before)
  await page.getByRole('button', { name: 'Search patients', exact: true }).click(); await expect(select(page).locator(`option[value="${ids[29]}"]`)).toHaveText('Synthetic Patient 30'); await expect(select(page)).toHaveValue(ids[0]); await expect(page.getByText('Page 1 · Up to 25 patients per page', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Synthetic Patient 01 medication', exact: true })).toBeVisible(); expect(state.requests.filter(request => request.query === 'Patient 30')).toHaveLength(1)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Patient 30'); expect(page.url()).not.toContain('Patient')
})

test('late superseded search cannot replace a newer search or select a patient automatically', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await expect(select(page)).toBeEnabled()
  const pending = hold(); state.heldQuery = { query: 'Patient 01', pending }; await search(page, 'Patient 01'); await pending.entered
  await search(page, 'Patient 30'); await expect(select(page).locator(`option[value="${ids[29]}"]`)).toHaveText('Synthetic Patient 30'); pending.release(); await pending.settled
  await expect(select(page).locator(`option[value="${ids[0]}"]`)).toHaveCount(0); await expect(select(page)).toHaveValue(''); expect(state.writes).toHaveLength(0)
})

test('late exact relationship lookup cannot restore the previously selected patient', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/care-plans'); const pending = hold(); state.heldExact = { id: ids[0], pending }; await select(page).selectOption(ids[0]); await pending.entered
  await select(page).selectOption(ids[1]); await expect(page.getByRole('heading', { name: 'Synthetic Patient 02 plan', exact: true })).toBeVisible(); pending.release(); await pending.settled
  await expect(page.getByRole('heading', { name: 'Synthetic Patient 01 plan', exact: true })).toHaveCount(0); await expect(select(page)).toHaveValue(ids[1])
})

test('empty and failed directory searches preserve the selected clinical context with an actual retry', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await select(page).selectOption(ids[0]); await expect(page.getByRole('heading', { name: 'Synthetic Patient 01 medication', exact: true })).toBeVisible()
  await search(page, 'No synthetic match'); await expect(page.getByRole('status').filter({ hasText: 'No assigned patients match this search.' })).toBeVisible(); await expect(select(page)).toHaveValue(ids[0])
  state.fail = true; await search(page, 'Patient'); await expect(page.getByRole('alert').filter({ hasText: 'Synthetic patient directory unavailable.' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Synthetic Patient 01 medication', exact: true })).toBeVisible()
  state.fail = false; await page.getByRole('button', { name: 'Retry patients', exact: true }).click(); await expect(select(page).locator('option')).toHaveCount(26); await expect(select(page)).toHaveValue(ids[0])
})

test('a failed selected-patient relationship recheck blocks clinical actions until an authorized retry', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await select(page).selectOption(ids[0]); await expect(page.getByRole('button', { name: 'Add Medication', exact: true })).toBeVisible()
  state.revoked = true; await page.evaluate(() => dispatchEvent(new Event('focus'))); await expect(page.getByRole('alert').filter({ hasText: 'This patient is no longer available' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Add Medication', exact: true })).toHaveCount(0)
  state.revoked = false; await page.getByRole('button', { name: 'Retry selected patient access', exact: true }).click(); await expect(page.getByRole('button', { name: 'Add Medication', exact: true })).toBeVisible(); expect(state.writes).toHaveLength(0)
})

for (const width of [320, 820, 1440]) test(`assigned patient selection remains keyboard accessible and responsive at ${width}px in both themes`, async ({ page, context }, testInfo) => {
  await prepare(context); await page.setViewportSize({ width, height: 900 }); await page.goto('/doctor/care-plans'); await expect(select(page)).toBeEnabled()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); const input = page.getByLabel('Find an assigned patient', { exact: true }); await input.focus(); await expect(input).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Search patients', exact: true })).toBeFocused()
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath(`clinical-patient-directory-${width}-${theme}.png`), fullPage: true, animations: 'disabled' }); await expectEnabledControlContrast(page.getByRole('button', { name: 'Search patients', exact: true })); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('selected-access loss invalidates a held save and later recovery preserves unsaved entries without a false success', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await select(page).selectOption(ids[0]); await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#instruction-instructions').fill('Synthetic held-save instruction')
  const pending = hold(); state.heldWrite = pending; await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await pending.entered
  state.revoked = true; await page.evaluate(() => dispatchEvent(new Event('focus')))
  const retry = page.getByRole('button', { name: 'Retry selected patient access', exact: true }); await expect(retry).toBeEnabled(); await expect(page.getByRole('alert').filter({ hasText: 'We could not confirm whether it was saved.' })).toBeVisible()
  pending.release(); await pending.settled; await expect(page.getByRole('status').filter({ hasText: 'Changed clinical fields saved.' })).toHaveCount(0)
  state.revoked = false; await retry.click(); await expect(page.locator('#instruction-instructions')).toHaveValue('Synthetic held-save instruction'); await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  expect(state.writes).toHaveLength(1)
})

test('an unconfirmed create cannot be repeated after access recovery until saved records are reviewed and the draft is explicitly discarded', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/care-plans'); await select(page).selectOption(ids[0]); await page.getByRole('button', { name: 'Add Care Plan', exact: true }).click(); await page.locator('#instruction-title').fill('Synthetic unconfirmed plan')
  const pending = hold(); state.heldWrite = pending; await page.getByRole('button', { name: 'Create Care Plan', exact: true }).click(); await pending.entered
  state.revoked = true; await page.evaluate(() => dispatchEvent(new Event('focus'))); const retry = page.getByRole('button', { name: 'Retry selected patient access', exact: true }); await expect(retry).toBeEnabled()
  pending.release(); await pending.settled; state.revoked = false; await retry.click()
  const submit = page.getByRole('button', { name: 'Create Care Plan', exact: true }); await expect(submit).toBeDisabled(); await expect(page.locator('#instruction-title')).toHaveValue('Synthetic unconfirmed plan')
  await expect(page.getByText('Saved instructions have reloaded.', { exact: false })).toBeVisible(); await page.locator('form[novalidate]').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); expect(state.writes).toHaveLength(1)
  await page.getByRole('button', { name: 'Discard edits', exact: true }).click(); await page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true }).getByRole('button', { name: 'Discard and leave', exact: true }).click()
  await page.getByRole('button', { name: 'Add Care Plan', exact: true }).click(); await expect(page.locator('#instruction-title')).toHaveValue(''); await page.locator('#instruction-title').fill('Synthetic new intent'); await page.getByRole('button', { name: 'Create Care Plan', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Care plan saved.' })).toBeVisible(); expect(state.writes).toHaveLength(2)
})

test('passive directory POST focus refresh stays read-only and never records session activity', async ({ page, context }) => {
  const state = await prepare(context); await page.goto('/doctor/prescriptions'); await expect(select(page)).toBeEnabled()
  const reads = state.requests.filter(request => !request.id).length, activity = state.activity
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await expect.poll(() => state.requests.filter(request => !request.id).length).toBe(reads + 1)
  await expect(select(page)).toBeEnabled(); expect(state.activity).toBe(activity)
})

test('the existing physician patient directory sends private email searches only in the JSON body', async ({ page, context }) => {
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message))
  const state = await prepare(context); await page.goto('/doctor/patients'); await expect(page.getByRole('heading', { name: 'Patients', exact: true })).toBeVisible(); await page.getByPlaceholder('Search patients...', { exact: true }).fill('synthetic-30@example.test')
  await expect(page.getByText('Synthetic Patient 30', { exact: true })).toBeVisible()
  expect(state.requests.some(request => request.query === 'synthetic-30@example.test')).toBe(true)
  await expect(page.getByRole('heading', { name: 'This page could not be displayed', exact: true })).toHaveCount(0); expect(pageErrors).toEqual([])
  expect(page.url()).not.toContain('synthetic-30'); expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('synthetic-30')
})

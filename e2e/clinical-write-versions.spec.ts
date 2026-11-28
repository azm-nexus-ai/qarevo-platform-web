import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const PATIENT = '11111111-1111-4111-8111-111111111111', SOURCE = '22222222-2222-4222-8222-222222222222'
const TITLE = 'Synthetic versioned clinical record', ORIGINAL = 'Synthetic original instruction', DRAFT = 'Synthetic unsaved clinician instruction', OTHER = 'Synthetic other-clinician update'
const version = (n: number) => 'qwv1_' + String.fromCharCode(96 + n).repeat(43)
type Kind = 'medication' | 'care_plan' | 'lab_request'
const kinds: Kind[] = ['medication', 'care_plan', 'lab_request']
const contract = {
  medication: { route: '/doctor/prescriptions', api: 'prescriptions', plural: 'medications', id: 'med-' + SOURCE, field: 'instructions', save: 'Save changes' },
  care_plan: { route: '/doctor/care-plans', api: 'care-plans', plural: 'care_plans', id: 'cp-' + SOURCE, field: 'description', save: 'Save changes' },
  lab_request: { route: '/doctor/lab-orders', api: 'lab-orders', plural: 'test_requests', id: SOURCE, field: 'reason', save: 'Save Changes' },
} as const
function hold() { let release!: () => void, start!: () => void, finish!: () => void; return { wait: new Promise<void>(resolve => { release = resolve }), entered: new Promise<void>(resolve => { start = resolve }), settled: new Promise<void>(resolve => { finish = resolve }), release: () => release(), start: () => start(), finish: () => finish() } }
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const base = { patient_id: PATIENT, status: 'Active', write_version: version(1) }
  const state = { rows: {
    medication: [{ ...base, id: contract.medication.id, name: TITLE, strength: 'Synthetic strength', dosage: 'Synthetic dose', frequency: 'Synthetic frequency', duration: 'Synthetic duration', instructions: ORIGINAL, times: ['Morning'] }],
    care_plan: [{ ...base, id: contract.care_plan.id, title: TITLE, description: ORIGINAL, progress: null }],
    lab_request: [{ ...base, id: SOURCE, title: TITLE, reason: ORIGINAL, status: 'Pending', priority: 'Routine', can_edit: true, can_delete: true, can_upload_result: true, result_file_id: null }],
  } as Record<Kind, Record<string, unknown>[]>, writes: [] as { kind: Kind; method: string; header: string | undefined; body: Record<string, unknown> }[], committed: 0, mode: 'normal', held: null as ReturnType<typeof hold> | null }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const body = path.endsWith('/search') ? request.postDataJSON() : null, size = Number(body?.page_size || url.searchParams.get('page_size') || 25)
      return route.fulfill({ json: { patients: [{ patient_id: PATIENT, name: 'Synthetic Patient' }], total_count: 1, filtered_count: 1, page: 1, page_size: size, has_next: false, has_previous: false } })
    }
    const match = path.match(/^\/api\/v1\/doctor\/(prescriptions|care-plans|lab-orders)(?:\/([^/]+))?(?:\/([^/]+))?$/)
    if (match) {
      const kind = kinds.find(kind => contract[kind].api === match[1])!, c = contract[kind]
      if (method === 'GET') return route.fulfill({ json: { patient_id: PATIENT, [c.plural]: state.rows[kind] } })
      if (method === 'PUT' || method === 'DELETE') {
        const body = method === 'PUT' ? request.postDataJSON() : {}, header = request.headers()['if-match']; state.writes.push({ kind, method, body, header })
        const pending = state.held; state.held = null; if (pending) { pending.start(); await pending.wait }
        try {
          const row = state.rows[kind][0]
          if (!row || header !== '"' + row.write_version + '"' || state.mode === 'conflict') return await route.fulfill({ status: 412, json: { detail: { error_code: 'CLINICAL_RECORD_CHANGED', message: 'This clinical record has changed. Reload it before saving or deleting.' } } })
          if (state.mode === 'before-commit') return await route.fulfill({ status: 503, json: { detail: 'Synthetic write outcome could not be confirmed.' } })
          if (method === 'DELETE') state.rows[kind] = []
          else { const changes = { ...body }; delete changes.patient_id; delete changes.medication_id; delete changes.test_id; Object.assign(row, changes, { write_version: version(String(row.write_version).charCodeAt(5) - 95) }) }
          state.committed++
          if (state.mode === 'lost-ack') return await route.fulfill({ status: 503, json: { detail: 'Synthetic write outcome could not be confirmed.' } })
          return await route.fulfill({ json: { patient_id: PATIENT, [c.plural]: state.rows[kind] } })
        } finally { pending?.finish() }
      }
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const input = (page: Page, kind: Kind) => kind === 'lab_request' ? page.getByRole('textbox', { name: 'Reason for test', exact: true }) : page.locator('#instruction-' + contract[kind].field)
const save = (page: Page, kind: Kind) => page.getByRole('button', { name: contract[kind].save, exact: true })
async function open(page: Page, kind: Kind, edit = true) {
  const c = contract[kind]; await page.goto(c.route)
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/doctor/${c.api}/${PATIENT}` && response.request().method() === 'GET')
  await page.getByLabel(kind === 'lab_request' ? 'Select patient' : 'Select Patient', { exact: true }).selectOption(PATIENT); await loaded
  await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible()
  if (edit) { await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(input(page, kind)).toHaveValue(ORIGINAL) }
}
async function reload(page: Page, kind: Kind, buttonName?: string) {
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/doctor/${contract[kind].api}/${PATIENT}` && response.request().method() === 'GET')
  await page.getByRole('button', { name: buttonName || (kind === 'lab_request' ? 'Refresh' : kind === 'medication' ? 'Load Medications' : 'Load Care Plans'), exact: true }).click(); await loaded
  await expect(page.getByRole('button', { name: kind === 'lab_request' ? 'Refresh' : kind === 'medication' ? 'Load Medications' : 'Load Care Plans', exact: true })).toBeEnabled()
}
async function discardEditor(page: Page, kind: Kind) {
  await reload(page, kind, kind === 'lab_request' ? 'Reload changed order' : 'Reload changed record')
  await expect(save(page, kind)).toBeDisabled(); await expect(input(page, kind)).toHaveValue(DRAFT)
  await page.getByRole('button', { name: kind === 'lab_request' ? 'Cancel' : 'Discard edits', exact: true }).click()
  await page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true }).getByRole('button', { name: 'Discard and leave', exact: true }).click()
}
async function privacy(page: Page) { expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/qwv1_|Synthetic unsaved|Synthetic original instruction/); expect(page.url()).not.toMatch(/qwv1_|Synthetic/) }
for (const kind of kinds) {
  test(`${kind}: refresh never rebases a dirty editor; stale write preserves text until explicit review/discard/reopen`, async ({ page, context }) => {
    const state = await prepare(context); await open(page, kind); await input(page, kind).fill(DRAFT); state.rows[kind][0][contract[kind].field] = OTHER; state.rows[kind][0].write_version = version(2)
    await reload(page, kind); await expect(input(page, kind)).toHaveValue(DRAFT); await save(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'clinical record has changed' })).toBeVisible(); expect(state.writes[0].header).toBe('"' + version(1) + '"'); expect(state.committed).toBe(0)
    await discardEditor(page, kind); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(input(page, kind)).toHaveValue(OTHER); await input(page, kind).fill('Synthetic reviewed correction'); await save(page, kind).click(); await expect.poll(() => state.committed).toBe(1); if (kind === 'lab_request') { await expect(input(page, kind)).toHaveCount(0); await expect(page.locator('[data-lab-order-id]').getByText('Reason: Synthetic reviewed correction', { exact: true })).toBeVisible() } else await expect(page.getByRole('region', { name: 'Saved clinical instructions', exact: true }).getByText('Synthetic reviewed correction', { exact: true })).toBeVisible(); expect(state.writes[1].header).toBe('"' + version(2) + '"'); expect(state.writes[1].body.write_version).toBeUndefined(); await privacy(page)
  })
  test(`${kind}: unknown update outcome retains the original token and cannot overwrite a committed retry`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'lost-ack'; await open(page, kind); await input(page, kind).fill(DRAFT); await save(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'outcome could not be confirmed' })).toBeVisible(); expect(state.committed).toBe(1)
    state.mode = 'normal'; await reload(page, kind); await expect(input(page, kind)).toHaveValue(DRAFT); await save(page, kind).click(); await expect(page.getByRole('alert').filter({ hasText: 'clinical record has changed' })).toBeVisible(); expect(state.writes.map(item => item.header)).toEqual(['"' + version(1) + '"', '"' + version(1) + '"']); expect(state.committed).toBe(1); await privacy(page)
  })
  test(`${kind}: quick delete retains its original snapshot across refresh and requires explicit discard after conflict`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'before-commit'; await open(page, kind, false); await page.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'outcome could not be confirmed' })).toBeVisible(); state.rows[kind][0].write_version = version(2); state.mode = 'normal'; await reload(page, kind)
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'clinical record has changed' })).toBeVisible(); expect(state.writes.map(item => item.header)).toEqual(['"' + version(1) + '"', '"' + version(1) + '"']); expect(state.committed).toBe(0)
    await reload(page, kind, kind === 'lab_request' ? 'Reload action outcome' : 'Reload delete outcome'); await page.getByRole('button', { name: kind === 'lab_request' ? 'Discard stale action' : 'Discard delete attempt', exact: true }).click(); await page.getByRole('button', { name: 'Delete', exact: true }).click(); await expect.poll(() => state.committed).toBe(1); expect(state.writes[2].header).toBe('"' + version(2) + '"'); await expect(page.getByRole('heading', { name: TITLE, exact: true })).toHaveCount(0); await privacy(page)
  })
  test(`${kind}: a committed delete with a lost acknowledgment cannot delete again or restore the missing target`, async ({ page, context }) => {
    const state = await prepare(context); state.mode = 'lost-ack'; await open(page, kind, false); await page.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'outcome could not be confirmed' })).toBeVisible(); expect(state.committed).toBe(1); state.mode = 'normal'
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'clinical record has changed' })).toBeVisible(); expect(state.writes.map(item => item.header)).toEqual(['"' + version(1) + '"', '"' + version(1) + '"']); expect(state.committed).toBe(1)
    await reload(page, kind, kind === 'lab_request' ? 'Reload action outcome' : 'Reload delete outcome'); await expect(page.getByRole('heading', { name: TITLE, exact: true })).toHaveCount(0); await page.getByRole('button', { name: kind === 'lab_request' ? 'Discard stale action' : 'Discard delete attempt', exact: true }).click(); expect(state.rows[kind]).toHaveLength(0); expect(state.writes).toHaveLength(2); await privacy(page)
  })
  test(`${kind}: missing or malformed versions block edit/delete rather than silently issuing legacy writes`, async ({ page, context }) => {
    const state = await prepare(context)
    for (const token of [null, 'qwv1_invalid']) {
      state.rows[kind][0].write_version = token; await open(page, kind, false); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'no usable write version' })).toBeVisible(); await expect(input(page, kind)).toHaveCount(0); await page.getByRole('button', { name: 'Delete', exact: true }).click(); expect(state.writes).toHaveLength(0)
    }
  })
  test(`${kind}: late conditional write cannot restore another account's private editor`, async ({ page, context }) => {
    const state = await prepare(context), pending = hold(); await open(page, kind); await input(page, kind).fill(DRAFT); state.held = pending; await save(page, kind).click(); await pending.entered
    await page.evaluate(() => { const key = 'qarevo:doctor:identity', newValue = JSON.stringify({ user_id: 'other-doctor', role: 'PROVIDER', provider_id: 'other-provider', session_id: 'other-session' }); localStorage.setItem(key, newValue); dispatchEvent(new StorageEvent('storage', { key, newValue })) }); await expect(page).toHaveURL(/\/auth\/doctor\/login/); pending.release(); await pending.settled; await expect(page.getByText(DRAFT, { exact: true })).toHaveCount(0); await privacy(page)
  })
}
test('lab quick-status retry cannot silently adopt a refreshed token or record a clinical review', async ({ page, context }) => {
  const state = await prepare(context); state.mode = 'lost-ack'; await open(page, 'lab_request', false); const select = page.getByLabel('Status for ' + TITLE, { exact: true }); await select.selectOption('Processing'); await expect(page.getByRole('alert').filter({ hasText: 'outcome could not be confirmed' })).toBeVisible(); expect(state.committed).toBe(1)
  state.mode = 'normal'; await reload(page, 'lab_request'); await expect(select).toHaveValue('Processing'); await select.selectOption('Completed'); await expect(page.getByRole('alert').filter({ hasText: 'clinical record has changed' })).toBeVisible(); expect(state.writes[1].header).toBe('"' + version(1) + '"'); expect(state.committed).toBe(1)
  await reload(page, 'lab_request', 'Reload action outcome'); await page.getByRole('button', { name: 'Discard stale action', exact: true }).click(); await select.selectOption('Completed'); await expect.poll(() => state.committed).toBe(2); expect(state.writes[2].header).toBe('"' + version(2) + '"'); expect(state.rows.lab_request[0].result_review).toBeUndefined(); await privacy(page)
})
for (const width of [320, 820, 1440]) test(`stale-write recovery preserves readable fields and keyboard actions in both themes at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await prepare(context); await page.setViewportSize({ width, height: 900 })
  for (const kind of kinds) for (const theme of ['light', 'dark']) {
    state.rows[kind][0][contract[kind].field] = ORIGINAL; state.rows[kind][0].write_version = version(1); state.mode = 'conflict'; await open(page, kind); await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); await input(page, kind).fill(DRAFT); await save(page, kind).click(); const button = page.getByRole('button', { name: kind === 'lab_request' ? 'Reload changed order' : 'Reload changed record', exact: true }); await expect(button).toBeEnabled(); await button.focus(); await expect(button).toBeFocused(); await page.screenshot({ path: testInfo.outputPath(`write-conflict-${kind}-${width}-${theme}.png`), animations: 'disabled' }); await expectEnabledControlContrast(button); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await privacy(page); await discardEditor(page, kind)
  }
})

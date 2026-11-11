import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'
const patient = '11111111-1111-4111-8111-111111111111', order = '22222222-2222-4222-8222-222222222222', file = '33333333-3333-4333-8333-333333333333', nextFile = '44444444-4444-4444-8444-444444444444', provider = '55555555-5555-4555-8555-555555555555', review = '66666666-6666-4666-8666-666666666666'
const pending = (fileId = file) => ({ state: 'pending', file_id: fileId, review_id: null, reviewed_at: null, reviewer_provider_id: null, reviewer_name: null })
const acknowledged = (fileId = file) => ({ ...pending(fileId), state: 'acknowledged', review_id: review, reviewed_at: '2030-07-13T08:00:00Z', reviewer_provider_id: provider, reviewer_name: 'Synthetic Clinician' })
function hold() { let release!: () => void, entered!: () => void, settled!: () => void; return { release: () => release(), wait: new Promise<void>(resolve => { release = resolve }), entered: new Promise<void>(resolve => { entered = resolve }), start: () => entered(), settled: new Promise<void>(resolve => { settled = resolve }), finish: () => settled() } }
async function prepare(context: BrowserContext, portal: 'doctor' | 'patient' = 'doctor') {
  const identities = { doctor: await seedPortalSession(context, 'doctor', { provider_id: provider }), patient: await seedPortalSession(context, 'patient') }
  await context.addInitScript(role => sessionStorage.setItem('qarevo:active-portal', role), portal)
  const state = { row: { id: order, patient_id: patient, provider_id: provider, title: 'Synthetic laboratory request', status: 'Results Available', priority: 'Routine', can_upload_result: true, can_edit: true, can_delete: true, can_review_result: true, result_file_id: file, result_filename: 'synthetic-result.pdf', result_review: pending() } as Record<string, unknown>, calls: [] as Record<string, unknown>[], offPage: false, grants: 0, acknowledgements: 0, saved: false, lostAck: false, conflict: false, heldRead: null as ReturnType<typeof hold> | null, held: null as ReturnType<typeof hold> | null }
  const labPayload = () => ({ test_requests: [state.row], partner_labs: [], preparation: [], recent_uploads: state.row.result_file_id ? [{ request_id: order, title: 'Synthetic laboratory result', file_id: state.row.result_file_id, meta: 'Synthetic upload' }] : [], summary: { requested_tests: 1, pending_tests: 0, completed_tests: 1, upcoming_lab_appointment: null, estimated_completion: null } })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(request.headers().authorization).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identities[request.headers()['x-qarevo-portal'] === 'doctor' ? 'doctor' : 'patient']) })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients') || path.endsWith('/doctor/patients/search')) {
      const body = path.endsWith('/search') ? request.postDataJSON() : null, exact = body?.patient_id || url.searchParams.get('patient_id'), pageNumber = Number(body?.page || 1), size = Number(body?.page_size || url.searchParams.get('page_size') || 1)
      if (body) { expect(request.method()).toBe('POST'); expect(url.search).toBe('') }
      const available = [...(state.offPage ? Array.from({ length: 25 }, (_, index) => ({ patient_id: `000000${(index + 1).toString(16).padStart(2, '0')}-7777-4777-8777-777777777777`, name: `Other patient ${String(index + 1).padStart(2, '0')}` })) : []), { patient_id: patient, name: 'Synthetic Patient' }].filter(row => exact ? row.patient_id === exact : row.name.toLowerCase().includes(String(body?.q || '').toLowerCase()))
      return route.fulfill({ json: { patients: available.slice((pageNumber - 1) * size, pageNumber * size), total_count: state.offPage ? 26 : 1, filtered_count: available.length, page: pageNumber, page_size: size, has_next: pageNumber * size < available.length, has_previous: pageNumber > 1 } })
    }
    if (path.endsWith('/result/review')) {
      const body = request.postDataJSON(); state.calls.push(body); expect(body).toEqual({ file_id: file, reviewed: true })
      if (state.conflict || body.file_id !== state.row.result_file_id && !state.saved) return route.fulfill({ status: 409, json: { detail: 'The current result changed. Refresh the order before acknowledging review.' } })
      const replayed = state.saved; if (!state.saved) { state.saved = true; state.acknowledgements++ }
      if (state.row.result_file_id === file) state.row.result_review = acknowledged()
      const response = JSON.parse(JSON.stringify({ lab_test: state.row, test_requests: [state.row], review_receipt: { id: review, patient_id: patient, lab_request_id: order, file_id: file, provider_id: provider, reviewed_at: '2030-07-13T08:00:00Z', replayed, current: state.row.result_file_id === file } }))
      const held = state.held; state.held = null; if (held) { held.start(); await held.wait }
      try { if (state.lostAck) { state.lostAck = false; await route.fulfill({ status: 503, json: { detail: 'Synthetic acknowledgement confirmation unavailable. Retry the same file.' } }) } else await route.fulfill({ json: response }) } finally { held?.finish() }
      return
    }
    if (path.endsWith(`/doctor/lab-orders/${patient}`)) {
      const held = state.heldRead; state.heldRead = null; if (held) { held.start(); await held.wait }
      try { await route.fulfill({ json: { test_requests: [state.row] } }) } finally { held?.finish() }
      return
    }
    if (path.endsWith('/result') || /\/medical-records\/[^/]+\/download$/.test(path)) { state.grants++; return route.fulfill({ json: { id: state.row.result_file_id, filename: 'synthetic-result.pdf', content_type: 'application/pdf', file_size_bytes: 20, uploaded_by: 'patient', expires_in: path.endsWith('/result') ? 300 : 3600, download_url: 'https://synthetic-files.example.test/result' } }) }
    if (path.endsWith('/patient/lab-requests')) return route.fulfill({ json: labPayload() })
    if (path.endsWith('/patient/medical-records')) return route.fulfill({ json: { records: [{ id: 'lab-request-' + order, type: 'Lab Request', title: 'Synthetic laboratory request', provider: 'Synthetic Clinician', specialty: 'Diagnostics', status: 'Available', sourceType: 'lab-request', sourceId: order, sourceHref: 'https://untrusted.example.test/', result_file_id: state.row.result_file_id, result_review: state.row.result_review, canPreview: true, canDownload: false, canDelete: false }, { id: state.row.result_file_id, type: 'Lab Result', title: 'Synthetic laboratory result', lab_request_id: order, result_review: state.row.result_review, canPreview: true, canDownload: true, canDelete: false, fileType: 'PDF' }], timeline: [] } })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
async function doctorOrder(page: Page) { await page.goto('/doctor/lab-orders'); await page.getByLabel('Select patient', { exact: true }).selectOption(patient); await expect(page.getByRole('heading', { name: 'Synthetic laboratory request', exact: true })).toBeVisible() }
async function confirmDialog(page: Page) { await page.getByRole('button', { name: 'Record result review', exact: true }).click(); return page.getByRole('dialog', { name: 'Record result review', exact: true }) }

test('only an explicit clinician confirmation records review; order status and opening a file do not', async ({ page, context }) => {
  const state = await prepare(context); await doctorOrder(page); await expect(page.getByText('Clinical review not recorded', { exact: true })).toBeVisible(); expect(state.calls).toHaveLength(0)
  await page.getByRole('button', { name: 'Open result for Synthetic laboratory request', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('link', { name: 'Download lab result', exact: true })).toBeVisible(); expect(state.calls).toHaveLength(0); await page.getByRole('button', { name: 'Close document access', exact: true }).click()
  const dialog = await confirmDialog(page); const submit = dialog.getByRole('button', { name: 'Confirm review', exact: true }); await expect(submit).toBeDisabled(); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); await submit.click()
  await expect(page.getByText('Review recorded', { exact: true })).toBeVisible(); expect(state.calls).toHaveLength(1); expect(state.acknowledgements).toBe(1); expect(state.row.status).toBe('Results Available')
  await page.reload(); await page.getByLabel('Select patient', { exact: true }).selectOption(patient); await expect(page.getByText('Review recorded', { exact: true })).toBeVisible()
})

test('an unconfirmed acknowledgement retries the exact file and recovers one durable receipt', async ({ page, context }) => {
  const state = await prepare(context); state.lostAck = true; await doctorOrder(page); const dialog = await confirmDialog(page); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); await dialog.getByRole('button', { name: 'Confirm review', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Synthetic acknowledgement confirmation unavailable.'); await dialog.getByRole('button', { name: 'Retry review', exact: true }).click(); await expect(page.getByText('Review recorded', { exact: true })).toBeVisible()
  expect(state.calls).toHaveLength(2); expect(state.acknowledgements).toBe(1); expect(state.calls[0]).toEqual(state.calls[1])
})

test('a replacement file refuses stale confirmation without applying the previous file acknowledgement', async ({ page, context }) => {
  const state = await prepare(context); await doctorOrder(page); const dialog = await confirmDialog(page); state.row.result_file_id = nextFile; state.row.result_review = pending(nextFile); state.conflict = true
  await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); await dialog.getByRole('button', { name: 'Confirm review', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('The current result changed.')
  expect(state.acknowledgements).toBe(0); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page.getByText('Clinical review not recorded', { exact: true })).toBeVisible(); await expect(page.getByText('Review recorded', { exact: true })).toHaveCount(0)
})

test('missing, foreign and unavailable capabilities fail closed without inferring review from Completed', async ({ page, context }) => {
  const state = await prepare(context); state.row.status = 'Completed'; delete state.row.result_review; delete state.row.can_edit; delete state.row.can_delete; delete state.row.can_review_result
  await doctorOrder(page); await expect(page.getByText('Review status unavailable', { exact: true })).toBeVisible(); for (const name of ['Record result review', 'Edit', 'Delete']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
  await expect(page.getByLabel('Status for Synthetic laboratory request', { exact: true })).toBeDisabled(); expect(state.calls).toHaveLength(0)
})

test('same-tick portal changes prevent a stale review confirmation from sending any request', async ({ page, context }) => {
  const state = await prepare(context); await doctorOrder(page); const dialog = await confirmDialog(page); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Confirm review', exact: true }).evaluate(button => { history.pushState({}, '', '/patient/lab-requests'); (button as HTMLElement).click() }); expect(state.calls).toHaveLength(0)
})

test('late review completion cannot restore a previous clinician context after account change', async ({ page, context }) => {
  const state = await prepare(context); await doctorOrder(page); const dialog = await confirmDialog(page); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); const held = hold(); state.held = held; await dialog.getByRole('button', { name: 'Confirm review', exact: true }).click(); await held.entered
  await page.evaluate(() => { const key = 'qarevo:doctor:identity', value = JSON.stringify({ user_id: 'different-doctor', session_id: 'different-session', role: 'PROVIDER', provider_id: 'different-provider' }); localStorage.setItem(key, value); dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }); await expect(page).toHaveURL(/\/auth\/doctor\/login/); held.release(); await held.settled
  await expect(page.getByRole('dialog', { name: 'Record result review', exact: true })).toHaveCount(0); await expect(page.getByText('Review recorded', { exact: true })).toHaveCount(0); expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic laboratory request')
})

test('patient review metadata and request-specific links survive refresh and never trust arbitrary backend hrefs', async ({ page, context }) => {
  const state = await prepare(context, 'patient'); state.row.result_review = acknowledged(); await page.goto('/patient/medical-records'); await expect(page.getByText('Review recorded', { exact: true })).toHaveCount(2)
  const requestCard = page.locator('.mr-card-grid > div').filter({ has: page.getByRole('heading', { name: 'Synthetic laboratory request', exact: true }) }); await requestCard.getByRole('button', { name: 'View Details', exact: true }).click(); const link = page.getByRole('link', { name: 'View lab request', exact: true }); await expect(link).toHaveAttribute('href', '/patient/lab-requests?requestId=' + order); await link.click()
  await expect(page.locator(`[data-lab-request-id="${order}"]`).getByText('Review recorded', { exact: true })).toBeVisible(); expect(state.grants).toBe(0)
  state.row.result_file_id = nextFile; state.row.result_review = pending(nextFile); await page.evaluate(() => dispatchEvent(new Event('focus'))); await expect(page.getByText('Clinical review not recorded', { exact: true })).toBeVisible(); await expect(page.getByText('Review recorded', { exact: true })).toHaveCount(0)
})

test('patient result access requires an explicit safe link and never opens a popup automatically', async ({ page, context }) => {
  const state = await prepare(context, 'patient'); await page.goto('/patient/lab-requests?requestId=' + order); expect(state.grants).toBe(0)
  let popups = 0; page.on('popup', () => popups++); await page.getByRole('button', { name: 'Preview Result', exact: true }).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('link', { name: 'Download lab result', exact: true })).toHaveAttribute('href', 'https://synthetic-files.example.test/result'); expect(state.grants).toBe(1); expect(popups).toBe(0)
  await page.getByRole('button', { name: 'Close document access', exact: true }).click(); await expect(page.getByRole('button', { name: 'Preview Result', exact: true })).toBeFocused()
})

for (const query of ['requestId=invalid', `requestId=${order}&requestId=${nextFile}`, `requestId=${nextFile}`]) test(`patient request reference is validated without selecting a different order: ${query}`, async ({ page, context }) => {
  const state = await prepare(context, 'patient'); await page.goto('/patient/lab-requests?' + query); await expect(page.getByRole('region', { name: 'Selected lab request' })).toContainText(query.includes('invalid') || query.includes('&') ? 'This lab request link is invalid.' : 'The referenced request is unavailable to this account.'); await expect(page.locator('select').filter({ has: page.locator('option[value="' + order + '"]') })).toHaveValue(''); expect(state.grants).toBe(0)
})

for (const width of [320, 820, 1440]) test(`explicit review confirmation is responsive, themed and keyboard accessible at ${width}px`, async ({ page, context }, testInfo) => {
  await prepare(context); await page.setViewportSize({ width, height: 900 }); await doctorOrder(page)
  for (const theme of ['light', 'dark']) { await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme); const dialog = await confirmDialog(page); const checkbox = dialog.getByLabel('I have reviewed this exact result file.', { exact: true }); await expect(checkbox).toBeFocused(); await page.keyboard.press('Space'); await page.keyboard.press('Tab'); const confirm = dialog.getByRole('button', { name: 'Confirm review', exact: true }); await expect(confirm).toBeFocused(); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath(`lab-review-${width}-${theme}.png`), fullPage: true, animations: 'disabled' }); await expectEnabledControlContrast(confirm); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0) }
})

test('patient 26 is reachable through bounded pages and exact notification links without opening a result automatically', async ({ page, context }) => {
  const state = await prepare(context); state.offPage = true; await page.goto('/doctor/lab-orders'); await page.getByRole('button', { name: 'Next patients', exact: true }).click(); await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
  await expect(page.getByRole('button', { name: 'Record result review', exact: true })).toBeEnabled(); expect(state.grants).toBe(0)
  await page.goto(`/doctor/lab-orders?patientId=${patient}&requestId=${order}&fileId=${file}`); await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(patient); await expect(page.getByRole('button', { name: 'Record result review', exact: true })).toBeEnabled(); expect(state.grants).toBe(0)
})
test('directory searches do not switch an off-page selected result or its review target', async ({ page, context }) => {
  const state = await prepare(context); state.offPage = true; await page.goto('/doctor/lab-orders'); await page.getByRole('button', { name: 'Next patients', exact: true }).click(); await page.getByLabel('Select patient', { exact: true }).selectOption(patient); await expect(page.getByRole('heading', { name: 'Synthetic laboratory request', exact: true })).toBeVisible()
  await page.getByLabel('Find an assigned patient', { exact: true }).fill('Other patient 01'); await page.getByRole('button', { name: 'Search patients', exact: true }).click(); await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(patient)
  const dialog = await confirmDialog(page); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); await dialog.getByRole('button', { name: 'Confirm review', exact: true }).click(); await expect(page.getByText('Review recorded', { exact: true })).toBeVisible(); expect(state.calls).toEqual([{ file_id: file, reviewed: true }])
})
test('retrying an acknowledged older file cannot mark its replacement reviewed', async ({ page, context }) => {
  const state = await prepare(context); state.lostAck = true; await doctorOrder(page); const dialog = await confirmDialog(page); await dialog.getByLabel('I have reviewed this exact result file.', { exact: true }).check(); await dialog.getByRole('button', { name: 'Confirm review', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible()
  state.row.result_file_id = nextFile; state.row.result_review = pending(nextFile); await dialog.getByRole('button', { name: 'Retry review', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'which is no longer current' })).toBeVisible(); await expect(page.getByText('Clinical review not recorded', { exact: true })).toBeVisible(); await expect(page.getByText('Review recorded', { exact: true })).toHaveCount(0); expect(state.acknowledgements).toBe(1)
})

for (const replacement of [nextFile, null]) test(`an in-flight refresh invalidates a replaced/deleted review target and unlocks controls: ${replacement ? 'replacement' : 'deleted'}`, async ({ page, context }) => {
  const state = await prepare(context); await doctorOrder(page); const held = hold(); state.heldRead = held; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await held.entered
  const dialog = await confirmDialog(page); await expect(dialog).toBeVisible(); state.row.result_file_id = replacement; state.row.result_review = replacement ? pending(replacement) : { state: 'unavailable', file_id: null, review_id: null, reviewed_at: null, reviewer_provider_id: null, reviewer_name: null }; state.row.can_review_result = Boolean(replacement)
  held.release(); await held.settled; await expect(dialog).toHaveCount(0); await expect(page.getByLabel('Select patient', { exact: true })).toBeEnabled(); expect(state.calls).toHaveLength(0); expect(state.grants).toBe(0)
  if (replacement) await expect(page.getByRole('button', { name: 'Open result for Synthetic laboratory request', exact: true })).toBeEnabled(); else await expect(page.getByText('No result file available.', { exact: true })).toBeVisible()
})

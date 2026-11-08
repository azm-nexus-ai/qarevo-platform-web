import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'

const patient = '11111111-1111-4111-8111-111111111111', order = '22222222-2222-4222-8222-222222222222', file = '33333333-3333-4333-8333-333333333333'
const noticeId = '44444444-4444-4444-8444-444444444444', otherPatient = '55555555-5555-4555-8555-555555555555', replacement = '99999999-9999-4999-8999-999999999999'
const inbox = '/api/v1/doctor/notifications', cursor = 'v1.c3ludGhldGljX2N1cnNvcg'
type Portal = 'doctor' | 'patient'
function notice(id = noticeId, availability = 'current') { return { id, event_type: 'lab_result_uploaded', source: 'lab-result', patient_id: patient, lab_request_id: order, file_id: file, uploaded_by: 'patient', created_at: '2030-07-13T08:00:00Z', is_read: false, read_at: null, availability } }
function labOrder(resultFile: string | null = file) { return { id: order, patient_id: patient, provider_id: 'synthetic-doctor-provider', can_upload_result: true, title: 'Synthetic diagnostic request', status: 'Results Available', priority: 'Routine', result_file_id: resultFile, result_uploaded_at: resultFile ? '2030-07-13T08:00:00Z' : null } }
async function prepare(context: BrowserContext, portal: Portal = 'doctor') {
  const identity = await seedPortalSession(context, portal)
  const state = { identity, otherIdentity: null as Awaited<ReturnType<typeof seedPortalSession>> | null, notices: [notice()] as Record<string, unknown>[], older: [notice('66666666-6666-4666-8666-666666666666', 'superseded')], listFailed: false, readFailed: false, availablePatient: true, targetOnFirstPage: true, exactReads: 0, patientReads: [] as string[], pageCursors: [] as string[], marks: 0, grants: 0, externalReads: 0, order: labOrder(), lostAck: false, holdUpload: false, uploadStarted: false, uploadDelivery: Promise.resolve(), releaseUpload: () => {}, wrongFileReceipt: false, holdExactPatient: '', lookupStarted: false, lookupDelivery: Promise.resolve(), releaseLookup: () => {}, uploads: [] as string[], receipts: new Map<string, string>(), held: false, heldStarted: false, heldDelivery: Promise.resolve(), release: () => {} }
  await context.route('https://files.invalid/**', route => { state.externalReads++; return route.abort() })
  const labPayload = () => ({ test_requests: [state.order], partner_labs: [], preparation: [], recent_uploads: [], summary: { requested_tests: 1, pending_tests: 0, completed_tests: 0 } })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(request.headers()['authorization']).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(request.headers()['x-qarevo-portal'] === portal ? state.identity : state.otherIdentity || state.identity) })
    if (path === inbox) {
      state.pageCursors.push(url.searchParams.get('before') || '')
      const body = { notifications: JSON.parse(JSON.stringify(url.searchParams.has('before') ? state.older : state.notices)), has_more: !url.searchParams.has('before') && state.notices.length > 0, next_cursor: !url.searchParams.has('before') && state.notices.length > 0 ? cursor : null }
      let delivered: (() => void) | undefined
      if (state.held) { state.held = false; state.heldDelivery = new Promise<void>(resolve => { delivered = resolve }); state.heldStarted = true; await new Promise<void>(resolve => { state.release = resolve }) }
      try { return await route.fulfill({ status: state.listFailed ? 503 : 200, json: state.listFailed ? { detail: 'Synthetic result updates unavailable' } : body }) } finally { delivered?.() }
    }
    if (path.startsWith(inbox + '/') && path.endsWith('/read')) {
      state.marks++
      if (state.readFailed) return route.fulfill({ status: 503, json: { detail: 'Synthetic result read receipt failed' } })
      const row = [...state.notices, ...state.older].find(item => path === `${inbox}/${item.id}/read`)!
      row.is_read = true; row.read_at = '2030-07-13T08:05:00Z'
      return route.fulfill({ json: row })
    }
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients')) {
      const exact = url.searchParams.get('patient_id'); if (exact) state.exactReads++
      const rows = exact ? state.availablePatient ? exact === patient ? [{ patient_id: patient, name: 'Synthetic Alpha' }] : exact === otherPatient ? [{ patient_id: otherPatient, name: 'Synthetic Beta' }] : [] : [] : state.targetOnFirstPage ? [{ patient_id: patient, name: 'Synthetic Alpha' }] : [{ patient_id: otherPatient, name: 'Synthetic Beta' }]
      let delivered: (() => void) | undefined
      if (exact && exact === state.holdExactPatient) { state.holdExactPatient = ''; state.lookupDelivery = new Promise<void>(resolve => { delivered = resolve }); state.lookupStarted = true; await new Promise<void>(resolve => { state.releaseLookup = resolve }) }
      try { return await route.fulfill({ json: { patients: rows, total_count: rows.length, filtered_count: rows.length, page: 1, page_size: 25, has_next: false, has_previous: false } }) } finally { delivered?.() }
    }
    if (path.endsWith('/result') && path.includes('/doctor/lab-orders/')) {
      state.grants++
      return route.fulfill({ json: { id: state.order.result_file_id, filename: 'Synthetic result.pdf', content_type: 'application/pdf', file_size_bytes: 20, download_url: 'https://files.invalid/synthetic-result?signature=synthetic', expires_in: 300, uploaded_by: 'patient' } })
    }
    if (path.endsWith('/upload-result')) {
      const body = request.postDataBuffer()!.toString('utf8'), uploadId = /name="upload_id"\r\n\r\n([0-9a-f-]+)/.exec(body)?.[1]
      expect(uploadId).toMatch(/^[0-9a-f-]{36}$/)
      state.uploads.push(uploadId!)
      const replayed = state.receipts.has(uploadId!), saved = state.receipts.get(uploadId!) || uploadId!
      if (!replayed) { state.receipts.set(uploadId!, saved); state.order.result_file_id = saved }
      if (state.lostAck) { state.lostAck = false; return route.fulfill({ status: 503, json: { detail: 'Synthetic upload acknowledgment lost after saving' } }) }
      const response = { ...labPayload(), upload_receipt: { upload_id: uploadId, file_id: state.wrongFileReceipt ? replacement : saved, replayed, current: state.order.result_file_id === saved } }
      let delivered: (() => void) | undefined
      if (state.holdUpload) { state.holdUpload = false; state.uploadDelivery = new Promise<void>(resolve => { delivered = resolve }); state.uploadStarted = true; await new Promise<void>(resolve => { state.releaseUpload = resolve }) }
      try { return await route.fulfill({ json: response }) } finally { delivered?.() }
    }
    if (path.startsWith('/api/v1/doctor/lab-orders/')) { const requested = path.split('/').at(-1)!; state.patientReads.push(requested); return route.fulfill({ json: requested === otherPatient ? { test_requests: [{ ...state.order, id: '88888888-8888-4888-8888-888888888888', patient_id: otherPatient, title: 'Synthetic Beta request', result_file_id: replacement }] } : labPayload() }) }
    if (path.endsWith('/patient/lab-requests')) return route.fulfill({ json: labPayload() })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const card = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Clinician lab notifications', exact: true })
const targetHref = () => `/doctor/lab-orders?patientId=${patient}&requestId=${order}&fileId=${file}`

test('ordering clinician follows the exact update target and explicitly requests its file only after order validation', async ({ page, context }) => {
  const state = await prepare(context); state.targetOnFirstPage = false
  await page.goto('/doctor/notifications')
  await expect(card(page).getByRole('link', { name: 'View selected result order', exact: true })).toHaveAttribute('href', targetHref())
  await card(page).getByRole('link', { name: 'View selected result order', exact: true }).click()
  await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(patient)
  await expect(page.locator(`[data-lab-order-id='${order}']`)).toHaveAttribute('data-notification-target', 'true')
  expect(state.exactReads).toBe(1); expect(state.grants).toBe(0); expect(state.marks).toBe(0)
  await page.getByRole('button', { name: 'Jump to selected order', exact: true }).click()
  await expect(page.locator(`[data-lab-order-id='${order}']`)).toBeFocused()
  await page.getByRole('button', { name: 'Open result for Synthetic diagnostic request', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: /Download/ })).toBeVisible()
  expect(state.grants).toBe(1); expect(state.externalReads).toBe(0)
})

test('a held off-page target lookup cannot overwrite a newer query target on the same lab-orders route', async ({ page, context }) => {
  const state = await prepare(context); state.targetOnFirstPage = false; state.holdExactPatient = patient
  await page.goto(targetHref())
  await expect.poll(() => state.lookupStarted).toBe(true)
  const completed = state.lookupDelivery
  const next = `/doctor/lab-orders?patientId=${otherPatient}&requestId=88888888-8888-4888-8888-888888888888&fileId=${replacement}`
  await page.evaluate(href => history.pushState(null, '', href), next)
  await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(otherPatient)
  await expect(page.getByRole('heading', { name: 'Synthetic Beta request', exact: true })).toBeVisible()
  state.releaseLookup(); await completed
  await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(otherPatient)
  await expect(page.getByRole('heading', { name: 'Synthetic diagnostic request', exact: true })).toHaveCount(0)
  expect(state.patientReads).not.toContain(patient)
  expect(state.grants).toBe(0)
})

test('loaded target A cannot retain clinical controls or restore an old upload response while target B lookup is held', async ({ page, context }) => {
  const state = await prepare(context); state.holdUpload = true
  await page.goto(targetHref())
  await expect(page.getByRole('heading', { name: 'Synthetic diagnostic request', exact: true })).toBeVisible()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic old target upload') })
  await expect.poll(() => state.uploadStarted).toBe(true)
  const completedUpload = state.uploadDelivery
  state.holdExactPatient = otherPatient
  const next = `/doctor/lab-orders?patientId=${otherPatient}&requestId=88888888-8888-4888-8888-888888888888&fileId=${replacement}`
  await page.evaluate(href => history.pushState(null, '', href), next)
  await expect.poll(() => state.lookupStarted).toBe(true)
  const completedLookup = state.lookupDelivery
  await expect(page.getByRole('heading', { name: 'Synthetic diagnostic request', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-lab-order-id]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open result for Synthetic diagnostic request', exact: true })).toHaveCount(0)
  state.releaseUpload(); await completedUpload
  await expect(page.getByRole('status').filter({ hasText: 'Result upload saved' })).toHaveCount(0)
  await expect(page.locator('[data-lab-order-id]')).toHaveCount(0)
  state.releaseLookup(); await completedLookup
  await expect(page.getByLabel('Select patient', { exact: true })).toHaveValue(otherPatient)
  await expect(page.getByRole('heading', { name: 'Synthetic Beta request', exact: true })).toBeVisible()
  expect(state.uploads).toHaveLength(1)
})

test('a same-tick target query change rejects the old upload control before hashing or sending', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto(targetHref())
  await expect(page.getByRole('heading', { name: 'Synthetic diagnostic request', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const counters = window as unknown as { uploadHashCalls: number }; counters.uploadHashCalls = 0
    const original = crypto.subtle.digest.bind(crypto.subtle)
    Object.defineProperty(crypto.subtle, 'digest', { configurable: true, value: (...args: Parameters<typeof original>) => { counters.uploadHashCalls++; return original(...args) } })
  })
  state.holdExactPatient = otherPatient
  await page.locator('input[type=file]').first().evaluate((element, next) => {
    const input = element as HTMLInputElement, transfer = new DataTransfer()
    transfer.items.add(new File(['Synthetic stale query upload'], 'synthetic.pdf', { type: 'application/pdf' }))
    history.replaceState(null, '', next); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
  }, `/doctor/lab-orders?patientId=${otherPatient}&requestId=88888888-8888-4888-8888-888888888888&fileId=${replacement}`)
  await expect.poll(() => state.lookupStarted).toBe(true)
  await expect(page.getByRole('heading', { name: 'Synthetic diagnostic request', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { uploadHashCalls: number }).uploadHashCalls)).toBe(0)
  expect(state.uploads).toHaveLength(0)
  state.releaseLookup(); await state.lookupDelivery
})

test('superseded and unavailable inbox files cannot silently open replacements', async ({ page, context }) => {
  const state = await prepare(context); state.notices = [notice(noticeId, 'superseded'), notice('77777777-7777-4777-8777-777777777777', 'unavailable')]
  await page.goto('/doctor/notifications')
  await expect(card(page).getByRole('link', { name: 'View selected result order', exact: true })).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: 'Upload superseded', exact: true })).toBeDisabled()
  await expect(card(page).getByRole('button', { name: 'Result unavailable', exact: true })).toBeDisabled()
  expect(state.grants).toBe(0)
})

test('result replaced between inbox and order loading remains distinct from the selected file', async ({ page, context }) => {
  const state = await prepare(context); state.order.result_file_id = replacement
  await page.goto(targetHref())
  await expect(page.getByRole('region', { name: 'Selected lab result', exact: true })).toContainText('The current result shown below is a separate file')
  await expect(page.getByRole('button', { name: 'Open result for Synthetic diagnostic request', exact: true })).toHaveText('Open current result (different upload)')
  expect(state.grants).toBe(0)
  state.order.result_file_id = null
  await page.reload()
  await expect(page.getByRole('region', { name: 'Selected lab result', exact: true })).toContainText('The referenced result file is no longer available')
  await expect(page.getByRole('button', { name: 'Open result for Synthetic diagnostic request', exact: true })).toHaveCount(0)
})

test('a changed current file at grant time is rejected rather than substituted for the selected upload', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto(targetHref())
  const button = page.getByRole('button', { name: 'Open result for Synthetic diagnostic request', exact: true })
  await expect(button).toHaveText('Open selected result')
  state.order.result_file_id = replacement
  await button.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Download/ })).toHaveCount(0)
  expect(state.grants).toBe(1); expect(state.externalReads).toBe(0)
})

test('unavailable patients and malformed target UUIDs never request lab orders or file grants', async ({ page, context }) => {
  const state = await prepare(context); state.availablePatient = false; state.targetOnFirstPage = false
  await page.goto(targetHref())
  await expect(page.getByRole('region', { name: 'Selected lab result', exact: true })).toContainText('not available to this clinician account')
  expect(state.patientReads).toHaveLength(0)
  await page.goto(`/doctor/lab-orders?patientId=${patient}&requestId=${order}&fileId=javascript%3Aexample`)
  await expect(page.getByRole('region', { name: 'Selected lab result', exact: true })).toContainText('This result link is invalid')
  expect(state.grants).toBe(0)
})

test('foreign ordering capability disables result upload without sending a file', async ({ page, context }) => {
  const state = await prepare(context); state.order.can_upload_result = false
  await page.goto('/doctor/lab-orders')
  await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
  await expect(page.getByRole('button', { name: 'Upload Result', exact: true })).toBeDisabled()
  await expect(page.getByText('Only the ordering clinician can upload a result for this request.', { exact: true })).toBeVisible()
  expect(state.uploads).toHaveLength(0)
})

test('read receipts retry visibly and persist while cursor pagination remains bounded', async ({ page, context }) => {
  const state = await prepare(context); state.readFailed = true
  await page.goto('/doctor/notifications')
  await card(page).getByRole('button', { name: `Mark result update ${noticeId} as read`, exact: true }).click()
  await expect(card(page).getByRole('alert')).toContainText('Synthetic result read receipt failed')
  state.readFailed = false
  await card(page).getByRole('button', { name: `Retry marking result update ${noticeId} as read`, exact: true }).click()
  await expect(card(page).getByText('Read', { exact: true })).toBeVisible()
  await card(page).getByRole('button', { name: 'Older result updates', exact: true }).click()
  await expect(card(page).getByText('Page 2 · Up to 25 updates per page', { exact: true })).toBeVisible()
  expect(state.pageCursors).toContain(cursor)
  await card(page).getByRole('button', { name: 'Newer result updates', exact: true }).click()
  await expect(card(page).getByText('Read', { exact: true })).toBeVisible()
  await page.reload()
  await expect(card(page).getByText('Read', { exact: true })).toBeVisible()
})

test('outage stays distinct from an empty inbox and focus refresh discovers committed uploads', async ({ page, context }) => {
  const state = await prepare(context); state.listFailed = true
  await page.goto('/doctor/notifications')
  await expect(card(page).getByRole('alert')).toContainText('Synthetic result updates unavailable')
  state.listFailed = false; state.notices = []
  await card(page).getByRole('button', { name: 'Retry result updates', exact: true }).click()
  await expect(card(page)).toContainText('No result updates are available on this page')
  state.notices = [notice()]
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(card(page).getByRole('link', { name: 'View selected result order', exact: true })).toBeVisible()
})

test('a changed clinician session discards a delayed inbox response and returns to the correct sign-in', async ({ page, context }) => {
  const state = await prepare(context); state.held = true
  await page.goto('/doctor/notifications')
  await expect.poll(() => state.heldStarted).toBe(true)
  const completed = state.heldDelivery
  state.identity = { user_id: 'synthetic-other-doctor', role: 'PROVIDER', session_id: 'synthetic-other-session', provider_id: 'synthetic-other-provider' }
  try {
    await page.evaluate(identity => { const key = 'qarevo:doctor:identity', value = JSON.stringify(identity); localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }, state.identity)
    await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  } finally { state.release() }
  await completed
  await expect(card(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('lab_result_uploaded')
})

test('same-tick clinician account changes block stale inbox actions before React cleanup', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/doctor/notifications')
  await expect(card(page).getByRole('link', { name: 'View selected result order', exact: true })).toBeVisible()
  state.identity = { user_id: 'synthetic-other-doctor', role: 'PROVIDER', session_id: 'synthetic-other-session', provider_id: 'synthetic-other-provider' }
  await page.evaluate(identity => {
    const row = document.querySelector('[data-lab-notification-id]')!, link = row.querySelector('a')!, button = row.querySelector('button')!
    const key = 'qarevo:doctor:identity', value = JSON.stringify(identity)
    localStorage.setItem(key, value); link.click(); button.click(); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
  }, state.identity)
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  expect(state.marks).toBe(0); expect(state.grants).toBe(0)
})

test('a same-tick doctor-route change cannot submit a stale inbox read action', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/doctor/notifications')
  const mark = card(page).getByRole('button', { name: `Mark result update ${noticeId} as read`, exact: true })
  await expect(mark).toBeVisible()
  await mark.evaluate(button => { history.replaceState(null, '', '/doctor/profile'); (button as HTMLButtonElement).click() })
  await expect(page).toHaveURL(/\/doctor\/profile$/)
  expect(state.marks).toBe(0)
})

for (const portal of ['patient', 'doctor'] as const) {
  test(`${portal}: a stale upload control cannot submit into the other coexisting portal`, async ({ page, context }) => {
    const state = await prepare(context, portal)
    state.otherIdentity = await seedPortalSession(context, portal === 'doctor' ? 'patient' : 'doctor')
    await page.goto(portal === 'doctor' ? '/doctor/lab-orders' : '/patient/lab-requests')
    if (portal === 'doctor') await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
    const input = page.locator('input[type=file]').first()
    await expect(input).toBeAttached()
    await input.evaluate((element, next) => {
      const input = element as HTMLInputElement, transfer = new DataTransfer()
      transfer.items.add(new File(['Synthetic stale upload'], 'synthetic.pdf', { type: 'application/pdf' }))
      history.replaceState(null, '', next)
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
    }, portal === 'doctor' ? '/patient/notifications' : '/doctor/lab-orders')
    await expect(page).toHaveURL(portal === 'doctor' ? /\/patient\/notifications$/ : /\/doctor\/lab-orders$/)
    expect(state.uploads).toHaveLength(0)
  })
  test(`${portal}: a contradictory file receipt retains the original retry intent`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.wrongFileReceipt = true
    await page.goto(portal === 'doctor' ? '/doctor/lab-orders' : '/patient/lab-requests')
    if (portal === 'doctor') await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
    await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic receipt check') })
    await expect(page.getByRole('alert').filter({ hasText: 'Upload confirmation is unavailable' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Result upload saved' })).toHaveCount(0)
    state.wrongFileReceipt = false
    await page.getByRole('button', { name: 'Retry result upload', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'This upload was already saved' })).toBeVisible()
    expect(state.uploads).toHaveLength(2); expect(state.uploads[0]).toBe(state.uploads[1])
  })
  test(`${portal}: lost upload acknowledgment retries the same UUID and never restores a superseded file`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.order.result_file_id = null; state.lostAck = true
    await page.goto(portal === 'doctor' ? '/doctor/lab-orders' : '/patient/lab-requests')
    if (portal === 'doctor') await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
    const input = page.locator('input[type=file]').first()
    await input.setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic PDF file') })
    await expect(page.getByRole('alert').filter({ hasText: 'Synthetic upload acknowledgment lost after saving' })).toBeVisible()
    state.order.result_file_id = replacement
    await page.getByRole('button', { name: 'Retry result upload', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'it is no longer the current available result' })).toBeVisible()
    expect(state.uploads).toHaveLength(2); expect(state.uploads[0]).toBe(state.uploads[1]); expect(state.receipts.size).toBe(1)
    expect(state.order.result_file_id).toBe(replacement)
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic PDF file')
  })
  test(`${portal}: two immediate submit events create only one upload intent`, async ({ page, context }) => {
    const state = await prepare(context, portal)
    await page.goto(portal === 'doctor' ? '/doctor/lab-orders' : '/patient/lab-requests')
    if (portal === 'doctor') await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
    const input = page.locator('input[type=file]').first()
    await expect(input).toBeAttached()
    await input.evaluate(element => {
      const input = element as HTMLInputElement
      for (let index = 0; index < 2; index++) {
        const transfer = new DataTransfer(); transfer.items.add(new File(['Synthetic repeated bytes'], 'synthetic.pdf', { type: 'application/pdf' }))
        input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await expect(page.getByRole('status').filter({ hasText: 'Result upload saved' })).toBeVisible()
    expect(state.uploads).toHaveLength(1); expect(state.receipts.size).toBe(1)
  })
  test(`${portal}: changed files and a completed upload begin new intents without duplicate submissions`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.lostAck = true
    await page.goto(portal === 'doctor' ? '/doctor/lab-orders' : '/patient/lab-requests')
    if (portal === 'doctor') await page.getByLabel('Select patient', { exact: true }).selectOption(patient)
    const input = page.locator('input[type=file]').first()
    await input.setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic initial file') })
    await expect(page.getByRole('button', { name: 'Retry result upload', exact: true })).toBeVisible()
    await input.setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic replacement file') })
    await expect(page.getByRole('status').filter({ hasText: 'Result upload saved' })).toBeVisible()
    expect(state.uploads[0]).not.toBe(state.uploads[1])
    await input.setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Synthetic replacement file') })
    await expect.poll(() => state.uploads.length).toBe(3)
    expect(state.uploads[1]).not.toBe(state.uploads[2])
  })
}

for (const width of [320, 820, 1440]) test(`clinician result inbox remains accessible in both themes at ${width}px`, async ({ page, context }, testInfo) => {
  await prepare(context)
  await page.setViewportSize({ width, height: 900 }); await page.goto('/doctor/notifications')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    const refresh = card(page).getByRole('button', { name: 'Refresh result updates', exact: true }), link = card(page).getByRole('link', { name: 'View selected result order', exact: true })
    await expect(link).toBeVisible(); await link.focus(); await expect(link).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await refresh.focus(); await page.keyboard.press('Enter'); await expect(refresh).toBeEnabled()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`doctor-result-inbox-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await expectEnabledControlContrast(refresh); await expectEnabledControlContrast(link)
  }
})

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'

const readReference = 'a1111111-1111-4111-8111-111111111111', writeReference = 'a2222222-2222-4222-8222-222222222222'
function clinician(index: number) { return { provider_id: index.toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111', user_id: `synthetic-doctor-${index}`, full_name: `Synthetic Clinician ${String(index).padStart(3, '0')}`, email: `clinician-${index}@example.invalid`, email_verified: true, specialty: 'General Practice', phone: null, license_number: 'SYNTHETIC-LICENCE', status: 'ACTIVE', verification_status: 'PENDING_VERIFICATION', clinical_access: { status: 'blocked', reason: 'approval_required', message: 'Administrator review and approval are required before clinical access.' } } }
const roster = (page: Page) => page.getByRole('region', { name: 'Doctors Management', exact: true })
const position = (page: Page) => roster(page).getByRole('status', { name: 'Clinician list page', exact: true })
const options = ['ACTIVE', 'VERIFIED', 'PENDING_VERIFICATION', 'SUSPENDED', 'REJECTED', 'DEACTIVATED'].map(value => ({ value, label: value.replaceAll('_', ' ') }))

async function prepare(context: BrowserContext, page: Page, count = 63, canReview = true) {
  const identity = await seedPortalSession(context, 'admin'), patient = await seedPortalSession(context, 'patient')
  const state = { identity, patient, rows: Array.from({ length: count }, (_, i) => clinician(i + 1)), canReview, failList: false, invalidList: false, failDetail: false, failWrite: false,
    requests: [] as { kind: string; limit: number; offset: number; search: string; status: string }[], writes: [] as { provider: string; body: Record<string, unknown> }[],
    holdRead: false, readStarted: false, readDelivered: Promise.resolve(), releaseRead: () => {},
    holdDetail: false, detailStarted: false, detailDelivered: Promise.resolve(), releaseDetail: () => {},
    holdWrite: false, writeStarted: false, writeDelivered: Promise.resolve(), releaseWrite: () => {} }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(request.headers()['x-qarevo-portal'] === 'patient' ? state.patient : state.identity) })
    if (path === '/api/v1/admin/doctors' || path === '/api/v1/admin/doctors/pending/page') {
      expect(request.headers()['x-qarevo-portal']).toBe('admin')
      const kind = path.endsWith('/pending/page') ? 'pending' : 'all', limit = Number(url.searchParams.get('limit')), requested = Number(url.searchParams.get('offset')), search = url.searchParams.get('search') || '', status = url.searchParams.get('status') || ''
      state.requests.push({ kind, limit, offset: requested, search, status })
      const rows = state.rows.filter(row => (!search || (row.full_name + row.email).toLowerCase().includes(search.toLowerCase())) &&
        (kind !== 'pending' || (row.verification_status === 'PENDING_VERIFICATION' && row.status === 'ACTIVE')) &&
        (!status || (status === 'VERIFIED' ? row.verification_status === 'VERIFIED' && row.status === 'ACTIVE' : status === 'PENDING_VERIFICATION' ? row.verification_status === status && row.status === 'ACTIVE' : row.status === status)))
      const offset = requested >= rows.length ? Math.max(0, Math.floor((rows.length - 1) / limit) * limit) : requested
      const body = state.failList ? { detail: 'Synthetic clinician list unavailable.' } : state.invalidList ? { doctors: 'invalid' } : JSON.parse(JSON.stringify({ doctors: rows.slice(offset, offset + limit), total: rows.length, limit, offset, has_next: offset + limit < rows.length, has_previous: offset > 0, can_review: state.canReview, status_options: options }))
      const statusCode = state.failList ? 503 : 200
      let delivered: (() => void) | undefined
      if (state.holdRead && kind === 'all') { state.holdRead = false; state.readStarted = true; state.readDelivered = new Promise<void>(resolve => { delivered = resolve }); await new Promise<void>(resolve => { state.releaseRead = resolve }) }
      try { return await route.fulfill({ status: statusCode, headers: { 'X-Request-ID': readReference }, json: body }) } finally { delivered?.() }
    }
    const match = path.match(/^\/api\/v1\/admin\/doctors\/([^/]+)\/(verification|verify|status)$/)
    if (match) {
      const row = state.rows.find(item => item.provider_id === match[1])
      if (!row) return route.fulfill({ status: 404, json: { detail: 'Synthetic clinician unavailable.' } })
      if (match[2] === 'verification') {
        const body = JSON.parse(JSON.stringify({ ...row, can_review: state.canReview })), failed = state.failDetail
        let delivered: (() => void) | undefined
        if (state.holdDetail) { state.holdDetail = false; state.detailStarted = true; state.detailDelivered = new Promise<void>(resolve => { delivered = resolve }); await new Promise<void>(resolve => { state.releaseDetail = resolve }) }
        try { return await route.fulfill({ status: failed ? 503 : 200, headers: { 'X-Request-ID': readReference }, json: failed ? { detail: 'Synthetic verification details unavailable.' } : body }) } finally { delivered?.() }
      }
      expect(request.method()).toBe('PUT')
      state.writes.push({ provider: row.provider_id, body: request.postDataJSON() })
      let delivered: (() => void) | undefined
      if (state.holdWrite) { state.holdWrite = false; state.writeStarted = true; state.writeDelivered = new Promise<void>(resolve => { delivered = resolve }); await new Promise<void>(resolve => { state.releaseWrite = resolve }) }
      try {
        if (state.failWrite || !state.canReview) return await route.fulfill({ status: state.canReview ? 503 : 403, headers: { 'X-Request-ID': writeReference }, json: { detail: 'Synthetic clinician decision could not be confirmed.' } })
        const body = request.postDataJSON()
        if (body.approve) { row.verification_status = 'VERIFIED'; row.clinical_access = { status: 'enabled', reason: 'approved', message: 'Clinical access is enabled.' } }
        if (body.status) row.status = body.status
        return await route.fulfill({ json: { message: 'Synthetic decision saved.' } })
      } finally { delivered?.() }
    }
    if (path.endsWith('/admin/patients')) return route.fulfill({ json: { patients: [], total_count: 0, filtered_count: 0, page: 1, page_size: 25, has_next: false, has_previous: false } })
    if (path.endsWith('/patient/dashboard')) return route.fulfill({ json: { summary_cards: [], notifications: [], timeline_items: [], care_plans: [], medications: [] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture.' } })
  })
  await page.goto('/admin/doctors')
  await expect(roster(page).getByRole('button', { name: `All Doctors (${count})`, exact: true })).toBeVisible()
  return state
}
async function fillReview(page: Page) { const dialog = page.getByRole('dialog', { name: 'Clinician review' }); await dialog.getByLabel('Review reference or reason (Required)').fill('Synthetic review evidence reference 2026'); await dialog.getByRole('checkbox').check(); return dialog }

test('all clinicians and pending queues reach beyond fifty with independent pages and real totals', async ({ page, context }) => {
  const state = await prepare(context, page)
  await expect(roster(page).getByRole('article')).toHaveCount(25)
  await roster(page).getByRole('button', { name: 'Next clinicians', exact: true }).click(); await expect(position(page)).toContainText('Page 2')
  await expect(roster(page).getByRole('article').first()).toHaveAccessibleName('Synthetic Clinician 026')
  await roster(page).getByRole('button', { name: 'Next clinicians', exact: true }).click(); await expect(position(page)).toContainText('Page 3')
  await expect(roster(page).getByRole('article')).toHaveCount(13)
  await roster(page).getByRole('button', { name: 'Pending Verification (63)', exact: true }).click(); await expect(position(page)).toContainText('Page 1')
  await roster(page).getByRole('button', { name: 'Next pending verifications', exact: true }).click(); await expect(position(page)).toContainText('Page 2')
  await roster(page).getByRole('button', { name: 'All Doctors (63)', exact: true }).click(); await expect(position(page)).toContainText('Page 3')
  await roster(page).getByLabel('Clinicians per page').selectOption('50'); await expect(roster(page).getByRole('article')).toHaveCount(50)
  await expect(position(page)).toContainText('Page 1'); expect(state.requests.some(item => item.offset === 50)).toBe(true)
})

test('trimmed search resets both queues and canonical status filters reset the all-clinician page', async ({ page, context }) => {
  const state = await prepare(context, page)
  await roster(page).getByRole('button', { name: 'Next clinicians', exact: true }).click(); await expect(position(page)).toContainText('Page 2')
  await roster(page).getByLabel('Search clinicians').fill('  Clinician 063  ')
  await expect(roster(page).getByRole('button', { name: 'All Doctors (1)', exact: true })).toBeVisible()
  await expect(position(page)).toContainText('Page 1'); expect(state.requests.filter(item => item.search).every(item => item.search === 'Clinician 063' && item.offset === 0)).toBe(true)
  await roster(page).getByLabel('Search clinicians').fill('')
  await expect(roster(page).getByRole('button', { name: 'All Doctors (63)', exact: true })).toBeVisible()
  state.rows[0].status = 'SUSPENDED'
  await roster(page).getByLabel('Filter clinicians by status').selectOption('SUSPENDED')
  await expect(roster(page).getByRole('button', { name: 'All Doctors (1)', exact: true })).toBeVisible()
  await expect(roster(page).getByRole('article')).toHaveAccessibleName('Synthetic Clinician 001')
  await expect(position(page)).toContainText('Page 1')
})

test('reviewing the final pending page refreshes both queues and adopts the clamped last page', async ({ page, context }) => {
  const state = await prepare(context, page, 26)
  await roster(page).getByRole('button', { name: 'Pending Verification (26)', exact: true }).click()
  await roster(page).getByRole('button', { name: 'Next pending verifications', exact: true }).click()
  await expect(roster(page).getByRole('article')).toHaveCount(1)
  await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = await fillReview(page); await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog).toHaveCount(0); await expect(roster(page).getByRole('button', { name: 'Pending Verification (25)', exact: true })).toBeVisible()
  await expect(position(page)).toContainText('Page 1'); await expect(roster(page).getByRole('article')).toHaveCount(25)
  expect(state.writes).toHaveLength(1); expect(state.writes[0].provider).toBe(clinician(26).provider_id)
  await expect(roster(page).getByRole('button', { name: 'All Doctors (26)', exact: true })).toBeVisible()
})

test('list and detail failures retry the failed operation with safe support references', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.failList = true
  await roster(page).getByRole('button', { name: 'Refresh clinician lists' }).click()
  await expect(roster(page).getByRole('alert')).toContainText('Synthetic clinician list unavailable.')
  await expect(roster(page).getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(readReference)
  state.failList = false; await roster(page).getByRole('button', { name: 'Retry clinician list' }).click()
  await expect(roster(page).getByRole('article')).toHaveCount(1)
  state.failDetail = true; await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clinician review' })
  await expect(dialog.getByRole('alert')).toContainText('Synthetic verification details unavailable.')
  state.failDetail = false; await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(dialog.getByText('SYNTHETIC-LICENCE', { exact: true })).toBeVisible()
})

test('read-only administrators have view access without misleading Verify or save controls', async ({ page, context }) => {
  await prepare(context, page, 1, false)
  await roster(page).getByRole('button', { name: 'Pending Verification (1)', exact: true }).click()
  await expect(roster(page).getByRole('button', { name: 'Verify', exact: true })).toHaveCount(0)
  await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clinician review' })
  await expect(dialog.getByRole('button', { name: 'Save decision', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText('operations administrator access is required')
})

test('a failed decision stays visible, refreshes authority and is never retried automatically', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.failWrite = true
  await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = await fillReview(page); await dialog.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Synthetic clinician decision could not be confirmed.')
  await expect(dialog.getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(writeReference)
  await expect(dialog.getByRole('checkbox')).not.toBeChecked(); expect(state.writes).toHaveLength(1)
})

test('same-tick submission sends one selected decision and keeps in-flight dismissal disabled', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.holdWrite = true
  await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = await fillReview(page)
  await dialog.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit() })
  await expect.poll(() => state.writeStarted).toBe(true); expect(state.writes).toHaveLength(1)
  await expect(dialog.getByRole('button', { name: 'Close clinician review' })).toBeDisabled()
  state.releaseWrite(); await state.writeDelivered; await expect(dialog).toHaveCount(0)
})

test('late list data cannot replace the other queue after a tab change', async ({ page, context }) => {
  const state = await prepare(context, page); state.holdRead = true
  await roster(page).getByRole('button', { name: 'Next clinicians', exact: true }).click(); await expect.poll(() => state.readStarted).toBe(true)
  await roster(page).getByRole('button', { name: 'Pending Verification (63)', exact: true }).click()
  await expect(roster(page).getByRole('article').first()).toHaveAccessibleName('Synthetic Clinician 001')
  state.releaseRead(); await state.readDelivered
  await expect(position(page)).toContainText('Page 1'); await expect(roster(page).getByRole('article').first()).toHaveAccessibleName('Synthetic Clinician 001')
})

test('late clinician details cannot reopen after an account change', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.holdDetail = true
  await roster(page).getByRole('button', { name: 'View', exact: true }).click(); await expect.poll(() => state.detailStarted).toBe(true)
  state.identity = { ...state.identity, user_id: 'synthetic-other-admin', session_id: 'synthetic-other-session' }; state.rows = [clinician(99)]
  await page.evaluate(identity => { const key = 'qarevo:admin:identity', value = JSON.stringify(identity); localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }, state.identity)
  // A cross-tab identity change deliberately requires a new portal entry;
  // it must never adopt another account inside the already-open private view.
  await expect(page).toHaveURL(/\/auth\/admin\/login(?:\?|$)/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  state.releaseDetail(); await state.detailDelivered
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText('Synthetic Clinician 001', { exact: true })).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null')?.session_id)).toBe(state.patient.session_id)
  // Explicit entry revalidates the new synthetic session before its rows render.
  await page.goto('/admin/doctors')
  await expect(roster(page).getByRole('article')).toHaveAccessibleName('Synthetic Clinician 099')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const change of ['actor', 'route', 'portal'] as const) test('late decision cannot affect a changed ' + change + ' or sign out the patient portal', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.holdWrite = true; state.failWrite = true
  await roster(page).getByRole('button', { name: 'View', exact: true }).click(); const dialog = await fillReview(page)
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click(); await expect.poll(() => state.writeStarted).toBe(true)
  if (change === 'route') await page.goto('/admin/patients')
  else if (change === 'portal') await page.goto('/patient/dashboard')
  else { state.identity = { ...state.identity, user_id: 'synthetic-second-admin', session_id: 'synthetic-second-session' }; await page.evaluate(identity => { const key = 'qarevo:admin:identity', value = JSON.stringify(identity); localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value })) }, state.identity) }
  await expect(page.getByRole('dialog', { name: 'Clinician review' })).toHaveCount(0)
  state.canReview = false; state.releaseWrite(); await state.writeDelivered
  await expect(page.getByText('Synthetic clinician decision could not be confirmed.', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null')?.session_id)).toBe(state.patient.session_id)
  expect(state.writes).toHaveLength(1)
})

test('revoked decision permission aborts the stale continuation and leaves an inspectable read-only dialog', async ({ page, context }) => {
  const state = await prepare(context, page, 1); state.holdWrite = true
  await roster(page).getByRole('button', { name: 'View', exact: true }).click(); const dialog = await fillReview(page)
  await dialog.getByRole('button', { name: 'Save decision', exact: true }).click(); await expect.poll(() => state.writeStarted).toBe(true)
  state.canReview = false; await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  // A roster permission change may close the old modal; reopening always reads current authority.
  await expect(dialog).toHaveCount(0); state.releaseWrite(); await state.writeDelivered
  await roster(page).getByRole('button', { name: 'View', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save decision', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Close clinician review' })).toBeEnabled()
  expect(state.writes).toHaveLength(1)
})

for (const width of [320, 820, 1440]) test('roster pagination and review support keyboard and both themes at ' + width + 'px', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await prepare(context, page, 26)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Dark mode' : 'Light mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await roster(page).evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))) })
    const next = roster(page).getByRole('button', { name: 'Next clinicians', exact: true }); await next.focus(); await expectEnabledControlContrast(next); await page.keyboard.press('Enter')
    await expect(position(page)).toContainText('Page 2'); await expect(position(page)).toBeFocused()
    const view = roster(page).getByRole('button', { name: 'View', exact: true }); await view.focus(); await expectEnabledControlContrast(view); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Clinician review' }); await expect(dialog.getByLabel('Decision (Required)')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`clinician-roster-${width}-${theme}.png`), fullPage: true })
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
    await expect(roster(page).getByRole('button', { name: 'Previous clinicians', exact: true })).toBeEnabled()
    await roster(page).getByRole('button', { name: 'Previous clinicians', exact: true }).click(); await expect(position(page)).toContainText('Page 1')
  }
})

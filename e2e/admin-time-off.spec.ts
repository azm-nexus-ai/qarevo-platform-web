import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

test.use({ timezoneId: 'Europe/Berlin' })
const provider = '22222222-2222-4222-8222-222222222222'
const reference = 'a2222222-2222-4222-8222-222222222222'
const absenceId = (index: number) => `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`
const absence = (index = 1) => ({ id: absenceId(index), provider_id: provider, start_datetime: '2030-07-10T07:00:00+00:00', end_datetime: '2030-07-10T08:00:00+00:00', reason: `Synthetic absence ${index}`, status: 'PENDING' })
const panel = (page: Page) => page.getByRole('region', { name: 'Clinician absences', exact: true })

async function prepare(page: Page, context: BrowserContext, canManage = true) {
  const identity = await seedPortalSession(context, 'admin')
  const state = { identity, canManage, records: [] as ReturnType<typeof absence>[], writes: [] as { path: string; body: Record<string, unknown> }[], reads: [] as number[],
    conflict: false, failRead: false, holdWrite: false, started: false, lostAck: false, foreignReceipt: false, release: () => {} }
  const clinician = { id: provider, provider_id: provider, user_id: 'synthetic-clinician', full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', email_verified: true,
    phone: null, specialty: 'General Practice', license_number: 'SYNTHETIC', license_verified: false, status: 'ACTIVE', verification_status: 'PENDING_VERIFICATION',
    clinical_access: { status: 'blocked', reason: 'approval_required', message: 'Administrator review and approval are required before clinical access.' } }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(state.identity) })
    if (path === `/api/v1/admin/doctors/${provider}/verification`) return route.fulfill({ json: { ...clinician, can_review: state.canManage } })
    if (path === '/api/v1/admin/doctors' || path === '/api/v1/admin/doctors/pending/page') return route.fulfill({ json: { doctors: [clinician], total: 1, limit: Number(url.searchParams.get('limit') || 50), offset: 0, has_next: false, has_previous: false, can_review: state.canManage, status_options: [{ value: 'ACTIVE', label: 'Active' }] } })
    if (path === `/api/v1/admin/doctors/${provider}/time-off` && request.method() === 'GET') {
      const offset = Number(url.searchParams.get('offset') || 0), status = url.searchParams.get('status')
      state.reads.push(offset)
      if (state.failRead) return route.fulfill({ status: 503, headers: { 'X-Request-ID': reference }, json: { detail: 'Synthetic absence list unavailable.' } })
      const rows = state.records.filter(row => !status || row.status === status)
      return route.fulfill({ json: { total: rows.length, limit: 25, offset, can_manage: state.canManage, time_off: rows.slice(offset, offset + 25) } })
    }
    if ((path === `/api/v1/admin/doctors/${provider}/time-off` && request.method() === 'POST') || path.startsWith('/api/v1/admin/time-off/')) {
      expect(request.headers()['x-qarevo-portal']).toBe('admin')
      const body = request.postDataJSON() || {}; state.writes.push({ path, body })
      const kind = path.endsWith('/time-off') ? 'create' : path.split('/').at(-1)
      const selected = state.records.find(row => path.includes(row.id))
      let receipt: ReturnType<typeof absence> | undefined
      if (kind === 'create') {
        receipt = state.records.find(row => row.status === 'PENDING' && Date.parse(row.start_datetime) === Date.parse(String(body.start_datetime)) && Date.parse(row.end_datetime) === Date.parse(String(body.end_datetime)) && row.reason === (body.reason || null))
        if (!receipt) { receipt = { ...absence(state.records.length + 1), start_datetime: String(body.start_datetime), end_datetime: String(body.end_datetime), reason: body.reason as string }; state.records.push(receipt) }
      } else if (selected && !(kind === 'approve' && state.conflict)) {
        selected.status = { approve: 'APPROVED', reject: 'REJECTED', cancel: 'CANCELLED' }[kind as 'approve'] || selected.status
        receipt = { ...selected }
      }
      const failed = kind === 'approve' && state.conflict, lost = state.lostAck, foreign = state.foreignReceipt
      if (state.holdWrite) { state.started = true; await new Promise<void>(resolve => { state.release = resolve }) }
      try {
        if (failed) return await route.fulfill({ status: 409, headers: { 'X-Request-ID': reference }, json: { detail: { error_code: 'TIME_OFF_APPOINTMENT_CONFLICT', message: 'Resolve 1 existing appointment before approving this absence.', conflict_count: 1 } } })
        if (lost) return await route.fulfill({ status: 503, headers: { 'X-Request-ID': reference }, json: { detail: 'The absence response was lost. Review its current state.' } })
        return await route.fulfill({ json: foreign ? { ...receipt, provider_id: '33333333-3333-4333-8333-333333333333' } : receipt })
      } catch { return }
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  await page.goto('/admin/doctors')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Clinician review' })).toBeVisible()
  return state
}

async function expand(page: Page) {
  await panel(page).getByRole('button', { name: 'Show clinician absences' }).click()
  await expect(panel(page).getByRole('button', { name: 'Refresh absences' })).toBeEnabled()
}
async function fillRequest(page: Page) {
  await panel(page).getByLabel(/^Absence starts/).fill('2030-07-10T09:00')
  await panel(page).getByLabel(/^Absence ends/).fill('2030-07-10T10:00')
  await panel(page).getByLabel(/^Absence reason/).fill('Synthetic scheduled absence')
}

test('absence request, conflict recovery, explicit approval and cancellation preserve truthful status', async ({ page, context }) => {
  const state = await prepare(page, context)
  expect(state.reads).toHaveLength(0)
  await expand(page)
  await panel(page).getByRole('button', { name: 'Save absence request' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('complete date and time')
  expect(state.writes).toHaveLength(0)
  await fillRequest(page)
  await expect(panel(page).getByText(/UTC interval/)).toContainText('2030-07-10T07:00:00.000Z')
  await panel(page).getByRole('button', { name: 'Save absence request' }).click()
  await expect(panel(page).getByText('The absence request is saved and pending approval.', { exact: true })).toBeVisible()
  expect(state.writes[0].body).toEqual({ start_datetime: '2030-07-10T07:00:00.000Z', end_datetime: '2030-07-10T08:00:00.000Z', reason: 'Synthetic scheduled absence' })
  state.conflict = true
  await panel(page).getByRole('button', { name: 'Approve absence', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Confirm absence decision' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('Confirm that you have reviewed')
  expect(state.writes).toHaveLength(1)
  await panel(page).getByRole('checkbox').check()
  await panel(page).getByRole('button', { name: 'Confirm absence decision' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('Resolve 1 existing appointment')
  await expect(panel(page).getByRole('textbox', { name: 'Support reference', exact: true })).toHaveValue(reference)
  expect(state.records[0].status).toBe('PENDING')
  await panel(page).getByRole('button', { name: 'Continue after reviewing absences' }).click()
  state.conflict = false
  await panel(page).getByRole('button', { name: 'Approve absence', exact: true }).click()
  await panel(page).getByRole('checkbox').check()
  await panel(page).getByRole('button', { name: 'Confirm absence decision' }).click()
  await expect(panel(page).getByText('The absence is approved. Existing appointments were not cancelled.', { exact: true })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Cancel absence', exact: true }).click()
  await panel(page).getByRole('checkbox').check()
  await panel(page).getByRole('button', { name: 'Confirm absence decision' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('4–500')
  await panel(page).getByLabel(/^Reason \(Required\)/).fill('Synthetic correction')
  await panel(page).getByRole('button', { name: 'Confirm absence decision' }).click()
  await expect(panel(page).getByRole('article', { name: `Absence ${absenceId(1)}`, exact: true }).getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Cancel absence', exact: true })).toHaveCount(0)
  expect(state.records[0].status).toBe('CANCELLED')
  expect(state.writes.map(item => item.path.split('/').at(-1))).toEqual(['time-off', 'approve', 'approve', 'cancel'])
})

test('read-only absence pages recover errors and remain usable on a narrow dark viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await context.addInitScript(() => localStorage.setItem('qarevo:admin:theme', 'dark'))
  const state = await prepare(page, context, false)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  state.records = Array.from({ length: 26 }, (_, index) => absence(index + 1))
  await expand(page)
  await expect(panel(page).getByText(/26 absences/)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Save absence request' })).toHaveCount(0)
  await panel(page).getByRole('button', { name: 'Next absences', exact: true }).click()
  await expect(panel(page).getByRole('article')).toHaveCount(1)
  await expect(panel(page).getByRole('article')).toHaveAttribute('aria-label', `Absence ${absenceId(26)}`)
  state.failRead = true
  await panel(page).getByRole('button', { name: 'Refresh absences' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('Synthetic absence list unavailable')
  state.failRead = false
  await panel(page).getByRole('button', { name: 'Refresh absences' }).click()
  await expect(panel(page).getByRole('article')).toHaveCount(1)
  await panel(page).getByRole('combobox', { name: 'Absence status' }).selectOption('CANCELLED')
  await expect(panel(page).getByText('No absences match this filter.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(state.writes).toEqual([])
})

test('uncertain creation never silently repeats and exposes the saved row for reconciliation', async ({ page, context }) => {
  const state = await prepare(page, context)
  await expand(page); await fillRequest(page)
  state.holdWrite = true; state.lostAck = true
  await panel(page).getByRole('button', { name: 'Save absence request' }).click()
  await expect.poll(() => state.started).toBe(true)
  const submitting = panel(page).getByRole('button', { name: 'Saving absence…', exact: true })
  await expect(submitting).toBeDisabled()
  // A second submit intent must also be rejected by the handler, independent
  // of the button's disabled state (for example rapid keyboard submission).
  await submitting.evaluate(button => button.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(state.writes).toHaveLength(1)
  state.release()
  await expect(panel(page).getByRole('alert')).toContainText('response was lost')
  await expect(panel(page).getByRole('article')).toHaveCount(1)
  await expect(panel(page).getByRole('button', { name: 'Save absence request' })).toHaveCount(0)
  await expect(panel(page).getByRole('button', { name: 'Continue after reviewing absences' })).toBeEnabled()
  expect(state.writes).toHaveLength(1)
})

test('a changed admin cannot receive an earlier absence acknowledgement or draft', async ({ page, context }) => {
  const state = await prepare(page, context)
  await expand(page); await fillRequest(page)
  state.holdWrite = true
  await panel(page).getByRole('button', { name: 'Save absence request' }).click()
  await expect.poll(() => state.started).toBe(true)
  state.identity = { ...state.identity, user_id: 'another-synthetic-admin', session_id: 'another-synthetic-session' }
  await page.evaluate(identity => { localStorage.setItem('qarevo:admin:identity', JSON.stringify(identity)); window.dispatchEvent(new Event('qarevo:account-changed')) }, state.identity)
  state.release()
  await expect(page.getByRole('dialog', { name: 'Clinician review' })).toHaveCount(0)
  await expect(page.getByText('The absence request is saved and pending approval.', { exact: true })).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
})

test('a receipt for another clinician is never presented as a confirmed request', async ({ page, context }) => {
  const state = await prepare(page, context)
  await expand(page); await fillRequest(page)
  state.foreignReceipt = true
  await panel(page).getByRole('button', { name: 'Save absence request' }).click()
  await expect(panel(page).getByRole('alert')).toContainText('saved absence could not be confirmed')
  await expect(panel(page).getByText('The absence request is saved and pending approval.', { exact: true })).toHaveCount(0)
  await expect(panel(page).getByRole('button', { name: 'Continue after reviewing absences' })).toBeEnabled()
})

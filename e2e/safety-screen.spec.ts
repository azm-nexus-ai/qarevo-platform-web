import { expect, test, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

// All content here is synthetic test copy, not clinical guidance.
const versionId = '5afe5afe-0000-4000-8000-000000000001'
const sha = 'a'.repeat(64)
const screen = {
  available: true, required: true, version_id: versionId, version_number: 3, locale: 'en', title: 'Synthetic safety questions',
  intro: 'Synthetic introduction', continue_message: null,
  questions: [
    { id: 'synthetic-emergency', prompt: 'Synthetic emergency question?', help: 'Synthetic help' },
    { id: 'synthetic-in-person', prompt: 'Synthetic in-person question?', help: null },
  ],
  outcomes: {},
}
const emergency = { title: 'Synthetic emergency heading', body: 'Synthetic emergency guidance', action_label: 'Call 112', action_href: 'tel:112' }

type Patient = { status: Record<string, unknown>; screen: Record<string, unknown>; answers: Record<string, boolean>[]; outcome: 'EMERGENCY' | 'CONTINUE'; statusReads: number }

async function preparePatient(context: BrowserContext, overrides: Partial<Patient> = {}) {
  const identity = await seedPortalSession(context, 'patient', { user_id: 'synthetic-patient' })
  const state: Patient = { status: { available: true, required: true, passed: false, valid_until: null }, screen, answers: [], outcome: 'CONTINUE', statusReads: 0, ...overrides }
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === '/api/v1/patient/safety-screen/status') { state.statusReads++; return route.fulfill({ json: state.status }) }
    if (path === '/api/v1/patient/safety-screen') return route.fulfill({ json: state.screen })
    if (path === '/api/v1/patient/safety-screen/responses') {
      const body = request.postDataJSON()
      expect(body.version_id).toBe(versionId)
      state.answers.push(body.answers)
      const stop = state.outcome === 'EMERGENCY'
      // Like the API, a passing response makes the status report a recent pass.
      if (!stop) state.status = { ...state.status, passed: true, valid_until: new Date(Date.now() + 7_200_000).toISOString() }
      return route.fulfill({ status: 201, json: { response_id: 'synthetic-response', outcome: state.outcome, allows_booking: !stop, guidance: stop ? emergency : null, continue_message: null, valid_until: stop ? null : new Date(Date.now() + 7_200_000).toISOString() } })
    }
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}

test('choosing a time first routes the patient through the safety questions', async ({ page, context }) => {
  await preparePatient(context)
  await page.goto('/patient/consultation-booking/date-time?physicianId=synthetic-doctor&service=video')
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/safety\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe('/patient/consultation-booking/date-time?physicianId=synthetic-doctor&service=video')
  await expect(page.getByRole('heading', { name: 'A few safety questions', exact: true })).toBeVisible()
  await expect(page.getByText('In an emergency, call 112 now.')).toBeVisible()
})

test('a patient who has passed the screen is not redirected again', async ({ page, context }) => {
  const state = await preparePatient(context, { status: { available: true, required: true, passed: true, valid_until: new Date(Date.now() + 3_600_000).toISOString() } })
  await page.goto('/patient/consultation-booking/date-time?physicianId=synthetic-doctor&service=video')
  await expect.poll(() => state.statusReads).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/date-time\?physicianId=synthetic-doctor/)
})

test('every question needs an answer and the open count is announced', async ({ page, context }) => {
  const state = await preparePatient(context)
  await page.goto('/patient/consultation-booking/safety')
  await page.getByRole('group', { name: /Synthetic emergency question/ }).getByLabel('No', { exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const summary = page.getByRole('alert').filter({ hasText: 'still open' })
  await expect(summary).toContainText('1 question is still open')
  await expect(summary).toBeFocused()
  expect(state.answers).toHaveLength(0)
})

test('a red-flag answer stops online booking and offers the emergency call', async ({ page, context }) => {
  const state = await preparePatient(context, { outcome: 'EMERGENCY' })
  await page.goto('/patient/consultation-booking/safety?next=%2Fpatient%2Fconsultation-booking%2Fdate-time%3FphysicianId%3Dsynthetic-doctor')
  await page.getByRole('group', { name: /Synthetic emergency question/ }).getByLabel('Yes', { exact: true }).check()
  await page.getByRole('group', { name: /Synthetic in-person question/ }).getByLabel('No', { exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const heading = page.getByRole('heading', { name: 'Synthetic emergency heading', exact: true })
  await expect(heading).toBeVisible()
  await expect(heading).toBeFocused()
  await expect(page.getByRole('link', { name: 'Call 112', exact: true })).toHaveAttribute('href', 'tel:112')
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/safety/)
  expect(state.answers).toEqual([{ 'synthetic-emergency': true, 'synthetic-in-person': false }])
})

test('all no answers continue to the booking step the patient came from', async ({ page, context }) => {
  const state = await preparePatient(context)
  await page.goto('/patient/consultation-booking/safety?next=%2Fpatient%2Fconsultation-booking%2Fdate-time%3FphysicianId%3Dsynthetic-doctor')
  for (const name of [/Synthetic emergency question/, /Synthetic in-person question/]) await page.getByRole('group', { name }).getByLabel('No', { exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/date-time\?physicianId=synthetic-doctor$/)
  expect(state.answers).toEqual([{ 'synthetic-emergency': false, 'synthetic-in-person': false }])
})

test('an outside continuation address is replaced by the booking start', async ({ page, context }) => {
  await preparePatient(context)
  await page.goto('/patient/consultation-booking/safety?next=https%3A%2F%2Fevil.example%2F')
  for (const name of [/Synthetic emergency question/, /Synthetic in-person question/]) await page.getByRole('group', { name }).getByLabel('No', { exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/date-time$/)
})

test('when a screen is required but none is published, booking pauses without a way around it', async ({ page, context }) => {
  await preparePatient(context, { screen: { available: false, required: true } })
  await page.goto('/patient/consultation-booking/safety')
  await expect(page.getByRole('heading', { name: 'Online booking is paused', exact: true })).toBeVisible()
  await expect(page.getByText('If this is an emergency, call 112 now.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Continue/ })).toHaveCount(0)
})

for (const width of [320, 820]) test(`safety questions fit a ${width}px screen in both themes`, async ({ page, context }) => {
  await preparePatient(context)
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/patient/consultation-booking/safety')
  await expect(page.getByRole('group', { name: /Synthetic emergency question/ })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const box = await page.getByRole('group', { name: /Synthetic emergency question/ }).getByText('Yes', { exact: true }).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(0)
  }
})

// --- admin governance ---------------------------------------------------------------

const content = {
  intro: 'Synthetic introduction',
  questions: [{ id: 'synthetic-emergency', prompt: 'Synthetic emergency question?', help: null, route_if_yes: 'EMERGENCY' }],
  outcomes: { EMERGENCY: emergency },
  continue_message: null,
}
const summary = {
  id: versionId, version_number: 3, locale: 'en', status: 'DRAFT', title: 'Synthetic safety questions', content_sha256: sha, lock_version: 2,
  question_count: 1, change_note: 'Synthetic change note', based_on_version_id: null,
  created_by: 'Synthetic Author', created_at: '2030-06-10T08:00:00Z', updated_by: 'Synthetic Author', updated_at: '2030-06-10T08:05:00Z',
  approved_by: null, approved_at: null, published_by: null, published_at: null, retired_by: null, retired_at: null,
}

async function prepareAdmin(context: BrowserContext, canApprove: boolean) {
  const identity = await seedPortalSession(context, 'admin')
  const approvals: Record<string, unknown>[] = []
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    const base = '/api/v1/admin/clinical-safety'
    if (path === `${base}/me`) return route.fulfill({ json: { permissions: canApprove ? ['APPROVE'] : ['AUTHOR'], can_manage_permissions: false, booking_requires_screen: true } })
    if (path === `${base}/versions`) return route.fulfill({ json: { versions: [summary] } })
    if (path === `${base}/grants`) return route.fulfill({ json: { grants: [] } })
    if (path === `${base}/versions/${versionId}`) return route.fulfill({ json: { ...summary, content, approved_sha256: null, audit: [{ action: 'CREATE_SAFETY_SCREEN_DRAFT', by: 'Synthetic Author', at: '2030-06-10T08:00:00Z', changes: null, reason: null }], can: { edit: !canApprove, approve: canApprove, publish: false, retire: !canApprove } } })
    if (path === `${base}/versions/${versionId}/approve`) {
      expect(request.headers()['x-qarevo-portal']).toBe('admin')
      approvals.push(request.postDataJSON())
      return route.fulfill({ json: { ...summary, status: 'APPROVED', content, approved_sha256: sha, audit: [], can: { edit: false, approve: false, publish: true, retire: true } } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return approvals
}

test('the author of a draft sees why they cannot approve it', async ({ page, context }) => {
  await prepareAdmin(context, false)
  await page.goto('/admin/clinical-safety')
  await page.getByRole('button', { name: 'Open version 3', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'What patients see', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve this version' })).toHaveCount(0)
  await expect(page.getByText(/Approval needs a different administrator/)).toBeVisible()
})

test('an approver confirms the review and approves exactly the fingerprinted content', async ({ page, context }) => {
  const approvals = await prepareAdmin(context, true)
  await page.goto('/admin/clinical-safety')
  await page.getByRole('button', { name: 'Open version 3', exact: true }).click()
  const approve = page.getByRole('button', { name: 'Approve this version', exact: true })
  await expect(approve).toBeDisabled()
  await page.getByLabel(/I have reviewed every question/).check()
  await page.getByLabel('Approval note (optional)').fill('Synthetic approval note')
  await approve.click()
  await expect(page.getByText('Approved. It goes live only when published.')).toBeVisible()
  expect(approvals).toEqual([{ lock_version: 2, content_sha256: sha, note: 'Synthetic approval note' }])
})

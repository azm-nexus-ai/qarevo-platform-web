import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const first = '66666666-6666-4666-8666-666666666666'
const second = '99999999-9999-4999-8999-999999999999'
function published(id = first, revision = 1) {
  return { id: '77777777-7777-4777-8777-777777777777', episode_id: '88888888-8888-4888-8888-888888888888', consultation_id: id,
    revision, version: revision + 1, language: 'en', summary: `Synthetic consultation ${revision}`, history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: `Synthetic plan ${revision}`, safety_net: 'Synthetic follow-up advice',
    authored_by: 'synthetic-clinician', approved_by: 'synthetic-clinician', published_at: '2030-07-10T08:00:00Z', created_at: '2030-07-10T07:45:00Z', updated_at: '2030-07-10T08:00:00Z', amendment_reason: revision > 1 ? 'Synthetic clinician correction' : null }
}
function catalog(id = first, overrides: Record<string, unknown> = {}) {
  return { id: `consultation-summary-${id}`, type: 'Consultation', title: id === first ? 'Consultation summary: Synthetic Alpha' : 'Consultation summary: Synthetic Beta', provider: 'Synthetic Clinician', specialty: 'General medicine', date: 'Jul 10, 2030', lastUpdated: 'Jul 10, 2030', status: 'Available', sourceType: 'consultation-summary', sourceId: id, sourceHref: 'https://untrusted.invalid/unsafe', clinicalStatus: 'Published', revision: 1, publishedAt: '2030-07-10T08:00:00Z', canPreview: false, canDownload: false, canDelete: false, ...overrides }
}
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const control = { identity, records: [catalog()] as Record<string, unknown>[], summaries: new Map<string, unknown>([[first, published()], [second, published(second)]]), status: 200, reads: 0, holdNext: false, started: false, heldRequest: null as Request | null, release: () => {} }
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(control.identity) })
    if (path.endsWith('/patient/medical-records')) return route.fulfill({ json: { records: control.records, timeline: [] } })
    if (path.endsWith('/patient/consultation-summary')) {
      control.reads++
      const status = control.status, body = status === 200 ? control.summaries.get(url.searchParams.get('consultation_id') || '') : { detail: status === 404 ? 'Not published' : 'Synthetic clinical service temporarily unavailable' }
      if (control.holdNext) {
        control.holdNext = false; control.started = true; control.heldRequest = route.request()
        await new Promise<void>(resolve => { control.release = resolve })
      }
      return route.fulfill({ status, json: body ?? { detail: 'No synthetic summary' } })
    }
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: { blood_type: '', allergies: '', medical_conditions: '' } })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return control
}
const summaryPath = (id = first) => `/patient/consultation-summary?consultationId=${id}`

test('medical records link published metadata to the owned summary without exposing clinical text or arbitrary links', async ({ page, context }) => {
  const state = await prepare(context)
  state.records = [catalog(first, { summary: 'Synthetic catalog clinical text must stay private', clinicalNotes: 'Synthetic draft must stay private', canDownload: true, canPreview: true, canDelete: true }), catalog(second, { clinicalStatus: 'Draft', title: 'Synthetic unpublished draft title' })]
  await page.goto('/patient/medical-records')
  const card = page.locator('[data-medical-record-id]').filter({ has: page.getByRole('heading', { name: 'Consultation summary: Synthetic Alpha', exact: true }) })
  await expect(card.getByRole('link', { name: 'View consultation summary', exact: true })).toHaveAttribute('href', summaryPath())
  await expect(page.getByText('Synthetic unpublished draft title', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Synthetic catalog clinical text must stay private', { exact: true })).toHaveCount(0)
  await expect(card.getByRole('button', { name: /Download|Preview|Delete/ })).toHaveCount(0)
  await card.getByRole('button', { name: 'View Details', exact: true }).click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByRole('heading', { name: 'Published consultation record', exact: true })).toBeVisible()
  await expect(detail.getByText('Synthetic draft must stay private', { exact: true })).toHaveCount(0)
  await detail.getByRole('link', { name: 'View consultation summary', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Published consultation summary', exact: true })).toContainText('Synthetic consultation 1')
  await expect(page.locator('a[href^="https://untrusted.invalid"]')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic consultation 1')
})

test('manual and focus refresh show the latest published amendment and re-entry reloads it', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto(summaryPath())
  await expect(page.getByRole('article')).toContainText('Revision 1')
  state.summaries.set(first, { ...published(first, 2), language: 'de' })
  await page.getByRole('button', { name: 'Refresh summary', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('Revision 2')
  await expect(page.getByRole('article')).toContainText('German')
  await expect(page.getByRole('heading', { name: 'Amendment reason', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic clinician correction', { exact: true })).toBeVisible()
  state.summaries.set(first, published(first, 3))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('article')).toContainText('Revision 3')
  await page.getByRole('link', { name: 'Back to medical records', exact: true }).click()
  await page.getByRole('link', { name: 'View consultation summary', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('Revision 3')
  await page.reload()
  await expect(page.getByRole('article')).toContainText('Revision 3')
})

test('unpublished and malformed responses never render draft clinical content', async ({ page, context }) => {
  const state = await prepare(context); state.status = 404
  await page.goto(summaryPath())
  await expect(page.getByRole('heading', { name: 'No consultation summary available', exact: true })).toBeVisible()
  state.status = 200; state.summaries.set(first, { ...published(), approved_by: null, published_at: null, summary: 'Synthetic draft sentinel' })
  await page.getByRole('button', { name: 'Refresh summary', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'A published summary could not be confirmed' })).toBeVisible()
  await expect(page.getByText('Synthetic draft sentinel', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('summary errors show the real failure, retain navigation, and retry the failed request', async ({ page, context }) => {
  const state = await prepare(context); state.status = 503
  await page.goto(summaryPath())
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic clinical service temporarily unavailable' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to medical records', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View my appointments', exact: true })).toHaveAttribute('href', '/patient/appointments')
  state.status = 200
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('Synthetic plan 1')
  expect(state.reads).toBe(2)
})

test('a late summary response cannot cross a consultation route change', async ({ page, context }) => {
  const state = await prepare(context); state.records = [catalog(second)]; state.holdNext = true
  state.summaries.set(first, { ...published(), summary: 'Synthetic stale Alpha clinical text' })
  await page.goto(summaryPath())
  await expect.poll(() => state.started).toBe(true)
  await page.getByRole('link', { name: 'Back to medical records', exact: true }).click()
  await page.getByRole('link', { name: 'View consultation summary', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('Synthetic consultation 1')
  const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/patient/consultation-summary') && new URL(response.url()).searchParams.get('consultation_id') === first)
  state.release(); await lateResponse
  await expect(page.getByText('Synthetic stale Alpha clinical text', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('article')).toContainText('Synthetic plan 1')
})

test('an account change returns to patient sign-in and cannot revive its late summary', async ({ page, context }) => {
  const state = await prepare(context); state.holdNext = true
  state.summaries.set(first, { ...published(), summary: 'Synthetic prior account clinical text' })
  await page.goto(summaryPath())
  await expect.poll(() => state.started).toBe(true)
  const heldRequest = state.heldRequest!
  // Bind to this exact old request before navigation. Request.response() settles
  // to null if the sign-in navigation cancels it, otherwise wait for its body.
  const lateRequestSettled = heldRequest.response().then(async response => {
    if (response) { expect(response.status()).toBe(200); await response.finished() }
    else expect(heldRequest.failure()).not.toBeNull()
  })
  state.identity = { user_id: 'synthetic-new-patient', role: 'PATIENT', session_id: 'synthetic-new-session' }
  try {
    await page.evaluate(identity => {
      const key = 'qarevo:patient:identity', value = JSON.stringify(identity)
      localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
    }, state.identity)
    await expect(page).toHaveURL(/\/auth\/sign-in$/)
  } finally { state.release() }
  await lateRequestSettled
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  await expect(page.getByText('Synthetic prior account clinical text', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic prior account clinical text')
})

test('malformed or duplicate consultation ids are not fetched or reflected as navigation', async ({ page, context }) => {
  const state = await prepare(context)
  for (const query of ['consultationId=https%3A%2F%2Funtrusted.invalid%2Fprivate', `consultationId=${first}&consultationId=${second}`]) {
    await page.goto(`/patient/consultation-summary?${query}`)
    await expect(page.getByRole('heading', { name: 'This summary link is invalid', exact: true })).toBeVisible()
    await expect(page.locator('a[href^="https://untrusted.invalid"]')).toHaveCount(0)
  }
  expect(state.reads).toBe(0)
  state.records = [catalog(first, { sourceId: 'https://untrusted.invalid/private' })]
  await page.goto('/patient/medical-records')
  await expect(page.getByRole('link', { name: 'View consultation summary', exact: true })).toHaveCount(0)
  await expect(page.getByText('This summary link is unavailable. Refresh records or open your appointments.', { exact: true })).toBeVisible()
})

for (const width of [320, 820, 1440]) test(`published summary remains readable and keyboard-accessible in both themes at ${width}px`, async ({ page, context }) => {
  const state = await prepare(context)
  state.summaries.set(first, { ...published(first, 2), plan: 'Synthetic-' + 'x'.repeat(1500) })
  await page.setViewportSize({ width, height: 900 }); await page.goto(summaryPath())
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    await expect(page.getByRole('heading', { name: 'Clinician-approved consultation summary', exact: true })).toBeVisible()
    await expect(page.getByRole('article').getByText('Document language', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const refresh = page.getByRole('button', { name: 'Refresh summary', exact: true })
    await refresh.focus(); await expect(refresh).toBeFocused(); await page.keyboard.press('Enter')
    await expect(refresh).toBeEnabled()
    await page.getByRole('link', { name: 'Back to medical records', exact: true }).focus()
    await expect(page.getByRole('link', { name: 'Back to medical records', exact: true })).toBeFocused()
  }
})

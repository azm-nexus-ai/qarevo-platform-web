import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

test.use({ timezoneId: 'Europe/Berlin' })
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const control = { record: { id: 'synthetic-lab-request', title: 'Synthetic laboratory request', status: 'Pending', scheduled_for: '', selected_lab_name: '', selected_lab_address: '', home_collection: false } as Record<string, unknown>,
    extraRecords: [] as Record<string, unknown>[], writes: [] as string[], failNext: false, conflictNext: false, hold: false, release: () => {} }
  const payload = () => ({ test_requests: [control.record, ...control.extraRecords], partner_labs: [], preparation: [], recent_uploads: [], summary: { requested_tests: 1, pending_tests: 1, completed_tests: 0, upcoming_lab_appointment: control.record.scheduled_for || null, estimated_completion: null } })
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/lab-requests')) return route.fulfill({ json: payload() })
    if (path.endsWith('/patient/lab-requests/synthetic-lab-request/book')) {
      const body = route.request().postData() || ''
      control.writes.push(body)
      if (control.conflictNext) {
        control.conflictNext = false; control.record.status = 'Results Available'
        return route.fulfill({ status: 409, json: { detail: 'This lab request can no longer be planned or rescheduled here. Contact your care team; existing results and clinical progress are preserved.' } })
      }
      if (control.failNext) { control.failNext = false; return route.fulfill({ status: 503, json: { detail: 'Synthetic plan unavailable; retry saving.' } }) }
      if (control.hold) await new Promise<void>(resolve => { control.release = resolve })
      const field = (name: string) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1] || ''
      control.record = { ...control.record, status: 'Booked', scheduled_for: field('scheduled_for'), selected_lab_name: field('lab_name'), selected_lab_address: field('lab_address'), home_collection: field('home_collection') === 'true' }
      return route.fulfill({ json: payload() })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return control
}

test('patient-reported lab visits validate, retry safely and persist without claiming laboratory booking', async ({ page, context }) => {
  const control = await prepare(context); control.failNext = true
  await page.goto('/patient/lab-requests')
  await expect(page.getByText('Arrange the visit directly with the laboratory.', { exact: false })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save patient-reported visit', exact: true })
  await save.click()
  await expect(page.locator('#lab-plan-date-error')).toBeVisible()
  await expect(page.locator('#lab-plan-time-error')).toBeVisible()
  await expect(page.locator('#lab-plan-name-error')).toBeVisible()
  expect(control.writes).toHaveLength(0)
  await page.getByLabel('Date (required)', { exact: true }).fill('2026-11-10')
  await page.getByLabel('Time (required)', { exact: true }).fill('10:15')
  await page.getByLabel('Lab or centre name (required)', { exact: true }).fill('Synthetic arranged laboratory')
  await save.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic plan unavailable' })).toBeVisible()
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic arranged laboratory')
  control.hold = true
  await save.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => control.writes.length).toBe(2)
  await expect(page.getByLabel('Request (required)', { exact: true })).toBeDisabled()
  control.release()
  await expect(page.getByRole('status').filter({ hasText: 'Your patient-reported visit is saved.' })).toBeVisible()
  expect(control.writes[1]).toContain('2026-11-10T09:15:00.000Z')
  await page.reload()
  await expect(page.getByLabel('Date (required)', { exact: true })).toHaveValue('2026-11-10')
  await expect(page.getByLabel('Time (required)', { exact: true })).toHaveValue('10:15')
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic arranged laboratory')
  await expect(page.getByText('Patient-reported appointment', { exact: true }).first()).toBeVisible()
})

test('clinical progress and existing results prevent patient rescheduling', async ({ page, context }) => {
  const control = await prepare(context)
  for (const status of ['Completed', 'Results Available', 'Cancelled', 'Collected', 'Processing']) {
    control.record.status = status
    await page.goto('/patient/lab-requests')
    await expect(page.getByRole('button', { name: 'Save patient-reported visit', exact: true })).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: 'This lab request can no longer be planned' })).toBeVisible()
  }
  control.record.status = 'Pending'; control.record.result_file_id = 'synthetic-existing-result'
  await page.reload()
  await expect(page.getByRole('button', { name: 'Save patient-reported visit', exact: true })).toBeDisabled()
  expect(control.writes).toHaveLength(0)
})

test('mobile dark-mode lab planning is keyboard accessible and rejects nonexistent local times', async ({ page, context }) => {
  const control = await prepare(context)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/patient/lab-requests')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Date (required)', { exact: true }).fill('2026-03-29')
  await page.getByLabel('Time (required)', { exact: true }).fill('02:30')
  await page.getByLabel('Lab or centre name (required)', { exact: true }).fill('Synthetic arranged laboratory')
  const save = page.getByRole('button', { name: 'Save patient-reported visit', exact: true })
  await save.focus(); await expect(save).toBeFocused(); await page.keyboard.press('Enter')
  await expect(page.locator('#lab-plan-date-error')).toContainText('valid local date and time')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(control.writes).toHaveLength(0)
  await page.getByLabel('Date (required)', { exact: true }).fill('2026-11-10')
  await page.getByLabel('Time (required)', { exact: true }).fill('10:15')
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: 'Your patient-reported visit is saved.' })).toBeVisible()
  await expect(page.getByText('Patient-reported appointment', { exact: true }).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})


test('reloading lab requests keeps visit details associated with the selected request', async ({ page, context }) => {
  const control = await prepare(context)
  control.record.selected_lab_name = 'Synthetic Alpha laboratory'
  control.record.scheduled_for = '2026-11-10T09:15:00.000Z'
  control.extraRecords = [{ id: 'synthetic-second-request', title: 'Synthetic second laboratory request', status: 'Pending', selected_lab_name: 'Synthetic Beta laboratory', scheduled_for: '2026-11-12T13:45:00.000Z' }]
  await page.goto('/patient/lab-requests')
  const selector = page.getByLabel('Request (required)', { exact: true })
  await selector.selectOption('synthetic-second-request')
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic Beta laboratory')
  await page.getByRole('button', { name: 'Reload saved requests', exact: true }).click()
  await expect(selector).toHaveValue('synthetic-second-request')
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic Beta laboratory')
  await expect(page.getByLabel('Date (required)', { exact: true })).toHaveValue('2026-11-12')
  await expect(page.getByLabel('Time (required)', { exact: true })).toHaveValue('14:45')
  control.extraRecords = []
  await page.getByRole('button', { name: 'Reload saved requests', exact: true }).click()
  await expect(selector).toHaveValue('synthetic-lab-request')
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic Alpha laboratory')
  await expect(page.getByLabel('Date (required)', { exact: true })).toHaveValue('2026-11-10')
  expect(control.writes).toHaveLength(0)
})


test('a clinical-state conflict explains recovery without treating it as a session change', async ({ page, context }) => {
  const control = await prepare(context); control.conflictNext = true
  await page.goto('/patient/lab-requests')
  await page.getByLabel('Date (required)', { exact: true }).fill('2026-11-10')
  await page.getByLabel('Time (required)', { exact: true }).fill('10:15')
  await page.getByLabel('Lab or centre name (required)', { exact: true }).fill('Synthetic arranged laboratory')
  await page.getByRole('button', { name: 'Save patient-reported visit', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'This lab request can no longer be planned' })).toBeVisible()
  await expect(page.getByText('Your session changed', { exact: false })).toHaveCount(0)
  await expect(page.getByLabel('Lab or centre name (required)', { exact: true })).toHaveValue('Synthetic arranged laboratory')
  await page.getByRole('button', { name: 'Reload saved requests', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save patient-reported visit', exact: true })).toBeDisabled()
  await expect(page).toHaveURL(/\/patient\/lab-requests$/)
  expect(control.writes).toHaveLength(1)
})

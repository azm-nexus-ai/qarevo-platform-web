import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const consultationId = '66666666-6666-4666-8666-666666666666'
const editorPath = `/doctor/workspace/${consultationId}`
const note = 'Synthetic unsaved clinical note'

async function prepare(page: Page, context: BrowserContext) {
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  let draft: Record<string, unknown> | null = null
  const controls = { failSave: false }
  const consultation = { consultation_id: consultationId, patient_name: 'Synthetic navigation patient',
    patient_id: 'synthetic-patient', status: 'STARTED', started_at: '2030-07-10T07:00:00Z',
    scheduled_time: '2030-07-10T07:00:00Z', waiting_duration_minutes: null }
  const identity = await seedPortalSession(context, 'doctor', {user_id:'synthetic-role-owner'})
  await context.route('**/api/v1/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const path = new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if (path === '/api/v1/session' || path === '/api/v1/session/activity') return route.fulfill({ headers: headers, json:{browser_session:identity,server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now()+900_000).toISOString(), absolute_expires_at: new Date(Date.now()+28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path.endsWith('/clinical-record')) {
      if (route.request().method() === 'PUT') {
        if (controls.failSave) return route.fulfill({ status: 503, headers, json: { detail: 'Synthetic save unavailable. Your text is still here.' } })
        const body = route.request().postDataJSON()
        draft = { ...body, id: '77777777-7777-4777-8777-777777777777', revision: 1, version: 1,
          published_at: null, approved_by: null, updated_at: '2030-07-10T08:00:00Z' }
        return route.fulfill({ headers, json: draft })
      }
      return route.fulfill({ headers, json: { draft, published: null } })
    }
    if (path.endsWith(`/workspace/${consultationId}`)) return route.fulfill({ headers, json: { consultation, can_join_video: false } })
    if (path.endsWith('/workspace')) return route.fulfill({ headers, json: { consultations: [consultation], page: 1, filtered_count: 1, total_count: 1, has_next: false, has_previous: false } })
    if (path.endsWith('/episodes')) return route.fulfill({ headers, json: { episodes: [], page: 1, total_count: 0, filtered_count: 0, has_next: false, has_previous: false } })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ headers, json: { full_name: 'Synthetic Doctor', specialty: 'General Medicine' } })
    return route.fulfill({ status: 404, headers, json: { detail: 'No synthetic fixture for this request' } })
  })
  await page.goto('/doctor/workspace')
  await page.getByText('Synthetic navigation patient', { exact: true }).click()
  await expect(page.locator('#record-summary')).toBeVisible()
  await page.locator('#record-summary').fill(note)
  return controls
}

test('router navigation preserves unsaved notes until explicit discard', async ({ page, context }) => {
  await prepare(page, context)
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Keep your clinical notes?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('#record-summary')).toHaveValue(note)
  await expect(page).toHaveURL(new RegExp(`${editorPath}$`))
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  await dialog.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page).toHaveURL(/\/doctor\/workspace$/)
})

test('browser back can be cancelled without losing text or breaking history', async ({ page, context }) => {
  await prepare(page, context)
  await page.evaluate(() => history.back())
  const dialog = page.getByRole('dialog', { name: 'Keep your clinical notes?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${editorPath}$`))
  await expect(page.locator('#record-summary')).toHaveValue(note)
  await page.evaluate(() => history.back())
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page).toHaveURL(/\/doctor\/workspace$/)
})

test('mobile links preserve dark mode and close the menu after guarded navigation', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page, context)
  await page.getByRole('button', { name: /^(Dark|Light) mode$/ }).click()
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click()
  await page.getByRole('link', { name: 'Workspace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Keep your clinical notes?' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await dialog.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page).toHaveURL(/\/doctor\/workspace$/)
  await expect(page.getByRole('link', { name: 'Workspace', exact: true })).not.toBeVisible()
})

test('failed saving keeps the guard; successful saving allows navigation and reload', async ({ page, context }) => {
  const controls = await prepare(page, context)
  controls.failSave = true
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic save unavailable' })).toBeVisible()
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.locator('#record-summary')).toHaveValue(note)
  controls.failSave = false
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  await expect(page).toHaveURL(/\/doctor\/workspace$/)
  await page.getByText('Synthetic navigation patient', { exact: true }).click()
  await expect(page.locator('#record-summary')).toHaveValue(note)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(note)
})

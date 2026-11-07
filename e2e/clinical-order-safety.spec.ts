import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

test.use({ timezoneId: 'Europe/Berlin' })
function order(id: string, title: string) {
  return { id, title, status: 'Pending', priority: 'Routine', scheduled_for: '2026-11-05T14:30:22.123Z', recommended_date: null }
}
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const control = { holdAlpha: false, holdWrite: false, reads: [] as string[], writes: [] as Record<string, unknown>[], uploads: 0,
    releaseAlpha: () => {}, releaseWrite: () => {} }
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Clinician' } })
    if (path.endsWith('/doctor/patients')) return route.fulfill({ json: { patients: [{ patient_id: 'synthetic-alpha', name: 'Synthetic Alpha' }, { patient_id: 'synthetic-beta', name: 'Synthetic Beta' }], total_count: 2 } })
    if (path.includes('/doctor/lab-orders/') && method === 'GET') {
      const patient = path.split('/').at(-1)!
      control.reads.push(patient)
      if (patient === 'synthetic-alpha' && control.holdAlpha) await new Promise<void>(resolve => { control.releaseAlpha = resolve })
      return route.fulfill({ json: { test_requests: [order(patient + '-order', patient === 'synthetic-alpha' ? 'Synthetic Alpha order' : 'Synthetic Beta order')] } })
    }
    if (path.includes('/doctor/lab-orders') && ['POST', 'PUT'].includes(method)) {
      if (path.endsWith('/upload-result')) { control.uploads++; return route.fulfill({ json: { test_requests: [] } }) }
      const body = route.request().postDataJSON()
      control.writes.push(body)
      if (control.holdWrite) await new Promise<void>(resolve => { control.releaseWrite = resolve })
      return route.fulfill({ json: { test_requests: [order('synthetic-saved', body.title || 'Synthetic saved order')] } })
    }
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return control
}

test('late patient order responses cannot replace the current patient list', async ({ page, context }) => {
  const control = await prepare(context); control.holdAlpha = true
  await page.goto('/doctor/lab-orders')
  const select = page.getByLabel('Select patient', { exact: true })
  await select.selectOption('synthetic-alpha')
  await expect.poll(() => control.reads.includes('synthetic-alpha')).toBe(true)
  await select.selectOption('synthetic-beta')
  await expect(page.getByRole('heading', { name: 'Synthetic Beta order', exact: true })).toBeVisible()
  const returned = page.waitForResponse(response => response.url().endsWith('/doctor/lab-orders/synthetic-alpha'))
  control.releaseAlpha(); await returned
  await expect(page.getByRole('heading', { name: 'Synthetic Beta order', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Synthetic Alpha order', exact: true })).toHaveCount(0)
})

test('lab drafts require explicit discard for patient changes and navigation', async ({ page, context }) => {
  await prepare(context)
  await page.goto('/doctor/lab-orders')
  const select = page.getByLabel('Select patient', { exact: true })
  await select.selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Order Lab Test', exact: true }).click()
  await page.getByLabel('Test title (required)', { exact: true }).fill('Synthetic unsaved Alpha request')
  await select.selectOption('synthetic-beta')
  const dialog = page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true })
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(select).toHaveValue('synthetic-alpha')
  await expect(page.getByLabel('Test title (required)', { exact: true })).toHaveValue('Synthetic unsaved Alpha request')
  await page.locator('header[aria-label="Doctor main navigation"]').getByRole('link', { name: 'Qarevo Health doctor dashboard', exact: true }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page).toHaveURL(/\/doctor\/lab-orders$/)
  await select.selectOption('synthetic-beta')
  await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click()
  await expect(select).toHaveValue('synthetic-beta')
  await page.getByRole('button', { name: 'Order Lab Test', exact: true }).click()
  await expect(page.getByLabel('Test title (required)', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic unsaved Alpha request')
})

test('lab writes are serialized and retain the unchanged scheduled instant', async ({ page, context }) => {
  const control = await prepare(context); control.holdWrite = true
  await page.goto('/doctor/lab-orders')
  const select = page.getByLabel('Select patient', { exact: true })
  await select.selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByLabel('Known appointment time', { exact: true })).toHaveValue('2026-11-05T15:30')
  await page.getByLabel('Test title (required)', { exact: true }).fill('Synthetic revised Alpha request')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => control.writes.length).toBe(1)
  await expect(select).toBeDisabled()
  await expect(page.getByLabel('Test title (required)', { exact: true })).toBeDisabled()
  expect(control.writes[0].patient_id).toBe('synthetic-alpha')
  expect(control.writes[0].scheduled_for).toBeUndefined()
  expect(control.writes[0].status).toBeUndefined()
  control.releaseWrite()
  await expect(page.getByRole('heading', { name: 'Synthetic revised Alpha request', exact: true })).toBeVisible()
  await expect(select).toBeEnabled()
})

test('lab result uploads reject oversized files before sending them', async ({ page, context }) => {
  const control = await prepare(context)
  await page.goto('/doctor/lab-orders')
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await expect(page.getByRole('heading', { name: 'Synthetic Alpha order', exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('3 MB or smaller')
  expect(control.uploads).toBe(0)
})


test('lab editor remains accessible and within the viewport in mobile dark mode', async ({ page, context }) => {
  await prepare(context)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/doctor/lab-orders')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Order Lab Test', exact: true }).click()
  await page.getByLabel('Test title (required)', { exact: true }).fill('Synthetic mobile draft')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus(); await expect(cancel).toBeFocused(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Test title (required)', { exact: true })).toHaveValue('Synthetic mobile draft')
})

test('explicitly cleared lab fields are saved and remain cleared after a fresh load', async ({ page, context }) => {
  await prepare(context)
  let saved = { ...order('synthetic-persisted-order', 'Synthetic original order'), category: 'Synthetic blood panel', recommended_date: '2026-11-09T10:00:00.000Z' }
  const writes: Record<string, unknown>[] = []
  await context.route('**/api/v1/doctor/lab-orders**', route => {
    if (route.request().method() === 'PUT') {
      const patch = route.request().postDataJSON()
      writes.push(patch)
      saved = { ...saved, ...patch }
    }
    return route.fulfill({ json: { test_requests: [saved] } })
  })
  await page.goto('/doctor/lab-orders')
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('Synthetic blood panel')
  await expect(page.getByLabel('Recommended by', { exact: true })).toHaveValue('2026-11-09T11:00')
  await page.getByLabel('Test title (required)', { exact: true }).fill('Synthetic revised order')
  await page.getByLabel('Category', { exact: true }).fill('')
  await page.getByLabel('Recommended by', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic revised order', exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ patient_id: 'synthetic-alpha', test_id: 'synthetic-persisted-order', title: 'Synthetic revised order', category: '', recommended_date: '' })
  expect(writes[0].scheduled_for).toBeUndefined()
  await page.reload()
  await page.getByLabel('Select patient', { exact: true }).selectOption('synthetic-alpha')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByLabel('Test title (required)', { exact: true })).toHaveValue('Synthetic revised order')
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Recommended by', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Known appointment time', { exact: true })).toHaveValue('2026-11-05T15:30')
})

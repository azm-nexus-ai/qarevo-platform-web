import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'
import { expectEnabledControlContrast } from './helpers/contrast'

const notificationId = '22222222-2222-4222-8222-222222222222'
const recordId = '22222222-2222-4222-8222-222222222222'
const consultationId = '66666666-6666-4666-8666-666666666666'
const episodeId = '88888888-8888-4888-8888-888888888888'
const notificationsPath = '/api/v1/patient/activity/notifications'
function official(overrides: Record<string, unknown> = {}) {
  return { id: notificationId, event_type: 'clinical_record.published', source: 'clinical-publication', source_id: recordId, title: 'Untrusted server title', body: 'Synthetic private clinical content must not appear in notice', href: 'https://untrusted.invalid/private', is_read: false, read_at: null, created_at: '2030-07-13T08:00:00Z', extra_data: { record_id: recordId, episode_id: episodeId, consultation_id: consultationId, revision: 2, version: 3, published_at: '2030-07-13T08:00:00Z' }, ...overrides }
}
function careRecord(overrides: Record<string, unknown> = {}) {
  return official({ event_type: 'medication_instruction.updated', source: 'clinical-authoring', source_id: notificationId, extra_data: { audit_id: notificationId, actor_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'medication_instruction', action: 'updated', resource_id: recordId, record_reference_hash: null }, ...overrides })
}
function published() {
  return { id: recordId, episode_id: episodeId, consultation_id: consultationId, revision: 2, version: 3, language: 'en', authored_by: 'synthetic-clinician', approved_by: 'synthetic-clinician', published_at: '2030-07-13T08:00:00Z', created_at: '2030-07-10T07:45:00Z', updated_at: '2030-07-13T08:00:00Z', summary: 'Synthetic published care summary', history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: 'Synthetic care plan', safety_net: 'Synthetic follow-up advice', amendment_reason: 'Synthetic amendment' }
}
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const state = { identity, notifications: [official()] as Record<string, unknown>[], timeline: [] as Record<string, unknown>[], listStatus: 200, markStatus: 200, wrongAck: false, listReads: 0, marks: 0, holdList: false, listStarted: false, listDelivery: Promise.resolve(), releaseList: () => {}, holdMark: false, markStarted: false, markDelivery: Promise.resolve(), releaseMark: () => {} }
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    expect(route.request().headers()['authorization']).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(state.identity) })
    if (path === notificationsPath) {
      expect(route.request().headers()['x-qarevo-portal']).toBe('patient')
      state.listReads++
      const status = state.listStatus, body = status === 200 ? { notifications: JSON.parse(JSON.stringify(state.notifications)) } : { detail: 'Synthetic notifications temporarily unavailable' }
      let delivered: (() => void) | undefined
      if (state.holdList) {
        state.holdList = false; state.listDelivery = new Promise<void>(resolve => { delivered = resolve }); state.listStarted = true
        await new Promise<void>(resolve => { state.releaseList = resolve })
      }
      try { return await route.fulfill({ status, json: body }) } finally { delivered?.() }
    }
    if (path.startsWith(notificationsPath + '/') && path.endsWith('/read')) {
      expect(route.request().method()).toBe('PATCH')
      expect(route.request().headers()['x-qarevo-portal']).toBe('patient')
      expect(route.request().headers()['x-qarevo-session']).toBe(state.identity.session_id)
      state.marks++
      const row = state.notifications.find(item => path === `${notificationsPath}/${item.id}/read`)!
      const status = state.markStatus
      if (status === 200 && !state.wrongAck) { row.is_read = true; row.read_at = '2030-07-13T08:05:00Z' }
      const body = status === 200 ? { ...row, ...(state.wrongAck ? { id: '99999999-9999-4999-8999-999999999999', is_read: true } : {}) } : { detail: status === 404 ? 'Notification not found' : 'Synthetic read receipt could not be saved' }
      let delivered: (() => void) | undefined
      if (state.holdMark) {
        state.holdMark = false; state.markDelivery = new Promise<void>(resolve => { delivered = resolve }); state.markStarted = true
        await new Promise<void>(resolve => { state.releaseMark = resolve })
      }
      try { return await route.fulfill({ status, json: body }) } finally { delivered?.() }
    }
    if (path.endsWith('/consultation-summary/publications')) {
      const value = published()
      return route.fulfill({ json: { items: [Object.fromEntries(['id', 'episode_id', 'consultation_id', 'revision', 'version', 'language', 'approved_by', 'published_at'].map(key => [key, value[key as keyof typeof value]]))], latest_published_revision: 2, has_more: false, next_before_revision: null } })
    }
    if (path.endsWith(`/publications/${recordId}`)) return route.fulfill({ json: { record: published(), latest_published_revision: 2, is_current: true } })
    if (path.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (path.endsWith('/patient/settings/health-info')) return route.fulfill({ json: { blood_type: '', allergies: '', medical_conditions: '' } })
    if (path.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (path.endsWith('/patient/medical-records')) return route.fulfill({ json: { records: [], timeline: state.timeline } })
    if (path.endsWith('/patient/dashboard')) return route.fulfill({ json: { patient_name: 'Synthetic Patient', notifications: state.notifications, timeline_items: state.timeline, summary_cards: [], care_plans: [], medications: [] } })
    if (path.endsWith('/patient/prescription-care-plan')) return route.fulfill({ json: { medications: [], care_plans: [] } })
    if (path.endsWith('/patient/doctors')) return route.fulfill({ json: { doctors: [], total: 0 } })
    if (path.endsWith('/patient/doctors/recent')) return route.fulfill({ json: { recent_doctors: [] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
const region = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Patient notifications', exact: true })
const row = (page: import('@playwright/test').Page) => region(page).locator(`[data-notification-id='${notificationId}']`)

test('official notification opens only its immutable summary and never marks it read implicitly', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/patient/notifications')
  await expect(row(page).getByRole('heading', { name: 'Consultation summary updated', exact: true })).toBeVisible()
  await expect(row(page).getByText('New', { exact: true })).toBeVisible()
  const link = row(page).getByRole('link', { name: 'View consultation summary', exact: true })
  await expect(link).toHaveAttribute('href', `/patient/consultation-summary?consultationId=${consultationId}&recordId=${recordId}`)
  await expect(region(page)).not.toContainText('Synthetic private clinical content')
  await expect(region(page)).not.toContainText('Untrusted server title')
  await link.click()
  await expect(page.getByRole('article')).toContainText('Synthetic published care summary')
  expect(state.marks).toBe(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic published care summary')
})

test('care record notice uses fixed copy, opens the generic current-care page and persists only explicit read receipts', async ({ page, context }) => {
  const state = await prepare(context)
  state.notifications = [careRecord({ href: `/patient/prescription-care-plan?recordId=${recordId}` })]
  await page.goto('/patient/notifications')
  await expect(row(page).getByText('Care record update', { exact: true })).toBeVisible()
  await expect(row(page).getByRole('heading', { name: 'Medication record updated', exact: true })).toBeVisible()
  await expect(row(page)).toContainText('A clinician updated a medication record. Open your care page to review your current recorded instructions.')
  await expect(region(page)).not.toContainText('Synthetic private clinical content')
  await expect(region(page)).not.toContainText('Untrusted server title')
  const link = row(page).getByRole('link', { name: 'View current care instructions', exact: true })
  await expect(link).toHaveAttribute('href', '/patient/prescription-care-plan')
  await link.click()
  await expect(page).toHaveURL(/\/patient\/prescription-care-plan$/)
  await expect(page.getByRole('heading', { name: 'Your medications', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your care plans', exact: true })).toBeVisible()
  expect(state.marks).toBe(0)
  await page.goto('/patient/notifications')
  await row(page).getByRole('button', { name: 'Mark Medication record updated as read', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  await region(page).getByRole('button', { name: 'Refresh notifications', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  await page.reload()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  expect(state.marks).toBe(1)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Medication record updated')
})

test('dashboard and medical-record timelines display generic care record removal without a target query', async ({ page, context }) => {
  const state = await prepare(context)
  state.notifications = [careRecord({ event_type: 'care_plan.deleted', extra_data: { ...careRecord().extra_data as object, kind: 'care_plan', action: 'deleted', resource_id: null, record_reference_hash: 'a'.repeat(64) } })]
  state.timeline = [{ id: notificationId, title: 'Care plan record removed', event: 'Care plan record removed', body: 'A clinician removed a care plan record. Open your care page to review your current recorded instructions.', source: 'Qarevo Health', date: '13 Jul 2030' }]
  await page.setViewportSize({ width: 1600, height: 1000 }); await page.goto('/patient/dashboard')
  await expect(row(page).getByRole('heading', { name: 'Care plan record removed', exact: true })).toBeVisible()
  await expect(row(page).getByRole('link', { name: 'View current care instructions', exact: true })).toHaveAttribute('href', '/patient/prescription-care-plan')
  const timeline = page.getByRole('heading', { name: 'Health Timeline', exact: true }).locator('xpath=ancestor::section[1]')
  await expect(timeline.getByText('Care plan record removed', { exact: true })).toBeVisible()
  await expect(timeline).toContainText('current recorded instructions')
  await page.goto('/patient/medical-records')
  const recordsTimeline = page.getByRole('heading', { name: 'Care Timeline', exact: true }).locator('..')
  await expect(recordsTimeline.getByText('Care plan record removed', { exact: true })).toBeVisible()
  await expect(recordsTimeline).toContainText('Qarevo Health')
  await expect(page.locator(`a[href*="${recordId}"]`)).toHaveCount(0)
  expect(state.marks).toBe(0)
})

test('explicit read receipt persists on refresh and a fresh route entry', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/patient/notifications')
  await row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  await expect(row(page).getByRole('button', { name: /as read/ })).toHaveCount(0)
  expect(state.marks).toBe(1)
  await region(page).getByRole('button', { name: 'Refresh notifications', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  await page.reload()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  expect(state.notifications[0].is_read).toBe(true)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Consultation summary updated')
})

test('failed read receipt remains new and exposes a real retry without blocking record access', async ({ page, context }) => {
  const state = await prepare(context); state.markStatus = 503
  await page.goto('/patient/notifications')
  await row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByRole('alert')).toContainText('Synthetic read receipt could not be saved')
  await expect(row(page).getByText('New', { exact: true })).toBeVisible()
  await expect(row(page).getByRole('link', { name: 'View consultation summary', exact: true })).toBeEnabled()
  state.markStatus = 200
  await row(page).getByRole('button', { name: 'Retry marking Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  expect(state.marks).toBe(2)
})

test('foreign/mismatched read acknowledgments cannot falsely mark a notification read', async ({ page, context }) => {
  const state = await prepare(context); state.markStatus = 404
  await page.goto('/patient/notifications')
  await row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByRole('alert')).toContainText('Notification not found')
  await expect(row(page).getByText('New', { exact: true })).toBeVisible()
  state.markStatus = 200; state.wrongAck = true
  await row(page).getByRole('button', { name: 'Retry marking Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByRole('alert')).toContainText('The read status could not be confirmed')
  await expect(row(page).getByText('New', { exact: true })).toBeVisible()
  state.wrongAck = false
  await row(page).getByRole('button', { name: 'Retry marking Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
})

test('notification load failures remain distinct from an empty inbox and retry the endpoint', async ({ page, context }) => {
  const state = await prepare(context); state.listStatus = 503
  await page.goto('/patient/notifications')
  await expect(region(page).getByRole('alert')).toContainText('Synthetic notifications temporarily unavailable')
  await expect(region(page).getByText('No notifications yet.', { exact: false })).toHaveCount(0)
  state.listStatus = 200; state.notifications = []
  await region(page).getByRole('button', { name: 'Retry notifications', exact: true }).click()
  await expect(region(page).getByText('No notifications yet. Updates will appear here when available.', { exact: true })).toBeVisible()
  expect(state.listReads).toBe(2)
})

test('unverified clinical rows and untrusted legacy destinations never become care links', async ({ page, context }) => {
  const state = await prepare(context)
  state.notifications = [official({ extra_data: { ...official().extra_data as object, clinical_text: 'Synthetic invalid metadata' } }), official({ id: '55555555-5555-4555-8555-555555555555', source: 'manual', event_type: 'account.note', title: 'Synthetic untrusted update', href: 'https://untrusted.invalid/private', body: 'Synthetic account note' }), official({ id: '77777777-7777-4777-8777-777777777777', source: 'platform', event_type: 'lab_result_uploaded', title: 'Synthetic record upload', href: `/patient/medical-records?recordId=${recordId}` })]
  await page.goto('/patient/notifications')
  await expect(region(page).getByRole('alert')).toContainText('Some notifications could not be verified')
  await expect(region(page).getByRole('link', { name: 'View consultation summary', exact: true })).toHaveCount(0)
  await expect(page.locator('a[href^="https://untrusted.invalid"]')).toHaveCount(0)
  await expect(region(page).getByRole('link', { name: 'Open update', exact: true })).toHaveAttribute('href', `/patient/medical-records?recordId=${recordId}`)
})

test('unverified care provenance stays hidden while a downgraded account update has no care action', async ({ page, context }) => {
  const state = await prepare(context)
  state.notifications = [careRecord({ extra_data: { ...careRecord().extra_data as object, medical_body: 'Synthetic private instruction' } }), careRecord({ id: '55555555-5555-4555-8555-555555555555', event_type: 'patient_reported_activity', source: 'patient-reported', source_id: null, title: 'Account update', body: 'This account activity could not be verified as a clinician record change.', href: null, extra_data: {} })]
  await page.goto('/patient/notifications')
  await expect(region(page).getByRole('alert')).toContainText('Some notifications could not be verified')
  await expect(region(page).locator('[data-notification-id]')).toHaveCount(1)
  await expect(region(page).getByRole('heading', { name: 'Account update', exact: true })).toBeVisible()
  await expect(region(page).getByRole('link', { name: 'View current care instructions', exact: true })).toHaveCount(0)
  await expect(region(page)).not.toContainText('Synthetic private instruction')
})

test('repeated focus refreshes coalesce while a notification request is already in flight', async ({ page, context }) => {
  const state = await prepare(context); state.holdList = true
  await page.goto('/patient/notifications')
  await expect.poll(() => state.listStarted).toBe(true)
  await page.evaluate(() => { for (let index = 0; index < 3; index++) window.dispatchEvent(new Event('focus')) })
  expect(state.listReads).toBe(1)
  state.releaseList(); await state.listDelivery
  await expect(region(page).getByRole('button', { name: 'Refresh notifications', exact: true })).toBeEnabled()
  await expect(row(page).getByRole('heading', { name: 'Consultation summary updated', exact: true })).toBeVisible()
  expect(state.listReads).toBe(2)
})

test('a changed patient session cannot restore a late notification list after sign-in redirect', async ({ page, context }) => {
  const state = await prepare(context); state.holdList = true
  await page.goto('/patient/notifications')
  await expect.poll(() => state.listStarted).toBe(true)
  const completed = state.listDelivery
  state.identity = { user_id: 'synthetic-other-patient', role: 'PATIENT', session_id: 'synthetic-other-session' }; state.notifications = []
  try {
    await page.evaluate(identity => {
      const key = 'qarevo:patient:identity', value = JSON.stringify(identity)
      localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
    }, state.identity)
    await expect(page).toHaveURL(/\/auth\/sign-in$/)
  } finally { state.releaseList() }
  await completed
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  await expect(page.getByText('Consultation summary updated', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic private clinical content')
})

test('same-tick account changes prevent stale notification navigation and read mutations', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/patient/notifications')
  await expect(row(page).getByRole('link', { name: 'View consultation summary', exact: true })).toBeVisible()
  state.identity = { user_id: 'synthetic-other-patient', role: 'PATIENT', session_id: 'synthetic-other-session' }
  await page.evaluate(identity => {
    const item = document.querySelector('[data-notification-id]')!, link = item.querySelector('a')!, button = item.querySelector('button')!
    const key = 'qarevo:patient:identity', value = JSON.stringify(identity)
    localStorage.setItem(key, value); link.click(); button.click(); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
  }, state.identity)
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  expect(state.marks).toBe(0)
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('leaving the notification route aborts its pending read and cannot leak a late list', async ({ page, context }) => {
  const state = await prepare(context); state.holdList = true
  let cancelled = false
  page.on('requestfailed', request => { if (new URL(request.url()).pathname === notificationsPath) cancelled = true })
  await page.goto('/patient/notifications')
  await expect.poll(() => state.listStarted).toBe(true)
  const completed = state.listDelivery
  await page.getByRole('navigation', { name: 'Patient navigation', exact: true }).getByRole('link', { name: 'Medical Records', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Medical Records', exact: true })).toBeVisible()
  await expect.poll(() => cancelled).toBe(true)
  state.releaseList(); await completed
  await expect(region(page)).toHaveCount(0)
})

test('a late read acknowledgment cannot enter a different patient session', async ({ page, context }) => {
  const state = await prepare(context); state.holdMark = true
  await page.goto('/patient/notifications')
  await row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }).click()
  await expect.poll(() => state.markStarted).toBe(true)
  const completed = state.markDelivery
  state.identity = { user_id: 'synthetic-other-patient', role: 'PATIENT', session_id: 'synthetic-other-session' }; state.notifications = []
  try {
    await page.evaluate(identity => {
      const key = 'qarevo:patient:identity', value = JSON.stringify(identity)
      localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
    }, state.identity)
    await expect(page).toHaveURL(/\/auth\/sign-in$/)
  } finally { state.releaseMark() }
  await completed
  await expect(region(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Consultation summary updated')
})

test('desktop dashboard uses the working notification loop and links to the responsive inbox', async ({ page, context }) => {
  const state = await prepare(context)
  await page.setViewportSize({ width: 1600, height: 1000 }); await page.goto('/patient/dashboard')
  await expect(row(page).getByRole('heading', { name: 'Consultation summary updated', exact: true })).toBeVisible()
  await row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }).click()
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  await region(page).getByRole('link', { name: 'View all recent notifications', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/notifications$/)
  await expect(row(page).getByText('Read', { exact: true })).toBeVisible()
  expect(state.marks).toBe(1)
})

test('dashboard shows five recent updates while the full notification route retains all recent records', async ({ page, context }) => {
  const state = await prepare(context)
  state.notifications = Array.from({ length: 6 }, (_, index) => official({ id: `0000000${index + 1}-1111-4111-8111-111111111111`, event_type: 'account.update', source: 'platform', source_id: null, title: `Synthetic account update ${index + 1}`, body: 'Synthetic account update', href: '/patient/settings', extra_data: {} }))
  await page.setViewportSize({ width: 1600, height: 1000 }); await page.goto('/patient/dashboard')
  await expect(region(page).locator('[data-notification-id]')).toHaveCount(5)
  await expect(region(page).getByText('Up to 5 recent account and care updates.', { exact: true })).toBeVisible()
  await region(page).getByRole('link', { name: 'View all recent notifications', exact: true }).click()
  await expect(region(page).locator('[data-notification-id]')).toHaveCount(6)
  await expect(region(page).getByText('Up to 50 recent account and care updates.', { exact: true })).toBeVisible()
})

for (const width of [320, 820, 1440]) test(`patient notifications remain usable in both themes at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await prepare(context)
  const careId = '55555555-5555-4555-8555-555555555555'
  state.notifications.push(careRecord({ id: careId, source_id: careId, extra_data: { ...careRecord().extra_data as object, audit_id: careId } }))
  await page.setViewportSize({ width, height: 900 }); await page.goto('/patient/notifications')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    await expect(row(page).getByRole('heading', { name: 'Consultation summary updated', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const link = row(page).getByRole('link', { name: 'View consultation summary', exact: true })
    await link.focus(); await expect(link).toBeFocused()
    const careLink = region(page).getByRole('link', { name: 'View current care instructions', exact: true })
    await careLink.focus(); await expect(careLink).toBeFocused()
    const refresh = region(page).getByRole('button', { name: 'Refresh notifications', exact: true })
    await refresh.focus(); await expect(refresh).toBeFocused(); await page.keyboard.press('Enter')
    await expect(refresh).toBeEnabled()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`patient-notifications-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await expectEnabledControlContrast(refresh)
    await expectEnabledControlContrast(link)
    await expectEnabledControlContrast(careLink)
    await expectEnabledControlContrast(row(page).getByRole('button', { name: 'Mark Consultation summary updated as read', exact: true }))
  }
})

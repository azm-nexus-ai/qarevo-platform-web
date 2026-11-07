import {test, expect, type BrowserContext, type Page} from '@playwright/test'
import {seedPortalSession, testSessionTiming} from './helpers/portal-session'

type SecurityAction = 'password' | 'revoke-all' | 'self'

async function securityFixtures(context: BrowserContext, action: SecurityAction) {
  const patient = await seedPortalSession(context, 'patient')
  const doctor = await seedPortalSession(context, 'doctor')
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const state = {started: false, completed: false, release, patient, doctor}
  const actionPath = action === 'password' ? '/api/v1/security/password' : action === 'self' ? '/api/v1/security/sessions/own-current' : '/api/v1/security/sessions/revoke-all'
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const portal = request.headers()['x-qarevo-portal']
    if (path === '/api/v1/browser-csrf') return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({json: testSessionTiming(portal === 'doctor' ? doctor : patient)})
    if (path === '/api/v1/auth/social/providers') return route.fulfill({json: {google: {enabled: false}, apple: {enabled: false}}})
    if (path === actionPath) {
      expect(portal).toBe('doctor')
      expect(request.headers()['x-qarevo-session']).toBe(doctor.session_id)
      expect(request.headers().authorization).toBeUndefined()
      state.started = true
      await pending
      await route.fulfill({json: {message: 'Synthetic session ended.', current_session_revoked: true, sign_in_required: true}})
      state.completed = true
      return
    }
    if (path === '/api/v1/security') return route.fulfill({json: {password_change_available: true, mfa: {available: false, enabled: false, method: null, message: 'Unavailable in this synthetic fixture.'}, sessions: [{id: 'own-current', current: true, device_name: 'Synthetic browser', browser_name: 'Chrome', operating_system: 'Test', created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString()}], sessions_total: 1}})
    if (path === '/api/v1/doctor/profile') return route.fulfill({json: {user_id: doctor.user_id, provider_id: doctor.provider_id, full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', specialty: 'General practice', avatar_url: null}})
    if (path === '/api/v1/doctor/settings') return route.fulfill({json: {user_id: doctor.user_id, provider_id: doctor.provider_id, email: 'clinician@example.invalid', phone: null, email_notifications: false, sms_notifications: false, push_notifications: false, weekly_reports: false, working_hours_start: '09:00', working_hours_end: '17:00', available_days: [], two_factor_enabled: false}})
    if (path === '/api/v1/doctor/dashboard') return route.fulfill({json: {stats: {today_appointments: 0, pending_patients: 0, assigned_episodes: 0, episodes_with_ai_ready: 0}, recent_appointments: [], recent_consultations: [], current_date: new Date().toISOString()}})
    if (path === '/api/v1/doctor/episodes') return route.fulfill({json: {episodes: [], total_count: 0, has_next: false}})
    if (path === '/api/v1/patient/settings') return route.fulfill({json: {user_id: patient.user_id, first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: []}})
    if (path === '/api/v1/patient/profile-image') return route.fulfill({json: {image: null}})
    if (path === '/api/v1/patient/dashboard') return route.fulfill({json: {patient_name: 'Synthetic Patient', care_plans: [], medications: [], summary_cards: [], ai_insights: [], notifications: []}})
    if (path === '/api/v1/patient/doctors') return route.fulfill({json: {doctors: []}})
    if (path === '/api/v1/patient/doctors/recent') return route.fulfill({json: {recent_doctors: []}})
    return route.fulfill({status: 404, json: {detail: 'No synthetic fixture.'}})
  })
  return state
}

async function openDoctorSettingsThroughClientNavigation(page: Page) {
  await page.goto('/auth/sign-in')
  await page.evaluate(() => { (window as Window & {syntheticSecurityDocument?: boolean}).syntheticSecurityDocument = true })
  await page.getByRole('navigation', {name: 'Other sign-in portal'}).getByRole('link', {name: 'Physician sign-in'}).click()
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  const home = page.getByRole('contentinfo').getByRole('link', {name: 'Qarevo Health home', exact: true})
  await expect(home).toHaveAttribute('href', '/doctor/dashboard')
  await home.click()
  await expect(page).toHaveURL(/\/doctor\/dashboard$/)
  await page.getByRole('banner', {name: 'Doctor main navigation', exact: true}).getByRole('button', {name: 'Settings', exact: true}).click()
  await expect(page).toHaveURL(/\/doctor\/settings$/)
  await expect(page.getByRole('region', {name: 'Account security'}).getByRole('button', {name: 'Change password and sign out'})).toBeEnabled()
}

async function startSecurityAction(page: Page, action: SecurityAction) {
  const security = page.getByRole('region', {name: 'Account security'})
  if (action === 'password') {
    await security.getByLabel('Current password (Required)', {exact: true}).fill('Synthetic-old-password42!')
    await security.getByLabel('New password (Required)', {exact: true}).fill('Synthetic-new-password42!')
    await security.getByLabel('Confirm new password (Required)', {exact: true}).fill('Synthetic-new-password42!')
    await security.getByRole('button', {name: 'Change password and sign out'}).click()
  } else {
    const label = action === 'self' ? 'Sign out this device' : 'Sign out all devices'
    await security.getByRole('button', {name: label, exact: true}).click()
    await page.getByRole('alertdialog').getByRole('button', {name: label, exact: true}).click()
  }
}

async function returnToPatientThroughClientHistory(page: Page) {
  // Every history entry was created by a real Next link/router transition.
  // A full-document page.goto would destroy the old async continuation and miss this race.
  for (const path of ['/doctor/dashboard', '/auth/doctor/login', '/auth/sign-in']) {
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(path + '$'))
  }
  expect(await page.evaluate(() => (window as Window & {syntheticSecurityDocument?: boolean}).syntheticSecurityDocument)).toBe(true)
}

for (const action of ['password', 'revoke-all', 'self'] as const) test(`a late doctor ${action} cannot sign out or redirect the patient portal`, async ({page, context}) => {
  const state = await securityFixtures(context, action)
  await openDoctorSettingsThroughClientNavigation(page)
  await page.evaluate(() => sessionStorage.setItem('qarevo.draft.v3:patient:synthetic-retained-draft', 'synthetic-patient-draft'))
  await startSecurityAction(page, action)
  await expect.poll(() => state.started).toBe(true)
  await returnToPatientThroughClientHistory(page)
  state.release()
  await expect.poll(() => state.completed).toBe(true)
  // The initiating doctor session really finishes; this also waits for its UI continuation.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('qarevo:doctor:identity'))).toBeNull()
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(state.patient)
  expect(await page.evaluate(() => localStorage.getItem('qarevo:patient:signed-out'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('qarevo.draft.v3:patient:synthetic-retained-draft'))).toBe('synthetic-patient-draft')
  await page.getByRole('contentinfo').getByRole('link', {name: 'Qarevo Health home', exact: true}).click()
  await expect(page).toHaveURL(/\/patient\/dashboard$/)
  await expect(page.getByRole('navigation', {name: 'Patient appearance', exact: true})).toBeVisible()
})

test('a late self-session revocation cannot clear a newer doctor identity', async ({page, context}) => {
  const state = await securityFixtures(context, 'self')
  await openDoctorSettingsThroughClientNavigation(page)
  await startSecurityAction(page, 'self')
  await expect.poll(() => state.started).toBe(true)
  await returnToPatientThroughClientHistory(page)
  const newerDoctor = {...state.doctor, user_id: 'synthetic-new-doctor', session_id: 'synthetic-new-doctor-session'}
  await page.evaluate(identity => {
    localStorage.setItem('qarevo:doctor:identity', JSON.stringify(identity))
    sessionStorage.setItem('qarevo.draft.v3:doctor:synthetic-retained-draft', 'synthetic-new-doctor-draft')
  }, newerDoctor)
  state.release()
  await expect.poll(() => state.completed).toBe(true)
  // A browser task after the fulfilled fetch lets its response/body continuation settle.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:doctor:identity') || 'null'))).toEqual(newerDoctor)
  expect(await page.evaluate(() => localStorage.getItem('qarevo:doctor:signed-out'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('qarevo.draft.v3:doctor:synthetic-retained-draft'))).toBe('synthetic-new-doctor-draft')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:patient:identity') || 'null'))).toEqual(state.patient)
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
})

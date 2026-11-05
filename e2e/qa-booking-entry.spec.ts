import {test, expect, type BrowserContext} from '@playwright/test'
import {seedPortalSession, testSessionTiming} from './helpers/portal-session'

const provider = '11111111-1111-4111-8111-111111111111'
const episode = '22222222-2222-4222-8222-222222222222'
const doctor = {id: provider, name: 'Dr. Synthetic Selected Clinician', specialty: 'General medicine', hospital: 'Synthetic practice', imageUrl: null, consultationFee: 33, experienceYears: 5, rating: 0, reviews: 0, languages: ['German'], insurance: ['Self pay'], gender: 'female', consultationTypes: ['video'], distanceKm: null, conditions: [], verification: 'Verified', tags: [], services: [{type: 'video', duration: '30 min', price: 33}], profile: {services: [{type: 'video', label: 'Video consultation', duration: '30 min', price: 33, availability: 'By appointment'}], availabilitySlots: [], location: {address: '', directions: '', parking: '', accessibility: ''}}}

async function bookingFixtures(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'patient')
  const control = {profileFails: false, profileDelay: null as Promise<void> | null, profileReads: 0, availabilityReads: 0, slotReads: 0}
  await context.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({json: []}))
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(request.headers().authorization).toBeUndefined()
    if (path === '/api/v1/browser-csrf') return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({json: testSessionTiming(identity)})
    if (path === '/api/v1/patient/settings') return route.fulfill({json: {user_id: identity.user_id, first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: []}})
    if (path === '/api/v1/patient/settings/health-info') return route.fulfill({json: {}})
    if (path === '/api/v1/patient/profile-image') return route.fulfill({json: {image: null}})
    if (path === '/api/v1/patient/dashboard') return route.fulfill({json: {patient_name: 'Synthetic Patient', care_plans: [], medications: [], summary_cards: [], ai_insights: [], notifications: []}})
    if (path === '/api/v1/patient/doctors') return route.fulfill({json: {doctors: [doctor], total: 1, filtered_count: 1, has_next: false, has_previous: false}})
    if (path === '/api/v1/patient/doctors/recommended') return route.fulfill({json: {doctors: []}})
    if (path === '/api/v1/patient/doctors/recent') return route.fulfill({json: {recent_doctors: []}})
    if (path === `/api/v1/patient/doctors/${provider}`) {
      control.profileReads++
      await control.profileDelay
      return route.fulfill(control.profileFails ? {status: 404, json: {detail: 'Synthetic doctor unavailable.'}} : {json: doctor})
    }
    if (path === '/api/v1/patient/booking-datetime/availability') {
      control.availabilityReads++
      expect(url.searchParams.get('provider_id')).toBe(provider)
      return route.fulfill({json: {provider_id: provider, availability: [], available_days: [], working_hours: {start: '09:00', end: '17:00', timezone: 'Europe/Berlin'}}})
    }
    if (path === '/api/v1/patient/booking-datetime/slots') {
      control.slotReads++
      expect(url.searchParams.get('provider_id')).toBe(provider)
      const date = url.searchParams.get('date') || '2030-07-10'
      return route.fulfill({json: {date, schedule_ready: true, slots: ['9:00 AM'], slot_details: [{label: '9:00 AM', start_at: `${date}T07:00:00+00:00`, end_at: `${date}T07:30:00+00:00`, time_zone: 'Europe/Berlin', duration_minutes: 30}], working_hours: {start: '09:00', end: '17:00', timezone: 'Europe/Berlin'}}})
    }
    return route.fulfill({status: 404, json: {detail: 'No synthetic fixture.'}})
  })
  return {control, identity}
}

test('dashboard booking opens doctor selection and continues with the chosen clinician', async ({page, context}) => {
  const {control} = await bookingFixtures(context)
  await page.goto('/patient/dashboard')
  await page.getByRole('link', {name: /Book Appointment/}).click()
  await expect(page).toHaveURL(/\/patient\/find-doctor(?:\?|$)/)
  await page.getByRole('link', {name: 'Book Now', exact: true}).click()
  await expect(page.getByRole('heading', {name: 'Choose Your Appointment', exact: true})).toBeVisible()
  await expect(page.getByRole('heading', {name: doctor.name, exact: true}).first()).toBeVisible()
  await expect(page.getByLabel('Appointment date', {exact: true})).toBeVisible()
  await expect(page.getByText('Cancellation terms not configured', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: 'Continue', exact: true}).click()
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/intake\?/)
  expect(new URL(page.url()).searchParams.get('provider_id')).toBe(provider)
  expect(control.profileReads).toBeGreaterThanOrEqual(1)
})

test('generic booking preserves the intake reference through discovery without carrying clinical query data', async ({page, context}) => {
  await bookingFixtures(context)
  await page.goto(`/patient/consultation-booking?episode_id=${episode}&intake_submitted=true&service=video&notes=private-draft-must-not-be-in-url`)
  await expect(page).toHaveURL(/\/patient\/find-doctor\?/)
  let url = new URL(page.url())
  expect(url.searchParams.get('episode_id')).toBe(episode)
  expect(url.searchParams.get('intake_submitted')).toBe('true')
  expect(url.searchParams.has('notes')).toBe(false)
  const booking = page.getByRole('link', {name: 'Book Now', exact: true})
  await expect(booking).toHaveAttribute('href', new RegExp(`episode_id=${episode}`))
  await booking.click()
  await expect(page.getByRole('heading', {name: 'Choose Your Appointment', exact: true})).toBeVisible()
  await page.getByRole('button', {name: 'Continue', exact: true}).click()
  url = new URL(page.url())
  expect(url.pathname).toBe('/patient/consultation-booking/intake')
  expect(url.searchParams.get('episode_id')).toBe(episode)
  expect(url.searchParams.get('intake_submitted')).toBe('true')
  expect(url.searchParams.has('notes')).toBe(false)
})

for (const width of [390, 1440]) test(`direct scheduling without a doctor has an accessible recovery at ${width}px`, async ({page, context}) => {
  const {control} = await bookingFixtures(context)
  await page.setViewportSize({width, height: 900})
  await page.goto(`/patient/consultation-booking/date-time?episode_id=${episode}&service=video&notes=private-query-must-be-removed`)
  await expect(page.getByRole('heading', {name: 'Choose a doctor to continue', exact: true})).toBeVisible()
  await expect(page.getByText('Loading physician...', {exact: true})).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.has('notes')).toBe(false)
  expect(control.availabilityReads).toBe(0)
  expect(control.slotReads).toBe(0)
  await page.getByRole('link', {name: 'Choose a doctor', exact: true}).press('Enter')
  await expect(page).toHaveURL(/\/patient\/find-doctor\?/)
  expect(new URL(page.url()).searchParams.get('episode_id')).toBe(episode)
  await expect(page.getByRole('link', {name: 'Book Now', exact: true})).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('unavailable clinician details show a real retry and preserve selection context', async ({page, context}) => {
  const {control} = await bookingFixtures(context)
  control.profileFails = true
  await page.goto(`/patient/consultation-booking/date-time?provider_id=${provider}&episode_id=${episode}&date=2030-07-10`)
  await expect(page.getByRole('heading', {name: 'Doctor details unavailable', exact: true})).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Retry loading their details or choose another doctor.')
  await expect(page.getByRole('link', {name: 'Choose another doctor', exact: true})).toHaveAttribute('href', new RegExp(`episode_id=${episode}`))
  control.profileFails = false
  await page.getByRole('button', {name: 'Retry doctor details', exact: true}).click()
  await expect(page.getByRole('heading', {name: 'Choose Your Appointment', exact: true})).toBeVisible()
  expect(control.profileReads).toBe(2)
})

test('provider lookup must finish before a scheduling flow can proceed, even when slots arrive first', async ({page, context}) => {
  const {control} = await bookingFixtures(context)
  let release!: () => void
  control.profileDelay = new Promise<void>(resolve => { release = resolve })
  await page.goto(`/patient/consultation-booking?provider_id=${provider}&date=2030-07-10&episode_id=${episode}`)
  await expect(page).toHaveURL(/\/consultation-booking\/date-time\?/)
  await expect(page.getByRole('heading', {name: 'Checking your selected doctor', exact: true})).toBeVisible()
  await expect.poll(() => control.slotReads).toBe(1)
  await expect(page.getByRole('button', {name: 'Continue', exact: true})).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', {name: 'Choose Your Appointment', exact: true})).toBeVisible()
  await expect(page.getByLabel('Appointment date', {exact: true})).toHaveValue('2030-07-10')
  await page.getByRole('button', {name: 'Continue', exact: true}).click()
  await expect(page).toHaveURL(/\/consultation-booking\/intake\?/)
  const url = new URL(page.url())
  expect(url.searchParams.get('provider_id')).toBe(provider)
  expect(url.searchParams.get('episode_id')).toBe(episode)
  expect(url.searchParams.get('start_at')).toBe('2030-07-10T07:00:00+00:00')
})

test('physician service cards do not invent a currency or approved quote from a legacy price', async ({page, context}) => {
  await bookingFixtures(context)
  await page.goto(`/patient/physicians/${provider}`)
  const service = page.locator('.pp-service-grid').getByRole('link', {name: /Video consultation/})
  await expect(service).toContainText('Pricing pending setup')
  await expect(service).toContainText('Duration: 30 min')
  await expect(service).not.toContainText('$33')
})

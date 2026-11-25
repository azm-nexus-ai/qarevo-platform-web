import { test, expect, type BrowserContext } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

// Synthetic provider and practice; no real person or address.
const provider = '3f2a1c9e-7b4d-4e21-9a0b-5c6d7e8f9012'
const token = 'PyocnntNTiGaC1xtfo-QEg'
const location = { address: 'Teststraße 12, 10115 Berlin, Germany', practiceName: 'Synthetic Practice', city: 'Berlin', country: 'Germany', latitude: 52.53212, longitude: 13.38499, directions: '', parking: '', accessibility: '' }
const doctor = (withCoordinates = true) => ({
  id: provider, name: 'Dr. Anna-Lena Müller', specialty: 'General medicine', hospital: 'Synthetic Practice', imageUrl: null, consultationFee: 0,
  experienceYears: 5, rating: 0, reviews: 0, languages: ['German'], insurance: [], gender: 'female', consultationTypes: ['video'], distanceKm: null,
  conditions: [], verification: 'Verified', tags: [], services: [{ type: 'video', duration: '30 min', price: 0 }],
  profile: { services: [{ type: 'video', label: 'Video consultation', duration: '30 min', price: 0, availability: 'By appointment' }], availabilitySlots: [],
    location: withCoordinates ? location : { ...location, latitude: null, longitude: null } },
})

async function prepare(context: BrowserContext, withCoordinates = true) {
  const identity = await seedPortalSession(context, 'patient')
  const thirdParty: string[] = []
  const reads: string[] = []
  await context.route(/^https:\/\/([a-z]\.)?tile\.openstreetmap\.org\//, route => { thirdParty.push(route.request().url()); return route.fulfill({ status: 204 }) })
  await context.route('https://nominatim.openstreetmap.org/**', route => { thirdParty.push(route.request().url()); return route.fulfill({ json: [] }) })
  await context.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/browser-csrf') return route.fallback()
    if (path.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(identity) })
    if (path === `/api/v1/patient/doctors/${provider}`) { reads.push(path); return route.fulfill({ json: doctor(withCoordinates) }) }
    if (path === '/api/v1/patient/profile-image') return route.fulfill({ json: { image: null } })
    if (path === '/api/v1/patient/settings') return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return { thirdParty, reads }
}

test('an older UUID link is replaced by the readable slug and keeps the booking query', async ({ page, context }) => {
  const { reads } = await prepare(context)
  await page.goto(`/patient/physicians/${provider}?from=dashboard&intent=book`)
  await expect(page.getByRole('heading', { level: 1, name: 'Dr. Anna-Lena Müller' })).toBeVisible()
  await expect(page).toHaveURL(`/patient/physicians/dr-anna-lena-mueller--${token}?from=dashboard&intent=book`)
  expect(reads).toHaveLength(1)
})

test('a slug with an outdated name part still opens the same physician', async ({ page, context }) => {
  await prepare(context)
  await page.goto(`/patient/physicians/dr-previous-name--${token}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Dr. Anna-Lena Müller' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/patient/physicians/dr-anna-lena-mueller--${token}$`))
})

test('a meaningless or malformed physician address is refused without calling the API', async ({ page, context }) => {
  const { reads } = await prepare(context)
  await page.goto('/patient/physicians/42')
  await expect(page.getByText('This physician link is not valid. Find the physician again from the search.')).toBeVisible()
  expect(reads).toHaveLength(0)
})

test('the map loads nothing from a third party until the patient asks for it', async ({ page, context }) => {
  const { thirdParty } = await prepare(context)
  await page.goto(`/patient/physicians/dr-anna-lena-mueller--${token}`)
  await expect(page.getByText('Teststraße 12, 10115 Berlin, Germany')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open in OpenStreetMap/ })).toHaveAttribute('rel', 'noopener noreferrer')
  await page.waitForTimeout(500)
  expect(thirdParty).toEqual([])
  await page.getByRole('button', { name: 'Show map', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Map showing the practice of Dr. Anna-Lena Müller' })).toBeVisible()
  await expect.poll(() => thirdParty.filter(url => url.includes('tile.openstreetmap.org')).length).toBeGreaterThan(0)
  expect(thirdParty.some(url => url.includes('nominatim'))).toBe(false)
})

test('without confirmed coordinates there is no map and no geocoding', async ({ page, context }) => {
  const { thirdParty } = await prepare(context, false)
  await page.goto(`/patient/physicians/dr-anna-lena-mueller--${token}`)
  await expect(page.getByText('A map appears here once the practice has confirmed its location.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show map' })).toHaveCount(0)
  await page.waitForTimeout(500)
  expect(thirdParty).toEqual([])
})

for (const width of [375, 1280]) test(`the profile header scrolls with the page at ${width}px`, async ({ page, context }) => {
  await prepare(context)
  await page.setViewportSize({ width, height: 800 })
  await page.goto(`/patient/physicians/dr-anna-lena-mueller--${token}`)
  const heading = page.getByRole('heading', { level: 1, name: 'Dr. Anna-Lena Müller' })
  await expect(heading).toBeVisible()
  const header = heading.locator('xpath=ancestor::header[1]')
  expect(await header.evaluate(node => getComputedStyle(node).position)).not.toBe('sticky')
  await page.mouse.wheel(0, 1600)
  await expect.poll(() => header.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

test('the profile shows only what the physician supplied, and reads in German', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL! }])
  await prepare(context)
  await page.goto(`/patient/physicians/dr-anna-lena-mueller--${token}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Dr. Anna-Lena Müller' })).toBeVisible()
  // Nothing invented: no training, career, biography, response time or questions the physician never supplied.
  await expect(page.getByText(/Medical Degree|Residency|Consultant Physician|evidence-based|Response time|Antwortzeit|Within 24 hours/)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Ausbildung|Education|Berufserfahrung|Häufige Fragen|Ähnliche/ })).toHaveCount(0)
  await expect(page.getByText('Für dieses Profil gibt es noch keine Beschreibung.')).toBeVisible()
  await expect(page.getByText('5 Jahre Erfahrung', { exact: false })).toBeVisible()
  await expect(page.locator('.pp-service-grid')).toContainText('Dauer: 30 min')
  await expect(page.getByText('Zeitzone: Nicht festgelegt')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Karte anzeigen', exact: true })).toBeVisible()
})

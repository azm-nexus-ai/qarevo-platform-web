import { test, expect, type BrowserContext } from '@playwright/test'

// Public pages: German by default, honest content, and no invented usage figures in either language.
async function offline(context: BrowserContext) {
  await context.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } }))
}

test.describe('without a stored language', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the landing page, footer and support read in German', async ({ page, context }) => {
    await offline(context)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /Versorgung, die zu Ihrem Leben passt/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ein Ort zur Vorbereitung Ihrer Behandlung' })).toBeVisible()
    const footer = page.getByRole('navigation', { name: 'Rechtliches und Support' })
    await expect(footer.getByRole('link', { name: 'Datenschutz' })).toBeVisible()
    await expect(footer.getByRole('button', { name: 'Cookie-Einstellungen' })).toBeVisible()
    await page.goto('/support')
    await expect(page.getByRole('heading', { name: 'Hilfe und Support' })).toBeVisible()
    await expect(page.getByText('Ich kann mich nicht anmelden')).toBeVisible()
    await page.getByLabel('Hilfeartikel durchsuchen').fill('Sprechstunde')
    await expect(page.getByText('Ich kann meiner Sprechstunde nicht beitreten')).toBeVisible()
    await expect(page.getByText('Ich kann mich nicht anmelden')).toHaveCount(0)
  })

  test('the welcome page states no invented usage figures', async ({ page, context }) => {
    await offline(context)
    await page.goto('/auth')
    await expect(page.getByRole('heading', { name: /Willkommen bei/ })).toBeVisible()
    await expect(page.getByText(/180K|180,000|4,200|98%|12% this month/)).toHaveCount(0)
    await expect(page.getByText(/Entwicklungsvorschau mit synthetischen Testdaten/)).toBeVisible()
  })
})

test('the welcome page states no invented usage figures in English either', async ({ page, context }) => {
  await offline(context)
  await page.goto('/auth')
  await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible()
  await expect(page.getByText(/180K|180,000|4,200|98%|12% this month|Active Patients/)).toHaveCount(0)
})

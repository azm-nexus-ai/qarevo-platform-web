import { test, expect } from '@playwright/test'

// German is the default without a stored choice (ADR-0002); the rest of the suite seeds English.
test.describe('without a stored language', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a fresh browser gets German and can switch to English, which persists', async ({ page, context }) => {
    await context.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } }))
    await page.goto('/auth/sign-in')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    const language = page.getByRole('group', { name: 'Sprache' })
    await expect(language.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^(Dunkles|Helles) Design$/ })).toBeVisible()

    await language.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^(Dark|Light) mode$/ })).toBeVisible()
    expect((await context.cookies()).find(cookie => cookie.name === 'qarevo_locale')?.value).toBe('en')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })

  test('an unknown stored value falls back to German', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'qarevo_locale', value: 'fr', url: baseURL! }])
    await context.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } }))
    await page.goto('/auth/sign-in')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })
})

test('the language switch is keyboard operable and fits 320px', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await context.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } }))
  await page.goto('/auth/sign-in')
  const german = page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' })
  await german.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

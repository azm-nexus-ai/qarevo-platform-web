import { expect, test } from '@playwright/test'

test('a screen can open help on the billing article, and search finds it in both languages', async ({ page, context, baseURL }) => {
  await page.goto('/support?q=fee%20codes')
  const articles = page.getByRole('region', { name: 'Help articles', exact: true })
  await expect(page.getByRole('searchbox')).toHaveValue('fee codes')
  await expect(articles.getByText('How does billing work for doctors?', { exact: true })).toBeVisible()
  await expect(articles.locator('summary')).toHaveCount(1)
  await page.getByRole('searchbox').fill('billing')
  await expect(articles.getByText('What will my appointment cost, and where do I find invoices?', { exact: true })).toBeVisible()
  await expect(articles.getByText('How does billing work for doctors?', { exact: true })).toBeVisible()

  await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL! }])
  await page.goto('/support?q=Rechnung')
  await expect(page.getByText('Was kostet mein Termin und wo finde ich Rechnungen?', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('billing')
  await expect(page.getByText('Wie funktioniert die Abrechnung für Ärztinnen und Ärzte?', { exact: true })).toBeVisible()
})

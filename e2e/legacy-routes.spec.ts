import { test, expect } from '@playwright/test'

// The old /appointment prototype showed made-up appointments; it now leads to the patient portal.
test('the old appointment prototype route leads to the patient portal', async ({ page, context }) => {
  await context.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }))
  await page.goto('/appointment')
  await expect(page).toHaveURL(/\/(patient\/appointments|auth\/sign-in)/)
  await expect(page.getByText('Dr. Sarah Wilson')).toHaveCount(0)
})

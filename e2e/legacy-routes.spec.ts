import { test, expect } from '@playwright/test'

// The old /appointment prototype showed made-up appointments; it now leads to the patient portal.
test('the old appointment prototype route leads to the patient portal', async ({ page, context }) => {
  await context.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }))
  await page.goto('/appointment')
  await expect(page).toHaveURL(/\/(patient\/appointments|auth\/sign-in)/)
  await expect(page.getByText('Dr. Sarah Wilson')).toHaveCount(0)
})

test('pages and BFF routes carry the baseline security headers', async ({ page, request }) => {
  const response = await page.goto('/auth/sign-in')
  const headers = response!.headers()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('SAMEORIGIN')
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'")
  expect(headers['permissions-policy']).toContain('camera=(self)')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  const api = await request.get('/api/health/live')
  expect(api.headers()['x-content-type-options']).toBe('nosniff')
})

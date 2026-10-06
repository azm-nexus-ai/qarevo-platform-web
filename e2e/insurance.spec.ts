import { test, expect } from '@playwright/test'

test.describe('Insurance Type Integration', () => {
  test('patient settings includes insurance type field', async ({ page }) => {
    // Sign in as patient
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/patient/dashboard')
    
    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForURL('/patient/settings')
    
    // Scroll to insurance section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Verify insurance type selector exists
    const insuranceTypeSelect = page.locator('select').filter({ hasText: /Self Pay|GKV|PKV/ })
    await expect(insuranceTypeSelect).toBeVisible()
    
    // Verify options
    const options = await insuranceTypeSelect.locator('option').allTextContents()
    expect(options).toContain('Self Pay (Private)')
    expect(options).toContain('Statutory (GKV)')
    expect(options).toContain('Private (PKV)')
  })

  test('insurance type can be updated', async ({ page, request }) => {
    // Sign in as patient
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/patient/dashboard')
    
    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForURL('/patient/settings')
    
    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('qarevo_access_token'))
    
    // Update insurance type via API
    const response = await request.put('/api/v1/patient/settings/insurance', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        insurance_type: 'GKV',
        insurance_provider_name: 'Test Insurance',
        insurance_number: '123456789'
      }
    })
    
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.insurance_type).toBe('GKV')
  })
})

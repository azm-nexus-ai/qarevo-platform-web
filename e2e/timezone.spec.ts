import { test, expect } from '@playwright/test'

test.describe('Timezone Integration', () => {
  test('patient timezone is fetched from API', async ({ page, request }) => {
    // Sign in as patient
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/patient/dashboard')
    
    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('qarevo_access_token'))
    
    // Verify timezone API endpoint
    const response = await request.get('/api/v1/patient/settings/timezone', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty('time_zone')
    expect(data.time_zone).toMatch(/^[A-Za-z]+\/[A-Za-z_]+$/) // IANA timezone format
  })

  test('appointment booking uses timezone from API', async ({ page }) => {
    // Sign in as patient
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/patient/dashboard')
    
    // Navigate to booking
    await page.click('text=Book Consultation')
    await page.waitForURL('/patient/consultation-booking')
    
    // Verify timezone is loaded (check for timezone display or API call)
    const timezoneLoaded = await page.evaluate(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const hasTimezone = window.localStorage.getItem('qarevo_timezone') !== null
          resolve(hasTimezone)
        }, 1000)
      })
    })
    
    expect(timezoneLoaded).toBeTruthy()
  })
})

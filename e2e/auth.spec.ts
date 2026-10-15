import { test, expect } from '@playwright/test'

test.describe('Authentication & RBAC', () => {
  test('patient sign in and role verification', async ({ page }) => {
    await page.goto('/auth/sign-in')
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should redirect to patient dashboard
    await page.waitForURL('/patient/dashboard')
    await expect(page).toHaveURL('/patient/dashboard')
    
    // Verify role is stored in localStorage
    const role = await page.evaluate(() => localStorage.getItem('qarevo_role'))
    expect(role).toBe('PATIENT')
  })

  test('patient cannot access doctor routes', async ({ page }) => {
    // Sign in as patient
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/patient/dashboard')
    
    // Try to access doctor route
    await page.goto('/doctor/dashboard')
    
    // Should redirect to sign-in
    await page.waitForURL('/auth/sign-in')
    await expect(page).toHaveURL('/auth/sign-in')
  })

  test('doctor sign in and role verification', async ({ page }) => {
    await page.goto('/auth/doctor/login')
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'doctor@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should redirect to doctor dashboard
    await page.waitForURL('/doctor/dashboard')
    await expect(page).toHaveURL('/doctor/dashboard')
    
    // Verify role is stored in localStorage
    const role = await page.evaluate(() => localStorage.getItem('qarevo_role'))
    expect(role).toBe('PROVIDER')
  })

  test('doctor cannot access patient routes', async ({ page }) => {
    // Sign in as doctor
    await page.goto('/auth/doctor/login')
    await page.fill('input[type="email"]', 'doctor@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/doctor/dashboard')
    
    // Try to access patient route
    await page.goto('/patient/dashboard')
    
    // Should redirect to sign-in
    await page.waitForURL('/auth/sign-in')
    await expect(page).toHaveURL('/auth/sign-in')
  })
})

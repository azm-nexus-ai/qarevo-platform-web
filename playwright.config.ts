import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
// The product defaults to German (ADR-0002). The existing suite asserts English text, so every
// context starts with the English choice; specs that test German or the default override it.
export const ENGLISH = { cookies: [{ name: 'qarevo_locale', value: 'en', domain: new URL(baseURL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }], origins: [] }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    storageState: ENGLISH,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER === '1' ? undefined : {
    command: process.env.E2E_PRODUCTION === '1'
      ? 'npm exec next -- start --hostname 127.0.0.1 --port 3100'
      : 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})

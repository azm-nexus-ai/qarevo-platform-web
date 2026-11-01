import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
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

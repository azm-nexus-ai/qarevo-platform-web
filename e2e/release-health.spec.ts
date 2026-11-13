import { expect, test } from '@playwright/test'

test('public frontend liveness is uncached and exposes only the built source identity', async ({ request }) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request.get('/api/health/live', { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('no-store, max-age=0')
    expect(response.headers()['cdn-cache-control']).toBe('no-store')
    expect(response.headers()['set-cookie']).toBeUndefined()
    const body = await response.json()
    expect(Object.keys(body).sort()).toEqual(['revision', 'scope', 'status'])
    expect(body.status).toBe('alive')
    expect(body.scope).toBe('frontend_liveness')
    if (body.revision !== null) expect(body.revision).toMatch(/^[0-9a-f]{40}$/)
    const expected = process.env.E2E_EXPECTED_BUILD_REVISION ?? process.env.QAREVO_BUILD_REVISION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA
    if (expected !== undefined) expect(body.revision).toBe(/^[0-9a-f]{40}$/.test(expected) ? expected : null)
    expect(JSON.stringify(body)).not.toMatch(/database|patient|token|secret|ready/i)
  }
})

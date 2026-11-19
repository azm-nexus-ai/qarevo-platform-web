import type { BrowserContext } from '@playwright/test'

export type TestPortal = 'patient' | 'doctor' | 'admin'
export type TestPortalIdentity = {
  user_id: string
  role: 'PATIENT' | 'PROVIDER' | 'ADMIN'
  session_id: string
  provider_id?: string
}

/** Synthetic browser metadata only: real access and refresh tokens belong in HttpOnly cookies. */
export async function seedPortalSession(context: BrowserContext, portal: TestPortal, details: Partial<TestPortalIdentity> = {}) {
  const identity: TestPortalIdentity = {
    user_id: `synthetic-${portal}-user`,
    role: { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN' }[portal] as TestPortalIdentity['role'],
    session_id: `synthetic-${portal}-session`,
    ...(portal === 'doctor' ? { provider_id: 'synthetic-doctor-provider' } : {}),
    ...details,
  }
  await context.addInitScript(({ portal, identity }) => {
    const seedMarker = `qarevo:test:seeded:${portal}`
    if (sessionStorage.getItem(seedMarker)) return
    localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify(identity))
    sessionStorage.setItem('qarevo:active-portal', portal)
    sessionStorage.setItem(seedMarker, 'true')
  }, { portal, identity })
  await context.route('**/api/v1/browser-csrf', route => route.fulfill({ json: { csrf_token: 'synthetic-browser-test-csrf' } }))
  return identity
}

export function testSessionTiming(identity: TestPortalIdentity) {
  return {
    server_time: new Date().toISOString(),
    idle_expires_at: new Date(Date.now() + 900_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 28_800_000).toISOString(),
    warning_seconds: 120,
    idle_timeout_seconds: 900,
    browser_session: identity,
  }
}

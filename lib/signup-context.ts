import { currentPortal, portalKey, type Portal } from './portal-scope'

const SIGNUP_TTL_MS = 30 * 60 * 1000
export const signupContextKey = (portal = currentPortal()) => portalKey('signup:v2', portal)

/** Only the verification destination is kept, in this tab, for a bounded time. */
export function storeSignupEmail(value: string, portal: Portal = currentPortal()) {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid verification email address.')
  window.sessionStorage.setItem(signupContextKey(portal), JSON.stringify({ email, expires_at: Date.now() + SIGNUP_TTL_MS }))
}

export function readSignupEmail(portal: Portal = currentPortal()): string {
  if (typeof window === 'undefined') return ''
  const key = signupContextKey(portal)
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || 'null')
    if (!value || typeof value.email !== 'string' || value.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || typeof value.expires_at !== 'number' ||
      !Number.isFinite(value.expires_at) || value.expires_at <= Date.now() || value.expires_at > Date.now() + SIGNUP_TTL_MS) {
      window.sessionStorage.removeItem(key)
      return ''
    }
    return value.email.trim().toLowerCase()
  } catch { return '' }
}

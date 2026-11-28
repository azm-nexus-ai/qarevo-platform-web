import { currentPortal, rememberPortal, type PortalIdentity } from '@/lib/portal-scope'
import { safePortalDestination } from '@/lib/portal-handoff'
import { apiGet, apiPost } from '@/lib/api'
export type SocialProvider = 'google' | 'microsoft' | 'apple'
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ['google', 'microsoft', 'apple']
export type SocialPortal = 'PATIENT' | 'PROVIDER'
export type SocialAvailability = Record<SocialProvider, { enabled: boolean; message: string | null }>
export type SocialProfile = { provider: SocialProvider; email: string; email_verified: boolean; first_name: string; last_name: string; expires: number }
const TRANSACTION = 'qarevo.social.transaction'
const PROFILE = 'qarevo.social.profile'
const HOSTS: Record<SocialProvider, string> = { google: 'accounts.google.com', microsoft: 'login.microsoftonline.com', apple: 'appleid.apple.com' }
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
export async function socialProviders() {
  const portal = currentPortal()
  if (portal === 'admin' || portal === 'practice') {
    const off = { enabled: false, message: null }
    return { google: off, microsoft: off, apple: off }
  }
  return socialAvailability(await apiGet<unknown>(`/api/v1/auth/social/providers?portal=${portal === 'doctor' ? 'PROVIDER' : 'PATIENT'}`))
}
/** A malformed answer is an unavailable provider check, never a crashed sign-in page. */
export function socialAvailability(value: unknown): SocialAvailability {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const one = (item: unknown) => {
    const entry = item && typeof item === 'object' ? item as Record<string, unknown> : null
    if (!entry || typeof entry.enabled !== 'boolean') return null
    return { enabled: entry.enabled, message: typeof entry.message === 'string' ? entry.message.slice(0, 300) : null }
  }
  const google = one(row?.google), apple = one(row?.apple)
  if (!google || !apple) throw new Error('Sign-in provider availability could not be verified.')
  // An API without Microsoft support simply reports it as unavailable.
  return { google, apple, microsoft: one(row?.microsoft) ?? { enabled: false, message: null } }
}
export async function beginSocial(provider: SocialProvider, portal: SocialPortal, currentPassword?: string, canContinue: () => boolean = () => true) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  if (!canContinue()) return
  const linking = currentPassword !== undefined
  const result = await apiPost<{ authorization_url: string; state: string; expires_in: number }>(`/api/v1/auth/social/${provider}/${linking ? 'link/' : ''}start`, { portal, challenge, ...(linking ? { current_password: currentPassword } : {}) })
  if (!canContinue()) return
  const destination = new URL(result.authorization_url)
  if (destination.protocol !== 'https:' || destination.hostname !== HOSTS[provider]) throw new Error('Unexpected sign-in provider destination.')
  let callback: URL
  try { callback = new URL(destination.searchParams.get('redirect_uri') || '') }
  catch { throw new Error('The sign-in provider returned an invalid callback URL. Ask the administrator to correct this environment’s provider configuration.') }
  const expectedPath = provider === 'apple' ? '/auth/social/callback/apple' : '/auth/social/callback'
  if (callback.origin !== window.location.origin || callback.pathname !== expectedPath || callback.search || callback.hash) throw new Error('This sign-in provider is configured for a different environment. Use the matching web site and API, or ask the administrator to correct the callback origin.')
  sessionStorage.setItem(TRANSACTION, JSON.stringify({ verifier, state: result.state, provider, portal, linking, intended: safePortalDestination(new URLSearchParams(window.location.search).get('next'), portal), expires: Date.now() + Math.min(result.expires_in, 300) * 1000 }))
  window.location.assign(destination.href)
}
export type SocialResult = {
  intended?: string | null; connected?: boolean; provider?: SocialProvider; browser_session?: PortalIdentity; role?: SocialPortal
  mfa_pending?: boolean; identifier?: string; user_id?: string
  registration_required?: boolean; profile?: { email?: string; email_verified?: boolean; first_name?: string; last_name?: string }; expires_in?: number
}
export async function finishSocial(code: string, state: string) {
  const raw = sessionStorage.getItem(TRANSACTION)
  sessionStorage.removeItem(TRANSACTION)
  if (!raw) throw new Error('This sign-in request is missing. Start again in this browser tab.')
  const saved = JSON.parse(raw)
  if (saved.state !== state || saved.expires <= Date.now() || !SOCIAL_PROVIDERS.includes(saved.provider) || !['PATIENT','PROVIDER'].includes(saved.portal)) throw new Error('This sign-in request expired or does not match this browser tab. Start again.')
  rememberPortal(saved.portal === 'PROVIDER' ? 'doctor' : 'patient')
  const result = await apiPost<SocialResult>(`/api/v1/auth/social/${saved.provider}/${saved.linking ? 'link/' : ''}finish`, { code, state, verifier: saved.verifier })
  if (result.role && result.role !== saved.portal) throw new Error('The sign-in portal does not match this account.')
  return { ...result, provider: saved.provider as SocialProvider, intended: safePortalDestination(saved.intended || null, saved.portal) }
}
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
/** Non-secret details shown to pre-fill registration; the ticket itself stays in an HttpOnly cookie. */
export function saveSocialProfile(result: SocialResult) {
  const profile: SocialProfile = { provider: result.provider ?? 'google', email: text(result.profile?.email, 320), email_verified: result.profile?.email_verified === true,
    first_name: text(result.profile?.first_name, 100), last_name: text(result.profile?.last_name, 100), expires: Date.now() + Math.min(result.expires_in ?? 1800, 1800) * 1000 }
  sessionStorage.setItem(PROFILE, JSON.stringify(profile))
}
export function readSocialProfile(): SocialProfile | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PROFILE) || 'null') as SocialProfile | null
    if (!value || value.expires <= Date.now() || !SOCIAL_PROVIDERS.includes(value.provider)) { sessionStorage.removeItem(PROFILE); return null }
    return value
  } catch { return null }
}
export async function cancelSocialRegistration() {
  sessionStorage.removeItem(PROFILE)
  try { await apiPost('/api/v1/auth/social/registration/cancel', {}) } catch { /* the cookie also expires on its own */ }
}
export function clearSocialProfile() { sessionStorage.removeItem(PROFILE) }

import { rememberPortal, type PortalIdentity } from '@/lib/portal-scope'
import { safePortalDestination } from '@/lib/portal-handoff'
import { apiGet, apiPost } from '@/lib/api'
export type SocialProvider = 'google' | 'apple'
export type SocialPortal = 'PATIENT' | 'PROVIDER'
export type SocialAvailability = Record<SocialProvider, { enabled: boolean; message: string | null }>
const TRANSACTION = 'qarevo.social.transaction'
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
export async function socialProviders() { return apiGet<SocialAvailability>('/api/v1/auth/social/providers') }
export async function beginSocial(provider: SocialProvider, portal: SocialPortal, currentPassword?: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const linking = currentPassword !== undefined
  const result = await apiPost<{ authorization_url: string; state: string; expires_in: number }>(`/api/v1/auth/social/${provider}/${linking ? 'link/' : ''}start`, { portal, challenge, ...(linking ? { current_password: currentPassword } : {}) })
  const destination = new URL(result.authorization_url)
  if (destination.protocol !== 'https:' || destination.hostname !== (provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com')) throw new Error('Unexpected sign-in provider destination.')
  let callback: URL
  try { callback = new URL(destination.searchParams.get('redirect_uri') || '') }
  catch { throw new Error('The sign-in provider returned an invalid callback URL. Ask the administrator to correct this environment’s provider configuration.') }
  const expectedPath = provider === 'google' ? '/auth/social/callback' : '/auth/social/callback/apple'
  if (callback.origin !== window.location.origin || callback.pathname !== expectedPath || callback.search || callback.hash) throw new Error('This sign-in provider is configured for a different environment. Use the matching web site and API, or ask the administrator to correct the callback origin.')
  sessionStorage.setItem(TRANSACTION, JSON.stringify({ verifier, state: result.state, provider, portal, linking, intended: safePortalDestination(new URLSearchParams(window.location.search).get('next'), portal), expires: Date.now() + Math.min(result.expires_in, 300) * 1000 }))
  window.location.assign(destination.href)
}
export type SocialResult = { intended?: string | null; connected?: boolean; provider?: SocialProvider; browser_session?: PortalIdentity; role?: SocialPortal; mfa_pending?: boolean; identifier?: string; user_id?: string }
export async function finishSocial(code: string, state: string) {
  const raw = sessionStorage.getItem(TRANSACTION)
  sessionStorage.removeItem(TRANSACTION)
  if (!raw) throw new Error('This sign-in request is missing. Start again in this browser tab.')
  const saved = JSON.parse(raw)
  if (saved.state !== state || saved.expires <= Date.now() || !['google','apple'].includes(saved.provider) || !['PATIENT','PROVIDER'].includes(saved.portal)) throw new Error('This sign-in request expired or does not match this browser tab. Start again.')
  rememberPortal(saved.portal === 'PROVIDER' ? 'doctor' : 'patient')
  const result = await apiPost<SocialResult>(`/api/v1/auth/social/${saved.provider}/${saved.linking ? 'link/' : ''}finish`, { code, state, verifier: saved.verifier })
  if (result.role && result.role !== saved.portal) throw new Error('The sign-in portal does not match this account.')
  return { ...result, intended: safePortalDestination(saved.intended || null, saved.portal) }
}

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
  sessionStorage.setItem(TRANSACTION, JSON.stringify({ verifier, state: result.state, provider, portal, linking, expires: Date.now() + Math.min(result.expires_in, 300) * 1000 }))
  window.location.assign(destination.href)
}
export type SocialResult = { connected?: boolean; provider?: SocialProvider; access_token?: string; refresh_token?: string; role?: SocialPortal; temp_token?: string; identifier?: string; user_id?: string }
export async function finishSocial(code: string, state: string) {
  const raw = sessionStorage.getItem(TRANSACTION)
  sessionStorage.removeItem(TRANSACTION)
  if (!raw) throw new Error('This sign-in request is missing. Start again in this browser tab.')
  const saved = JSON.parse(raw)
  if (saved.state !== state || saved.expires <= Date.now() || !['google','apple'].includes(saved.provider) || !['PATIENT','PROVIDER'].includes(saved.portal)) throw new Error('This sign-in request expired or does not match this browser tab. Start again.')
  const result = await apiPost<SocialResult>(`/api/v1/auth/social/${saved.provider}/${saved.linking ? 'link/' : ''}finish`, { code, state, verifier: saved.verifier })
  if (result.role && result.role !== saved.portal) throw new Error('The sign-in portal does not match this account.')
  return result
}

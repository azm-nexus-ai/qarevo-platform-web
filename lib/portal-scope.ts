export type Portal = 'patient' | 'doctor' | 'admin'
export type PortalIdentity = { user_id: string; role: 'PATIENT' | 'PROVIDER' | 'ADMIN'; session_id: string; provider_id?: string | null }
export const PORTALS: Portal[] = ['patient', 'doctor', 'admin']
const TAB_PORTAL = 'qarevo:active-portal'

export function portalFromPath(path: string): Portal | null {
  if (/^\/(?:admin|auth\/admin)(?:\/|$)/.test(path)) return 'admin'
  if (/^\/(?:doctor|auth\/doctor)(?:\/|$)|^\/auth\/doctor-(?:register|verify-email|verify-phone)(?:\/|$)/.test(path)) return 'doctor'
  if (/^\/(?:patient|auth\/(?:sign-in|sign-up|profile-setup|otp|verify-email|account-created|welcome))(?:\/|$)/.test(path)) return 'patient'
  return null
}
export function currentPortal(): Portal {
  if (typeof window === 'undefined') return 'patient'
  const host = window.location.hostname.split('.')[0]
  if (PORTALS.includes(host as Portal)) return host as Portal
  const byPath = portalFromPath(window.location.pathname)
  if (byPath) return byPath
  try {
    const saved = window.sessionStorage.getItem(TAB_PORTAL)
    if (PORTALS.includes(saved as Portal)) return saved as Portal
  } catch { /* Optional tab context. */ }
  return 'patient'
}
export function rememberPortal(portal = currentPortal()) {
  try { window.sessionStorage.setItem(TAB_PORTAL, portal) } catch { /* Optional tab context. */ }
}
export const portalKey = (name: string, portal = currentPortal()) => `qarevo:${portal}:${name}`
export function readPortalIdentity(portal = currentPortal()): PortalIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.localStorage.getItem(portalKey('identity', portal)) || 'null')
    const role = {patient:'PATIENT',doctor:'PROVIDER',admin:'ADMIN'}[portal]
    if (!value || value.role !== role || typeof value.user_id !== 'string' || !value.user_id || typeof value.session_id !== 'string' || !value.session_id) return null
    return value
  } catch { return null }
}
export function isPortalEvent(event: Event, portal = currentPortal()) {
  if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent) return event.key === null || event.key.startsWith(`qarevo:${portal}:`)
  const target = (event as CustomEvent<{portal?: Portal}>).detail?.portal
  return !target || target === portal
}
/** Retire old shared credentials; never migrate them into new JS storage. */
export function retireLegacyCredentials() {
  if (typeof window === 'undefined') return
  for (const key of ['qarevo_access_token','qarevo_refresh_token','qarevo_token_type','qarevo_expires_in','qarevo_role','qarevo_user_id','qarevo_provider_id','qarevo_session_revision','doctor_temp_token','doctor_identifier','qarevo_temp_token','qarevo_temp_auth','qarevo_refresh_retry_after']) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  }
}

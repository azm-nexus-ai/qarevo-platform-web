export type Portal = 'patient' | 'doctor' | 'admin' | 'practice'
export type PortalIdentity = { user_id: string; role: 'PATIENT' | 'PROVIDER' | 'ADMIN' | 'PRACTICE'; session_id: string; provider_id?: string | null }
export const PORTAL_DEFINITIONS = {
  patient: { role: 'PATIENT', signIn: '/auth/sign-in', home: '/patient/dashboard' },
  doctor: { role: 'PROVIDER', signIn: '/auth/doctor/login', home: '/doctor/dashboard' },
  admin: { role: 'ADMIN', signIn: '/auth/admin/login', home: '/admin/dashboard' },
  practice: { role: 'PRACTICE', signIn: '/auth/practice/login', home: '/practice/dashboard' },
} as const
export const PORTALS = Object.keys(PORTAL_DEFINITIONS) as Portal[]
export const protectedPortalPath = (path: string) => /^\/(patient|doctor|admin|practice)(\/|$)|^\/auth\/profile-setup(\/|$)/.test(path)
export const PORTAL_PATH_PREFIXES: Record<Portal, readonly string[]> = {
  patient: ['/patient', '/auth/sign-in', '/auth/sign-up', '/auth/forgot-password', '/auth/reset-password', '/auth/profile-setup', '/auth/otp', '/auth/verify-email', '/auth/account-created', '/auth/welcome'],
  doctor: ['/doctor', '/auth/doctor', '/auth/doctor-register', '/auth/doctor-verify-email', '/auth/doctor-verify-phone'],
  admin: ['/admin', '/auth/admin'],
  practice: ['/practice', '/auth/practice'],
}
const TAB_PORTAL = 'qarevo:active-portal'

export function portalFromPath(path: string): Portal | null {
  return PORTALS.find(portal => PORTAL_PATH_PREFIXES[portal].some(prefix => path === prefix || path.startsWith(prefix + '/'))) || null
}
export function currentPortal(pathname?: string): Portal {
  if (typeof window === 'undefined') return 'patient'
  const host = window.location.hostname.split('.')[0]
  if (PORTALS.includes(host as Portal)) return host as Portal
  const byPath = portalFromPath(pathname ?? window.location.pathname)
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
    const role = PORTAL_DEFINITIONS[portal].role
    if (!value || value.role !== role || typeof value.user_id !== 'string' || !value.user_id || typeof value.session_id !== 'string' || !value.session_id) return null
    return value
  } catch { return null }
}
export function isPortalEvent(event: Event, portal = currentPortal()) {
  if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent) return event.key === null || event.key.startsWith(`qarevo:${portal}:`)
  const target = (event as CustomEvent<{portal?: Portal}>).detail?.portal
  return !target || target === portal
}
/** Identity listeners must not reload profiles for theme or renewal preferences. */
export function isPortalIdentityEvent(event: Event, portal = currentPortal()) {
  if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent) return event.key === null || event.key === portalKey('identity', portal)
  return isPortalEvent(event, portal)
}
/** Retire old shared credentials; never migrate them into new JS storage. */
export function retireLegacyCredentials() {
  if (typeof window === 'undefined') return
  for (const key of ['qarevo_access_token','qarevo_refresh_token','qarevo_token_type','qarevo_expires_in','qarevo_role','qarevo_user_id','qarevo_provider_id','qarevo_session_revision','doctor_temp_token','doctor_identifier','qarevo_temp_token','qarevo_temp_auth','qarevo_refresh_retry_after']) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  }
}

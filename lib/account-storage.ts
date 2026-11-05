import { currentPortal, portalKey, readPortalIdentity, PORTALS, type Portal } from './portal-scope'

const DRAFT_PREFIX = 'qarevo.draft.v3:'
export const ACCOUNT_CHANGED = 'qarevo:account-changed'
const tabScopes = new Map<Portal, string | null>(PORTALS.map(portal => [portal, readAccountScope(portal)]))

function legacyPrivateKey(key: string) {
  return key.startsWith('qarevo.draft.v2:') || key.startsWith('qarevo.onboarding.') ||
    ['qarevo.auth.signup.v1','qarevo.auth.flow.v1','qarevo_booking_state'].includes(key)
}
export function clearPrivateBrowserState(portal = currentPortal()) {
  if (typeof window === 'undefined') return
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (legacyPrivateKey(key) || key.startsWith(`${DRAFT_PREFIX}${portal}:`) || key === portalKey('signup:v2', portal)) storage.removeItem(key)
    }
  }
}
export function readAccountScope(portal = currentPortal()): string | null {
  const identity = readPortalIdentity(portal)
  return identity ? JSON.stringify([portal, identity.user_id, identity.session_id]) : null
}
export function acknowledgePortalScope(portal = currentPortal()) {
  tabScopes.set(portal, readAccountScope(portal))
}
export function assertCurrentAccount(portal = currentPortal()) {
  if (typeof window === 'undefined') return
  if (!tabScopes.has(portal)) tabScopes.set(portal, readAccountScope(portal))
  if (tabScopes.get(portal) !== readAccountScope(portal)) throw new Error('Your account changed in another tab. Reload this page.')
}
export function accountChanged(portal = currentPortal()) {
  if (typeof window === 'undefined') return
  clearPrivateBrowserState(portal)
  tabScopes.set(portal, readAccountScope(portal))
  window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGED, {detail:{portal}}))
}
export function storePortalIdentity(identity: import('./portal-scope').PortalIdentity, portal = currentPortal()) {
  const expected = {patient:'PATIENT',doctor:'PROVIDER',admin:'ADMIN'}[portal]
  if(identity.role !== expected || !identity.user_id || !identity.session_id) throw new Error('This session does not belong to this portal.')
  const before = readAccountScope(portal)
  window.localStorage.setItem(portalKey('identity', portal), JSON.stringify(identity))
  if (before !== readAccountScope(portal)) accountChanged(portal)
}
export function createAccountDraftStorage() {
  const portal = currentPortal()
  const owner = readAccountScope(portal)
  const available = () => owner !== null && owner === readAccountScope(portal) && portal === currentPortal()
  const keyFor = (key: string) => `${DRAFT_PREFIX}${portal}:${owner}:${key}`
  return {
    getItem(key: string): string | null {
      if (typeof window === 'undefined') return null
      for (const storage of [window.localStorage, window.sessionStorage]) for (const item of Object.keys(storage)) if (legacyPrivateKey(item)) storage.removeItem(item)
      return available() ? window.sessionStorage.getItem(keyFor(key)) : null
    },
    setItem(key: string, value: string) {
      if (!available()) throw new Error('Your session changed. Sign in again before saving.')
      window.sessionStorage.setItem(keyFor(key), value)
    },
    removeItem(key: string) { if (available()) window.sessionStorage.removeItem(keyFor(key)) },
  }
}

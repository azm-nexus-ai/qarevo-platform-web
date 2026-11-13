'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ACCOUNT_CHANGED, assertCurrentAccount } from '@/lib/account-storage'
import { currentPortal, readPortalIdentity, PORTALS, PORTAL_DEFINITIONS, type Portal } from '@/lib/portal-scope'

export type PortalRole = Portal

/** Navigation context only; protected layouts and APIs still verify authority. */
export function currentPortalRole(portal: Portal = currentPortal()): PortalRole | null {
  try {
    assertCurrentAccount(portal)
    const role = readPortalIdentity(portal)?.role
    return PORTALS.find(candidate => PORTAL_DEFINITIONS[candidate].role === role) ?? null
  } catch { return null }
}
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed)
  window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
export function usePortalRole() {
  // Shared navigation survives client transitions. Bind its snapshot to Next's
  // canonical route instead of waiting for an unrelated identity/storage event.
  const portal = currentPortal(usePathname())
  const snapshot = useCallback(() => currentPortalRole(portal), [portal])
  return useSyncExternalStore(subscribe, snapshot, () => null)
}
export function portalHome(role: PortalRole | null) {
  return role ? PORTAL_DEFINITIONS[role].home : '/'
}
export function usePortalHome() { return portalHome(usePortalRole()) }

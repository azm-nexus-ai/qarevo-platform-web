'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ACCOUNT_CHANGED, assertCurrentAccount } from '@/lib/account-storage'
import { currentPortal, readPortalIdentity, type Portal } from '@/lib/portal-scope'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import { DOCTOR_ROUTES } from '@/constants/doctor-navigation'
import { ADMIN_ROUTES } from '@/constants/admin-navigation'

export type PortalRole = 'patient' | 'doctor' | 'admin'

/** Navigation context only; protected layouts and APIs still verify authority. */
export function currentPortalRole(portal: Portal = currentPortal()): PortalRole | null {
  try {
    assertCurrentAccount(portal)
    const role = readPortalIdentity(portal)?.role
    return role === 'PATIENT' ? 'patient' : role === 'PROVIDER' ? 'doctor' : role === 'ADMIN' ? 'admin' : null
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
  return role === 'patient' ? PATIENT_ROUTES.dashboard : role === 'doctor' ? DOCTOR_ROUTES.dashboard : role === 'admin' ? ADMIN_ROUTES.dashboard : '/'
}
export function usePortalHome() { return portalHome(usePortalRole()) }

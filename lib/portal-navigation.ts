'use client'

import { useSyncExternalStore } from 'react'
import { ACCOUNT_CHANGED } from '@/lib/account-storage'
import { readSessionMarker, readUserRole } from '@/lib/api'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import { DOCTOR_ROUTES } from '@/constants/doctor-navigation'
import { ADMIN_ROUTES } from '@/constants/admin-navigation'

export type PortalRole = 'patient' | 'doctor' | 'admin'

/** Navigation context only; protected layouts and APIs still verify authority. */
export function currentPortalRole(): PortalRole | null {
  try {
    if (!readSessionMarker()) return null
    const role = readUserRole()
    return role === 'PATIENT' ? 'patient' : role === 'PROVIDER' ? 'doctor' : role === 'ADMIN' ? 'admin' : null
  } catch { return null }
}
const subscribe = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed)
  window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}
export function usePortalRole() { return useSyncExternalStore(subscribe, currentPortalRole, () => null) }
export function portalHome(role: PortalRole | null) {
  return role === 'patient' ? PATIENT_ROUTES.dashboard : role === 'doctor' ? DOCTOR_ROUTES.dashboard : role === 'admin' ? ADMIN_ROUTES.dashboard : '/'
}
export function usePortalHome() { return portalHome(usePortalRole()) }

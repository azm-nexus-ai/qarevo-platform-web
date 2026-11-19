import { ApiError } from '@/lib/api'

export type PatientDoctorPortal = 'PATIENT' | 'PROVIDER'
export type PortalHandoff = { portal: PatientDoctorPortal; message: string; href: string; label: string }
const signIn = { PATIENT: '/auth/sign-in', PROVIDER: '/auth/doctor/login' } as const

/** Only retain a route belonging to the destination portal; never retain URL payloads. */
export function safePortalDestination(value: string | null, portal: PatientDoctorPortal): string | null {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://navigation.invalid')
    const prefix = portal === 'PATIENT' ? '/patient' : '/doctor'
    return url.origin === 'https://navigation.invalid' && (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) ? url.pathname : null
  } catch { return null }
}

export function portalSignInHref(portal: PatientDoctorPortal, intended: string | null = null) {
  const next = safePortalDestination(intended, portal)
  return signIn[portal] + (next ? `?${new URLSearchParams({ next })}` : '')
}

export function authenticatedPortalHandoff(error: unknown): PortalHandoff | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null
  try {
    const detail = JSON.parse(error.body).detail
    if (detail?.error_code !== 'WRONG_PORTAL' || !['PATIENT', 'PROVIDER'].includes(detail.portal)) return null
    const portal = detail.portal as PatientDoctorPortal
    const intended = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next')
    return {
      portal,
      href: portalSignInHref(portal, intended),
      label: portal === 'PROVIDER' ? 'Continue to physician sign-in' : 'Continue to patient sign-in',
      message: portal === 'PROVIDER' ? 'This account is registered for the physician portal.' : 'This account is registered for the patient portal.',
    }
  } catch { return null }
}

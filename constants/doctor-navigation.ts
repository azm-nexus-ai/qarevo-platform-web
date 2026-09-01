import { ICONS } from '@/constants/icons'

export type DoctorNavItem = {
  label: string
  icon: string | readonly string[]
  href: string
}

export const DOCTOR_ROUTES = {
  dashboard: '/doctor/dashboard',
  workspace: '/doctor/workspace',
  appointments: '/doctor/appointments',
  patients: '/doctor/patients',
  videoConsultation: '/doctor/video-consultation',
  outcomes: '/doctor/outcomes',
  profile: '/doctor/profile',
  settings: '/doctor/settings',
  support: '/support',
  logout: '/auth/sign-in',
} as const

export const DOCTOR_SIDEBAR_ITEMS: DoctorNavItem[] = [
  { label: 'Dashboard', icon: ICONS.activity, href: DOCTOR_ROUTES.dashboard },
  { label: 'Workspace', icon: ICONS.steth, href: DOCTOR_ROUTES.workspace },
  { label: 'Appointments', icon: ICONS.calendar, href: DOCTOR_ROUTES.appointments },
  { label: 'Patients', icon: ICONS.user, href: DOCTOR_ROUTES.patients },
  { label: 'Video Consultation', icon: ICONS.video, href: DOCTOR_ROUTES.videoConsultation },
  { label: 'Outcomes', icon: ICONS.heart, href: DOCTOR_ROUTES.outcomes },
  { label: 'Profile', icon: ICONS.shield, href: DOCTOR_ROUTES.profile },
  { label: 'Settings', icon: ICONS.info, href: DOCTOR_ROUTES.settings },
  { label: 'Help & Support', icon: ICONS.shield, href: DOCTOR_ROUTES.support },
  { label: 'Logout', icon: ICONS.logout, href: DOCTOR_ROUTES.logout },
]

export function isDoctorNavActive(pathname: string, href: string) {
  if (href === DOCTOR_ROUTES.dashboard) return pathname === DOCTOR_ROUTES.dashboard
  if (href === DOCTOR_ROUTES.workspace) return pathname.startsWith('/doctor/workspace')
  if (href === DOCTOR_ROUTES.appointments) {
    return (
      pathname.startsWith('/doctor/appointments') ||
      pathname.startsWith('/doctor/video-consultation')
    )
  }
  if (href === DOCTOR_ROUTES.patients) return pathname.startsWith('/doctor/patients')
  if (href === DOCTOR_ROUTES.videoConsultation) return pathname.startsWith('/doctor/video-consultation')
  if (href === DOCTOR_ROUTES.outcomes) return pathname.startsWith('/doctor/outcomes')
  if (href === DOCTOR_ROUTES.profile) return pathname.startsWith('/doctor/profile')
  if (href === DOCTOR_ROUTES.settings) return pathname.startsWith('/doctor/settings')
  if (href === DOCTOR_ROUTES.support) return pathname.startsWith('/support')
  return pathname === href
}

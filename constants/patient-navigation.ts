import { ICONS } from '@/constants/icons'

export type PatientNavItem = {
  label: string
  icon: string | readonly string[]
  href: string
}

export const PATIENT_ROUTES = {
  dashboard: '/patient/dashboard',
  findDoctor: '/patient/find-doctor',
  appointments: '/patient/appointments',
  appointmentDetails: '/patient/appointment-details',
  medicalRecords: '/patient/medical-records',
  prescriptions: '/patient/prescription-care-plan',
  labRequests: '/patient/lab-requests',
  messages: '/patient/messages',
  billing: '/patient/billing',
  settings: '/patient/settings',
  support: '/support',
  logout: '/auth/sign-in',
} as const

export const PATIENT_SIDEBAR_ITEMS: PatientNavItem[] = [
  { label: 'Dashboard', icon: ICONS.activity, href: PATIENT_ROUTES.dashboard },
  { label: 'Find a Doctor', icon: ICONS.steth, href: PATIENT_ROUTES.findDoctor },
  { label: 'Appointments', icon: ICONS.calendar, href: PATIENT_ROUTES.appointments },
  { label: 'Medical Records', icon: ICONS.shield, href: PATIENT_ROUTES.medicalRecords },
  { label: 'Prescriptions', icon: ICONS.heart, href: PATIENT_ROUTES.prescriptions },
  { label: 'Lab Requests', icon: ICONS.cpu, href: PATIENT_ROUTES.labRequests },
  { label: 'Messages', icon: ICONS.ema, href: PATIENT_ROUTES.messages },
  { label: 'Billing & Payments', icon: ICONS.info, href: PATIENT_ROUTES.billing },
  { label: 'Settings', icon: ICONS.user, href: PATIENT_ROUTES.settings },
  { label: 'Help & Support', icon: ICONS.shield, href: PATIENT_ROUTES.support },
]

export function isPatientNavActive(pathname: string, href: string) {
  if (href === PATIENT_ROUTES.dashboard) return pathname === PATIENT_ROUTES.dashboard
  if (href === PATIENT_ROUTES.findDoctor) return pathname.startsWith('/patient/find-doctor') || pathname.startsWith('/patient/physicians')
  if (href === PATIENT_ROUTES.appointments) {
    return (
      pathname.startsWith('/patient/appointments') ||
      pathname.startsWith('/patient/appointment-details') ||
      pathname.startsWith('/patient/consultation-booking') ||
      pathname.startsWith('/patient/video-consultation') ||
      pathname.startsWith('/patient/consultation-summary') ||
      pathname.startsWith('/patient/follow-up') ||
      pathname.startsWith('/patient/feedback') ||
      pathname.startsWith('/patient/referrals') ||
      pathname.startsWith('/patient/prescription-care-plan')
    )
  }
  if (href === PATIENT_ROUTES.labRequests) return pathname.startsWith('/patient/lab-requests')
  if (href === PATIENT_ROUTES.support) return pathname.startsWith('/support')
  return pathname === href
}

import { ICONS } from '@/constants/icons'

export type AdminNavItem = {
  label: string
  icon: string | readonly string[]
  href: string
}

export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  doctors: '/admin/doctors',
  practices: '/admin/practices',
  verifications: '/admin/verifications',
  settlement: '/admin/settlement',
  patients: '/admin/patients',
  accounts: '/admin/accounts',
  adminUsers: '/admin/admin-users',
  exceptions: '/admin/exceptions',
  systemConfig: '/admin/system-config',
  audit: '/admin/audit',
  clinicalSafety: '/admin/clinical-safety',
  settings: '/admin/settings',
  security: '/admin/security',
  logout: '/auth/admin/login',
} as const

export const ADMIN_SIDEBAR_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', icon: ICONS.activity, href: ADMIN_ROUTES.dashboard },
  { label: 'Doctors', icon: ICONS.steth, href: ADMIN_ROUTES.doctors },
  { label: 'Practices', icon: ICONS.user, href: ADMIN_ROUTES.practices },
  { label: 'Verifications', icon: ICONS.shield, href: ADMIN_ROUTES.verifications },
  { label: 'Settlement', icon: ICONS.activity, href: ADMIN_ROUTES.settlement },
  { label: 'Accounts', icon: ICONS.user, href: ADMIN_ROUTES.accounts },
  { label: 'Admin Users', icon: ICONS.shield, href: ADMIN_ROUTES.adminUsers },
  { label: 'Exceptions', icon: ICONS.zap, href: ADMIN_ROUTES.exceptions },
  { label: 'System Config', icon: ICONS.cpu, href: ADMIN_ROUTES.systemConfig },
  { label: 'Clinical Safety', icon: ICONS.heart, href: ADMIN_ROUTES.clinicalSafety },
  { label: 'Audit Logs', icon: ICONS.info, href: ADMIN_ROUTES.audit },
  { label: 'Settings', icon: ICONS.info, href: ADMIN_ROUTES.settings },
  { label: 'Logout', icon: ICONS.logout, href: ADMIN_ROUTES.logout },
]

export function isAdminNavActive(pathname: string, href: string) {
  if (href === ADMIN_ROUTES.dashboard) return pathname === ADMIN_ROUTES.dashboard
  if (href === ADMIN_ROUTES.doctors) return pathname.startsWith('/admin/doctors')
  if (href === ADMIN_ROUTES.patients) return pathname.startsWith('/admin/patients')
  if (href === ADMIN_ROUTES.accounts) return pathname.startsWith('/admin/accounts') || pathname.startsWith('/admin/patients')
  if (href === ADMIN_ROUTES.adminUsers) return pathname.startsWith('/admin/admin-users')
  if (href === ADMIN_ROUTES.exceptions) return pathname.startsWith('/admin/exceptions')
  if (href === ADMIN_ROUTES.systemConfig) return pathname.startsWith('/admin/system-config')
  if (href === ADMIN_ROUTES.audit) return pathname.startsWith('/admin/audit')
  if (href === ADMIN_ROUTES.clinicalSafety) return pathname.startsWith('/admin/clinical-safety')
  if (href === ADMIN_ROUTES.settings) return pathname.startsWith('/admin/settings')
  if (href === ADMIN_ROUTES.verifications) return pathname.startsWith('/admin/verifications')
  if (href === ADMIN_ROUTES.settlement) return pathname.startsWith('/admin/settlement')
  return pathname === href
}

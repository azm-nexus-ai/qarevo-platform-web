import { ICONS } from '@/constants/icons'

export type AdminNavItem = {
  label: string
  icon: string | readonly string[]
  href: string
}

export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  doctors: '/admin/doctors',
  patients: '/admin/patients',
  adminUsers: '/admin/admin-users',
  exceptions: '/admin/exceptions',
  systemConfig: '/admin/system-config',
  audit: '/admin/audit',
  settings: '/admin/settings',
  logout: '/auth/sign-in',
} as const

export const ADMIN_SIDEBAR_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', icon: ICONS.activity, href: ADMIN_ROUTES.dashboard },
  { label: 'Doctors', icon: ICONS.steth, href: ADMIN_ROUTES.doctors },
  { label: 'Patients', icon: ICONS.user, href: ADMIN_ROUTES.patients },
  { label: 'Admin Users', icon: ICONS.shield, href: ADMIN_ROUTES.adminUsers },
  { label: 'Exceptions', icon: ICONS.zap, href: ADMIN_ROUTES.exceptions },
  { label: 'System Config', icon: ICONS.cpu, href: ADMIN_ROUTES.systemConfig },
  { label: 'Audit Logs', icon: ICONS.info, href: ADMIN_ROUTES.audit },
  { label: 'Settings', icon: ICONS.info, href: ADMIN_ROUTES.settings },
  { label: 'Logout', icon: ICONS.logout, href: ADMIN_ROUTES.logout },
]

export function isAdminNavActive(pathname: string, href: string) {
  if (href === ADMIN_ROUTES.dashboard) return pathname === ADMIN_ROUTES.dashboard
  if (href === ADMIN_ROUTES.doctors) return pathname.startsWith('/admin/doctors')
  if (href === ADMIN_ROUTES.patients) return pathname.startsWith('/admin/patients')
  if (href === ADMIN_ROUTES.adminUsers) return pathname.startsWith('/admin/admin-users')
  if (href === ADMIN_ROUTES.exceptions) return pathname.startsWith('/admin/exceptions')
  if (href === ADMIN_ROUTES.systemConfig) return pathname.startsWith('/admin/system-config')
  if (href === ADMIN_ROUTES.audit) return pathname.startsWith('/admin/audit')
  if (href === ADMIN_ROUTES.settings) return pathname.startsWith('/admin/settings')
  return pathname === href
}

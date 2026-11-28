import {
  BadgeCheck, Bell, Building2, CalendarClock, CalendarDays, ClipboardList, Cog, FileText, FlaskConical, HeartPulse, KeyRound,
  LayoutDashboard, LifeBuoy, MessageSquare, Pill, Receipt, ScrollText, ShieldAlert, ShieldCheck, SlidersHorizontal,
  Stethoscope, UserCog, UserRound, Users, UsersRound, Video,
} from 'lucide-react'
import type { PortalNavGroup } from '@/components/layout/PortalNav'
import { DOCTOR_ROUTES } from '@/constants/doctor-navigation'
import { ADMIN_ROUTES } from '@/constants/admin-navigation'

/** Doctor portal: today's work first, then care, practice and account. */
export const DOCTOR_NAV_GROUPS: PortalNavGroup[] = [
  { title: 'today', items: [
    { label: 'Dashboard', href: DOCTOR_ROUTES.dashboard, icon: LayoutDashboard },
    { label: 'Workspace', href: DOCTOR_ROUTES.workspace, icon: Stethoscope },
    { label: 'Appointments', href: DOCTOR_ROUTES.appointments, icon: CalendarDays },
    { label: 'Messages', href: DOCTOR_ROUTES.messages, icon: MessageSquare },
    { label: 'Notifications', href: DOCTOR_ROUTES.notifications, icon: Bell, badge: 'notifications' },
  ] },
  { title: 'care', items: [
    { label: 'Patients', href: DOCTOR_ROUTES.patients, icon: Users },
    { label: 'Care Plans', href: DOCTOR_ROUTES.carePlans, icon: ClipboardList },
    { label: 'Prescriptions', href: DOCTOR_ROUTES.prescriptions, icon: Pill },
    { label: 'Lab Orders', href: DOCTOR_ROUTES.labOrders, icon: FlaskConical },
    { label: 'Video Consultation', href: DOCTOR_ROUTES.videoConsultation, icon: Video },
    { label: 'Outcomes', href: DOCTOR_ROUTES.outcomes, icon: HeartPulse },
  ] },
  { title: 'practice', items: [
    { label: 'My Practices', href: DOCTOR_ROUTES.practices, icon: Building2 },
    { label: 'Independent Practice', href: DOCTOR_ROUTES.independentPractice, icon: BadgeCheck },
  ] },
  { title: 'account', items: [
    { label: 'Profile', href: DOCTOR_ROUTES.profile, icon: UserRound },
    { label: 'Settings', href: DOCTOR_ROUTES.settings, icon: Cog },
    { label: 'Help & Support', href: DOCTOR_ROUTES.support, icon: LifeBuoy },
  ] },
]

/** Admin portal: oversight first, then network, finance, people and governance. */
export const ADMIN_NAV_GROUPS: PortalNavGroup[] = [
  { title: 'overview', items: [
    { label: 'Dashboard', href: ADMIN_ROUTES.dashboard, icon: LayoutDashboard },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell, badge: 'notifications' },
  ] },
  { title: 'network', items: [
    { label: 'Doctors', href: ADMIN_ROUTES.doctors, icon: Stethoscope },
    { label: 'Practices', href: ADMIN_ROUTES.practices, icon: Building2 },
    { label: 'Verifications', href: ADMIN_ROUTES.verifications, icon: ShieldCheck },
  ] },
  { title: 'finance', items: [
    { label: 'Settlement', href: ADMIN_ROUTES.settlement, icon: Receipt },
  ] },
  { title: 'people', items: [
    { label: 'Accounts', href: ADMIN_ROUTES.accounts, icon: UsersRound },
    { label: 'Admin Users', href: ADMIN_ROUTES.adminUsers, icon: UserCog },
  ] },
  { title: 'governance', items: [
    { label: 'Exceptions', href: ADMIN_ROUTES.exceptions, icon: ShieldAlert },
    { label: 'Clinical Safety', href: ADMIN_ROUTES.clinicalSafety, icon: HeartPulse },
    { label: 'System Config', href: ADMIN_ROUTES.systemConfig, icon: SlidersHorizontal },
    { label: 'Audit Logs', href: ADMIN_ROUTES.audit, icon: ScrollText },
  ] },
  { title: 'account', items: [
    { label: 'Settings', href: ADMIN_ROUTES.settings, icon: Cog },
    { label: 'Security', href: ADMIN_ROUTES.security, icon: KeyRound },
  ] },
]

export const PRACTICE_ROUTES = {
  dashboard: '/practice/dashboard',
  team: '/practice/team',
  schedule: '/practice/schedule',
  notifications: '/practice/notifications',
  verification: '/practice/verification',
  statements: '/practice/statements',
  settings: '/practice/settings',
  support: '/support',
} as const

/** Practice portal: operations, team, compliance and finance. Non-clinical by design. */
export const PRACTICE_NAV_GROUPS: PortalNavGroup[] = [
  { title: 'overview', items: [
    { label: 'Dashboard', href: PRACTICE_ROUTES.dashboard, icon: LayoutDashboard },
    { label: 'Notifications', href: PRACTICE_ROUTES.notifications, icon: Bell, badge: 'notifications' },
  ] },
  { title: 'operations', items: [
    { label: 'Team', href: PRACTICE_ROUTES.team, icon: Users },
    { label: 'Schedule', href: PRACTICE_ROUTES.schedule, icon: CalendarClock },
  ] },
  { title: 'compliance', items: [
    { label: 'Verification', href: PRACTICE_ROUTES.verification, icon: ShieldCheck },
  ] },
  { title: 'finance', items: [
    { label: 'Invoices', href: PRACTICE_ROUTES.statements, icon: FileText },
  ] },
  { title: 'account', items: [
    { label: 'Settings', href: PRACTICE_ROUTES.settings, icon: Cog },
    { label: 'Help & Support', href: PRACTICE_ROUTES.support, icon: LifeBuoy },
  ] },
]

export function isPracticeNavActive(pathname: string, href: string) {
  return pathname === href || (href !== '/support' && pathname.startsWith(href + '/'))
}

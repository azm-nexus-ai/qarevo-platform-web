import type { AppointmentSlot, TrustCardData } from '@/types'
import { ICONS } from '@/constants/icons'

export const APPOINTMENT_SLOTS: AppointmentSlot[] = [
  { time: 'Oct 12, 14:00 CET', label: 'Secure Video Session' },
  { time: 'Oct 12, 14:30 CET', label: 'Priority Slot' },
]

export const TRUST_FRAMEWORKS: TrustCardData[] = [
  { label: 'Your account', sub: 'Email verification', icon: ICONS.shield, accent: '#20B5DF' },
  { label: 'Your choices', sub: 'Explicit processing choices', icon: ICONS.ema, accent: '#0E8A5F' },
  { label: 'Clinical access', sub: 'Role and assignment checks', icon: ICONS.shield, accent: '#7C3AED' },
  { label: 'Development preview', sub: 'Synthetic test data only', icon: ICONS.ema, accent: '#D97706' },
]

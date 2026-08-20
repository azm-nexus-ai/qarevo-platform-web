import type { AppointmentSlot, TrustCardData } from '@/types'
import { ICONS } from '@/constants/icons'

export const APPOINTMENT_SLOTS: AppointmentSlot[] = [
  { time: 'Oct 12, 14:00 CET', label: 'Secure Video Session' },
  { time: 'Oct 12, 14:30 CET', label: 'Priority Slot' },
]

export const TRUST_FRAMEWORKS: TrustCardData[] = [
  { label: 'ISO 27001', sub: 'Information Security',    icon: ICONS.shield, accent: '#20B5DF' },
  { label: 'GDPR',      sub: 'Data Protection',         icon: ICONS.ema,    accent: '#0E8A5F' },
  { label: 'HIPAA',     sub: 'Health Data Privacy',     icon: ICONS.shield, accent: '#7C3AED' },
  { label: 'EMA',       sub: 'Clinical Standards',      icon: ICONS.ema,    accent: '#D97706' },
  { label: 'SOC 2',     sub: 'Security & Availability', icon: ICONS.shield, accent: '#0891B2' },
]

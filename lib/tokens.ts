import type { CSSProperties } from 'react'

export const T = {
  blue: 'var(--primary)', link: 'var(--link)', blueLight: 'var(--primary-soft)', blueMid: 'var(--primary-border)',
  navy: 'var(--text)', navy2: 'var(--text)', brandNavy: 'var(--brand-navy)',
  slate: 'var(--text-secondary)', slate2: 'var(--text-muted)',
  surface: 'var(--canvas)', card: 'var(--surface)',
  green: 'var(--success)', greenLight: 'var(--success-soft)', amber: 'var(--warning)',
  purple: 'var(--clinical-accent)', cyan: 'var(--link)', teal: 'var(--success)', red: 'var(--danger)',
  border: 'var(--border)', borderFaint: 'var(--border-subtle)',
} as const

export const Sh = {
  inner: 'var(--shadow-sm)', card: 'var(--shadow-card)', float: 'var(--shadow-float)',
  glow: 'var(--shadow-card)', nav: 'var(--shadow-sm)', glass: 'var(--shadow-card)',
} as const

export const Glass: {
  nav: CSSProperties
  pill: CSSProperties
  slotActive: CSSProperties
  aiCard: CSSProperties
  verifyBadge: CSSProperties
  chip: CSSProperties
  helpBtn: CSSProperties
} = {
  nav: { background: 'var(--surface-glass)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
  pill: { background: 'var(--surface-glass)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
  slotActive: { background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', boxShadow: 'var(--shadow-sm)' },
  aiCard: { background: 'var(--surface-glass)', border: '1px solid var(--primary-border)', boxShadow: 'var(--shadow-card)' },
  verifyBadge: { background: 'var(--brand-navy)', color: 'var(--brand-paper)', boxShadow: 'var(--shadow-sm)' },
  chip: { background: 'var(--primary-soft)', color: 'var(--link)', border: '1px solid var(--primary-border)' },
  helpBtn: { background: 'var(--surface-glass)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
}

export const PAGE_BG = 'var(--page-background)'

import type { CSSProperties } from 'react'

export const T = {
  blue: 'var(--primary)', link: 'var(--link)', blueLight: 'var(--primary-soft)', blueMid: 'var(--primary-border)',
  navy: 'var(--text)', navy2: 'var(--text)', brandNavy: '#04354D',
  slate: 'var(--text-secondary)', slate2: 'var(--text-muted)',
  surface: 'var(--canvas)', card: 'var(--surface)',
  green: 'var(--success)', greenLight: 'var(--success-soft)', amber: 'var(--warning)',
  purple: 'var(--link)', cyan: 'var(--link)', teal: 'var(--success)', red: 'var(--danger)',
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
  nav: {
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.76)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.94), 0 1px 0 rgba(4,53,77,0.08), 0 8px 30px rgba(4,53,77,0.06)',
  },
  pill: {
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(20px) saturate(170%)',
    WebkitBackdropFilter: 'blur(20px) saturate(170%)',
    border: '1px solid rgba(255,255,255,0.82)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 4px 18px rgba(4,53,77,0.1)',
  },
  slotActive: {
    background: 'rgba(165,224,218,0.32)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 14px rgba(32,181,223,0.16)',
  },
  aiCard: {
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(165,224,218,0.46)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.82), 0 8px 26px rgba(4,53,77,0.08), 0 0 0 1px rgba(32,181,223,0.06)',
  },
  verifyBadge: {
    background: 'rgba(32,181,223,0.9)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 10px rgba(32,181,223,0.42)',
  },
  chip: {
    background: 'rgba(165,224,218,0.34)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 10px rgba(4,53,77,0.06)',
  },
  helpBtn: {
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.8)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 6px 20px rgba(4,53,77,0.12), 0 0 0 1px rgba(32,181,223,0.06)',
  },
}

export const PAGE_BG = [
  'radial-gradient(ellipse 68% 56% at 10% 14%, rgba(32,181,223,0.15) 0%, transparent 56%)',
  'radial-gradient(ellipse 54% 42% at 92% 12%, rgba(52,140,234,0.1) 0%, transparent 56%)',
  'radial-gradient(ellipse 80% 62% at 52% 95%, rgba(165,224,218,0.14) 0%, transparent 60%)',
  'radial-gradient(ellipse 48% 40% at 85% 74%, rgba(32,181,223,0.08) 0%, transparent 54%)',
  'radial-gradient(ellipse 64% 50% at 24% 68%, rgba(52,140,234,0.07) 0%, transparent 58%)',
  'var(--canvas)',
].join(', ')

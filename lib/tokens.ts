import type { CSSProperties } from 'react'

export const T = {
  blue:        '#20B5DF',
  blueLight:   '#E8F8FC',
  blueMid:     '#CDEEF6',
  navy:        '#04354D',
  navy2:       '#0E151A',
  slate:       '#355468',
  slate2:      '#6D8797',
  surface:     '#F7FAFC',
  card:        '#FFFFFF',
  green:       '#0F9E77',
  greenLight:  '#EAF8F5',
  amber:       '#D97706',
  purple:      '#348CEA',
  cyan:        '#348CEA',
  teal:        '#A5E0DA',
  red:         '#DC2626',
  border:      'rgba(4,53,77,0.12)',
  borderFaint: 'rgba(4,53,77,0.07)',
} as const

export const Sh = {
  inner:  '0 1px 2px rgba(4,53,77,0.06), 0 6px 18px rgba(4,53,77,0.08)',
  card:   'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 8px rgba(4,53,77,0.06), 0 14px 34px rgba(4,53,77,0.10), 0 40px 84px rgba(4,53,77,0.08)',
  float:  'inset 0 1px 0 rgba(255,255,255,0.94), 0 4px 14px rgba(4,53,77,0.09), 0 24px 62px rgba(4,53,77,0.14), 0 54px 110px rgba(4,53,77,0.1)',
  glow:   'inset 0 1px 0 rgba(255,255,255,0.82), 0 2px 10px rgba(32,181,223,0.16), 0 16px 42px rgba(52,140,234,0.16)',
  nav:    'inset 0 1px 0 rgba(255,255,255,0.94), 0 1px 0 rgba(4,53,77,0.08), 0 8px 30px rgba(4,53,77,0.06)',
  glass:  'inset 0 1px 0 rgba(255,255,255,1), 0 3px 14px rgba(4,53,77,0.11)',
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
    background: 'rgba(247,250,252,0.78)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.76)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.94), 0 1px 0 rgba(4,53,77,0.08), 0 8px 30px rgba(4,53,77,0.06)',
  },
  pill: {
    background: 'rgba(255,255,255,0.8)',
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
    background: 'rgba(247,250,252,0.72)',
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
    background: 'rgba(255,255,255,0.86)',
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
  '#F7FAFC',
].join(', ')

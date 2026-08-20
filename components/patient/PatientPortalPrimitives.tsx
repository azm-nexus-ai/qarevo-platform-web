import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { T, Sh } from '@/lib/tokens'

type PortalCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  style?: CSSProperties
}

type PortalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

type PortalLinkButtonProps = {
  children: ReactNode
  href: string
  tone?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

type PortalBadgeProps = {
  children: ReactNode
  tone?: 'info' | 'success' | 'warning' | 'neutral' | 'danger'
}

export function PortalCard({ children, style, ...props }: PortalCardProps) {
  return (
    <div
      {...props}
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.94)',
        boxShadow: Sh.card,
        padding: '20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function getButtonStyles(tone: 'primary' | 'secondary' | 'danger', fullWidth?: boolean): CSSProperties {
  const shared: CSSProperties = {
    minHeight: '44px',
    padding: '0 14px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 700,
    transition: 'all 0.18s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textDecoration: 'none',
    width: fullWidth ? '100%' : undefined,
    cursor: 'pointer',
  }

  if (tone === 'primary') {
    return {
      ...shared,
      border: 'none',
      color: '#fff',
      background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
      boxShadow: '0 8px 22px rgba(32,181,223,0.24)',
    }
  }

  if (tone === 'danger') {
    return {
      ...shared,
      border: '1px solid rgba(220,38,38,0.18)',
      color: T.red,
      background: 'rgba(255,245,245,0.96)',
    }
  }

  return {
    ...shared,
    border: '1px solid rgba(4,53,77,0.12)',
    color: T.navy,
    background: 'rgba(255,255,255,0.92)',
  }
}

export function PortalButton({ children, tone = 'secondary', fullWidth = false, style, ...props }: PortalButtonProps) {
  return (
    <button
      {...props}
      style={{
        ...getButtonStyles(tone, fullWidth),
        ...(props.disabled
          ? {
              opacity: 0.6,
              cursor: 'not-allowed',
              boxShadow: 'none',
            }
          : null),
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function PortalLinkButton({ children, href, tone = 'secondary', fullWidth = false }: PortalLinkButtonProps) {
  return (
    <a href={href} style={getButtonStyles(tone, fullWidth)}>
      {children}
    </a>
  )
}

export function PortalBadge({ children, tone = 'neutral' }: PortalBadgeProps) {
  const tones: Record<NonNullable<PortalBadgeProps['tone']>, CSSProperties> = {
    info: { background: 'rgba(32,181,223,0.1)', color: T.blue },
    success: { background: 'rgba(15,158,119,0.12)', color: T.green },
    warning: { background: 'rgba(217,119,6,0.12)', color: T.amber },
    neutral: { background: 'rgba(4,53,77,0.06)', color: T.slate },
    danger: { background: 'rgba(220,38,38,0.1)', color: T.red },
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        ...tones[tone],
      }}
    >
      {children}
    </span>
  )
}

export function PortalEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        borderRadius: '18px',
        border: '1px dashed rgba(4,53,77,0.14)',
        background: 'rgba(247,250,252,0.82)',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{title}</p>
      <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.6 }}>{description}</p>
    </div>
  )
}

export function PortalSkeleton({ height = 92 }: { height?: number }) {
  return (
    <div
      style={{
        height: `${height}px`,
        borderRadius: '18px',
        background: 'linear-gradient(90deg, rgba(247,250,252,0.92) 0%, rgba(232,248,252,0.96) 50%, rgba(247,250,252,0.92) 100%)',
        backgroundSize: '200% 100%',
        animation: 'portal-skeleton 1.4s ease-in-out infinite',
      }}
    >
      <style>{`@keyframes portal-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
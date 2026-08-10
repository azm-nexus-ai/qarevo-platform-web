'use client'

import { useState } from 'react'
import { T, Sh } from '@/lib/tokens'
import Ico from '@/components/ui/Ico'
import type { TrustCardData } from '@/types'

export default function TrustCard({ label, sub, icon, accent }: TrustCardData) {
  const [hovered, setHovered] = useState(false)
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '11px',
        padding: '16px 14px 15px',
        borderRadius: '14px',
        cursor: 'default',
        background: hovered ? `rgba(${r},${g},${b},0.07)` : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: hovered
          ? `1px solid rgba(${r},${g},${b},0.24)`
          : '1px solid rgba(255,255,255,0.8)',
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.85), 0 4px 20px rgba(${r},${g},${b},0.12)`
          : `inset 0 1px 0 rgba(255,255,255,0.95), ${Sh.inner}`,
        transition: 'all 0.2s ease',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '9px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `rgba(${r},${g},${b},0.1)`,
          border: `1px solid rgba(${r},${g},${b},0.18)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
          color: accent,
          transition: 'background 0.2s',
        }}
      >
        <Ico p={icon} size={14} sw={1.75} />
      </span>
      <div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '13px',
            fontWeight: 700,
            color: T.navy,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: '3px',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '11px', color: T.slate2, lineHeight: 1.3 }}>{sub}</div>
      </div>
    </div>
  )
}

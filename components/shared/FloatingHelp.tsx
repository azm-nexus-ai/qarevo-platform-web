'use client'

import { useState } from 'react'
import { T, Glass } from '@/lib/tokens'

export default function FloatingHelp() {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 40 }}>
      <button
        aria-label="Help"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 700,
          color: T.slate,
          transform: hovered ? 'translateY(-1px)' : 'none',
          transition: 'box-shadow 0.15s, transform 0.15s',
          ...Glass.helpBtn,
        }}
      >
        ?
      </button>
    </div>
  )
}

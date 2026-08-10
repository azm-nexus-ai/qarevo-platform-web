'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface HoverBtnProps {
  base: CSSProperties
  on: CSSProperties
  children: ReactNode
  onClick?: () => void
}

export default function HoverBtn({ base, on, children, onClick }: HoverBtnProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type='button'
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ transition: 'all 0.15s ease', ...base, ...(hovered ? on : {}) }}
    >
      {children}
    </button>
  )
}

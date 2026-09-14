'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface HoverBtnProps {
  base: CSSProperties
  on: CSSProperties
  children: ReactNode
  className?: string
  onClick?: () => void
  ariaLabel?: string
  title?: string
  disabled?: boolean
}

export default function HoverBtn({ base, on, children, className, onClick, ariaLabel, title, disabled }: HoverBtnProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type='button'
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ transition: 'all 0.15s ease', ...base, ...(hovered ? on : {}) }}
    >
      {children}
    </button>
  )
}

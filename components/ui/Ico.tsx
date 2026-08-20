'use client'

import type { CSSProperties } from 'react'

interface IcoProps {
  p: string | readonly string[]
  size?: number
  sw?: number
  style?: CSSProperties
  color?: string
  fill?: string
}

export default function Ico({ p, size = 16, sw = 1.5, style, color, fill = 'none' }: IcoProps) {
  const paths = Array.isArray(p) ? p : [p]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'block',
        flexShrink: 0,
        ...(color ? { color } : {}),
        ...style,
      }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

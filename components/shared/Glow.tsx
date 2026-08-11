'use client'

interface GlowProps {
  color: string
  w: number
  h: number
  top: number
  left: string
  opacity?: number
}

export default function Glow({ color, w, h, top, left, opacity = 1 }: GlowProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 0,
        width: `${w}px`,
        height: `${h}px`,
        top: `${top}px`,
        left,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(ellipse, ${color} 0%, transparent 68%)`,
        filter: 'blur(1px)',
        opacity,
      }}
    />
  )
}

import type { CSSProperties, ReactNode } from 'react'

export interface IcoProps {
  p: string | readonly string[]
  size?: number
  sw?: number
  style?: CSSProperties
  color?: string
  fill?: string
}

export interface GlowProps {
  color: string
  w: number
  h: number
  top: number
  left: string
  opacity?: number
}

export interface TrustCardData {
  label: string
  sub: string
  icon: string | readonly string[]
  accent: string
}

export interface AppointmentSlot {
  time: string
  label: string
}

export interface AIItemProps {
  icon: string | readonly string[]
  title: string
  titleColor?: string
  body: string
  action?: string
  href?: string
  divider?: boolean
  glass?: boolean
}

export interface HoverBtnProps {
  base: CSSProperties
  on: CSSProperties
  children: ReactNode
}

import type { CSSProperties } from 'react'
import BrandLogo from './BrandLogo'

/** Portal header logo: the horizontal brand logo, colour in light mode and white in dark mode. */
export default function AuthenticatedLogo({ width = 156, priority: _priority = false, style }: { width?: number; priority?: boolean; style?: CSSProperties }) {
  void _priority
  return <BrandLogo variant='horizontal' tone='auto' width={width} style={style} />
}

import Image from 'next/image'
import type { CSSProperties } from 'react'

type AuthenticatedLogoProps = {
  width?: number
  priority?: boolean
  style?: CSSProperties
}

const BASE_WIDTH = 156
const BASE_HEIGHT = 23

export default function AuthenticatedLogo({ width = BASE_WIDTH, priority = false, style }: AuthenticatedLogoProps) {
  const ratio = BASE_HEIGHT / BASE_WIDTH

  return (
    <span style={{ display: 'inline-block', width, maxWidth: '100%' }}>
    <Image className="logo-on-light"
      src='/brand/qarevo-logo-light.svg'
      alt='Qarevo Health'
      width={width}
      height={Math.round(width * ratio)}
      priority={priority}
      style={{ width: `${width}px`, height: 'auto', maxWidth: '100%', display: 'block', ...style }}
    />
    <Image className="logo-on-dark"
      src="/brand/qarevo-logo-dark.svg"
      alt="Qarevo Health" width={width} height={Math.round(width * ratio)} priority={priority}
      style={{ width: `${width}px`, height: 'auto', maxWidth: '100%', ...style }}
    />
    </span>
  )
}

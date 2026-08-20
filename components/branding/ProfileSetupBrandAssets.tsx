import Image from 'next/image'
import type { CSSProperties } from 'react'

type ProfileSetupLogoProps = {
  priority?: boolean
  style?: CSSProperties
}

type ProfileSetupMarkProps = {
  priority?: boolean
  style?: CSSProperties
}

export function ProfileSetupLogo({ priority = false, style }: ProfileSetupLogoProps) {
  return (
    <Image
      src='/brand/Untitled design - 2026-08-03T165058.603.png'
      alt='Qarevo Health'
      width={160}
      height={34}
      priority={priority}
      style={{ width: '160px', height: 'auto', maxWidth: '100%', display: 'block', ...style }}
    />
  )
}

export function ProfileSetupMark({ priority = false, style }: ProfileSetupMarkProps) {
  return (
    <Image
      src='/brand/qarevo-mark.png'
      alt='Qarevo mark'
      width={32}
      height={32}
      priority={priority}
      style={{ width: '32px', height: '32px', objectFit: 'contain', display: 'block', ...style }}
    />
  )
}
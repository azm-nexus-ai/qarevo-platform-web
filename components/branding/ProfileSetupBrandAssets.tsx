import Image from 'next/image'
import BrandLogo from '@/components/branding/BrandLogo'
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
    <BrandLogo tone='white' width={160} />
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

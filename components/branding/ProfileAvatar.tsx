'use client'

import { useState } from 'react'

export function profileInitials(name: string, kind: 'patient' | 'doctor' | 'admin' | 'practice' = 'patient') {
  const value = name.trim().replace(/^Dr\.?\s+/i, '')
  return value ? value.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : kind === 'doctor' ? 'DR' : kind === 'admin' ? 'AD' : kind === 'practice' ? 'PR' : 'P'
}

/** Never use another person's portrait when an owned image is absent or fails. */
export function profileImageSource(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null
  const source = value.trim()
  if (/^\/(?!\/)/.test(source) || /^data:image\/(?:png|jpeg|webp);base64,/i.test(source)) return source
  if (/^https:\/\//i.test(source)) {
    try {
      const url = new URL(source)
      if (!url.username && !url.password) return url.href
    } catch { return null }
  }
  return null
}

export default function ProfileAvatar({ name, src, size = 42, kind = 'patient' }: {
  name: string
  src?: string | null
  size?: number
  kind?: 'patient' | 'doctor' | 'admin' | 'practice'
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const source = profileImageSource(src)
  const label = name.trim() || (kind === 'doctor' ? 'Doctor' : kind === 'admin' ? 'Administrator' : 'Patient')
  const initials = profileInitials(name, kind)
  return <span role='img' aria-label={`${label} profile image`} style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 700 }}>
    {source && failedSource !== source ? <img src={source} alt='' width={size} height={size} loading='lazy' decoding='async' referrerPolicy='no-referrer' onError={() => setFailedSource(source)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
  </span>
}

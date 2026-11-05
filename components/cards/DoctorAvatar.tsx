'use client'
import { useState } from 'react'

/** Physician imagery must never block discovery or expose a broken image control. */
export default function DoctorAvatar({ name, imageUrl, size = 52 }: { name: string; imageUrl?: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState('')
  const safeUrl = imageUrl && (/^https:\/\//i.test(imageUrl) || /^\/(?!\/)/.test(imageUrl) || /^data:image\/(png|jpeg|webp);base64,/i.test(imageUrl)) ? imageUrl : ''
  const initials = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DR'
  return <span className='doctor-card-avatar' style={{ width: size, height: size, maxWidth: '100%', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', display: 'inline-grid', placeItems: 'center', color: 'var(--text)', background: 'var(--surface-hover)', border: '1px solid var(--border)', fontWeight: 700 }}>
    {safeUrl && failedUrl !== safeUrl ? <img src={safeUrl} alt={`${name}, physician`} width={size} height={size} loading='lazy' decoding='async' referrerPolicy='no-referrer' onError={() => setFailedUrl(safeUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span role='img' aria-label={`Profile image unavailable for ${name}`}>{initials}</span>}
  </span>
}

'use client'

import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import DoctorAvatar from './DoctorAvatar'
import { doctorVerification } from '@/lib/doctor-verification'

interface DoctorCardProps {
  name: string
  specialty: string
  verification?: string | null
  tags?: string[] | null
  imageUrl?: string | null
  selected?: boolean
  disabled?: boolean
  loading?: boolean
  onSelect?: () => void
}

/** Shared physician summary; optional selection never bypasses booking authorization. */
export default function DoctorCard({ name, specialty, verification, tags = [], imageUrl, selected = false, disabled = false, loading = false, onSelect }: DoctorCardProps) {
  const unavailable = disabled || loading
  const status = doctorVerification(verification)
  const focusTags = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())) : []
  return <div className='doctor-card' data-selected={selected || undefined} data-disabled={disabled || undefined}
    role={onSelect ? 'button' : undefined} tabIndex={onSelect && !unavailable ? 0 : undefined}
    aria-label={onSelect ? `Select ${name}` : undefined} aria-pressed={onSelect ? selected : undefined}
    aria-disabled={onSelect ? unavailable : undefined} aria-busy={loading || undefined}
    onClick={onSelect && !unavailable ? onSelect : undefined}
    onKeyDown={event => { if (onSelect && !unavailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect() } }}>
    {loading ? <div role='status' className='doctor-card-loading'><span className='doctor-card-skeleton'/><span>Loading clinician details…</span></div> : <>
      <div className='doctor-card-portrait'>
        <DoctorAvatar name={name} imageUrl={imageUrl}/>
        {status.verified && <span className='doctor-card-verified' aria-label='Verified physician'><Ico p={ICONS.check} size={10} sw={2.5}/></span>}
      </div>
      <div className='doctor-card-main'>
        <p className='doctor-card-name'>{name}</p>
        <p className='doctor-card-meta'>{specialty} · {status.label}</p>
        {focusTags.length > 0 && <><p className='doctor-card-focus'>Clinical focus</p><div className='doctor-card-tags'>{focusTags.map((tag,index)=><span key={`${tag}-${index}`}>{tag}</span>)}</div></>}
      </div>
    </>}
  </div>
}

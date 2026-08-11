'use client'

import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

interface DoctorCardProps {
  name: string
  specialty: string
  verification: string
  tags: string[]
  imageUrl: string
}

export default function DoctorCard({ name, specialty, verification, tags, imageUrl }: DoctorCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #F6F9FF 0%, #EEF4FF 100%)',
        borderRadius: '14px',
        border: '1px solid rgba(32,181,223,0.09)',
        padding: '18px',
        display: 'flex',
        gap: '14px',
        boxShadow: Sh.inner,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={imageUrl}
          alt={name}
          width={52}
          height={52}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            background: T.blueLight,
            boxShadow: `0 0 0 3px rgba(255,255,255,0.95), 0 0 0 4.5px ${T.blueMid}`,
          }}
        />
        <span
          aria-label="Verified physician"
          style={{
            position: 'absolute',
            bottom: '-1px',
            right: '-1px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.95)',
            ...Glass.verifyBadge,
          }}
        >
          <Ico p={ICONS.check} size={9} sw={2.5} style={{ color: '#fff' }} />
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '15px',
            fontWeight: 700,
            color: T.navy,
            letterSpacing: '-0.025em',
            marginBottom: '3px',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: '12.5px', color: T.slate2, marginBottom: '16px', letterSpacing: '-0.01em' }}>
          {specialty} · Clinical Ver: {verification}
        </div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: T.slate2,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Clinical Focus
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '4px 11px',
                borderRadius: '100px',
                color: T.blue,
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                ...Glass.chip,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

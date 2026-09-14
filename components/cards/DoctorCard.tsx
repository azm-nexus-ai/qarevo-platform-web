'use client'

import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { useState } from 'react'

interface DoctorCardProps {
  name: string
  specialty: string
  verification: string
  tags?: string[]
  imageUrl?: string
}

export default function DoctorCard({ name, specialty, verification, tags = [], imageUrl }: DoctorCardProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div
      className='doctor-card'
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
      <style>{`
        .doctor-card { min-width: 0; }
        .doctor-card-main { min-width: 0; }
        .doctor-card-name, .doctor-card-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .doctor-card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        @media (max-width: 430px) {
          .doctor-card {
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .doctor-card-avatar {
            width: 46px !important;
            height: 46px !important;
          }
          .doctor-card-name {
            font-size: 14px !important;
          }
          .doctor-card-meta {
            white-space: normal;
            font-size: 12px !important;
            line-height: 1.45;
            margin-bottom: 10px !important;
          }
          .doctor-card-focus {
            font-size: 9px !important;
            margin-bottom: 6px !important;
          }
          .doctor-card-tags span {
            padding: 4px 9px !important;
            font-size: 11.5px !important;
          }
        }
      `}</style>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {imageError || !imageUrl ? (
          <div
            className='doctor-card-avatar'
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(32,181,223,0.15), rgba(52,140,234,0.2))',
              display: 'grid',
              placeItems: 'center',
              boxShadow: `0 0 0 3px rgba(255,255,255,0.95), 0 0 0 4.5px ${T.blueMid}`,
            }}
          >
            <Ico p={ICONS.steth} size={22} sw={1.5} color={T.navy} />
          </div>
        ) : (
          <img
            className='doctor-card-avatar'
            src={imageUrl}
            alt={name}
            width={52}
            height={52}
            onError={() => setImageError(true)}
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
        )}
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

      <div className='doctor-card-main' style={{ flex: 1, minWidth: 0 }}>
        <div
          className='doctor-card-name'
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
        <div className='doctor-card-meta' style={{ fontSize: '12.5px', color: T.slate2, marginBottom: '16px', letterSpacing: '-0.01em' }}>
          {specialty} · Clinical Ver: {verification}
        </div>
        <div
          className='doctor-card-focus'
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
        <div className='doctor-card-tags'>
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
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

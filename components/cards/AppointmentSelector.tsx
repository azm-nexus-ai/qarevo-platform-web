'use client'

import { useState } from 'react'
import { T, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import type { AppointmentSlot } from '@/types'

interface AppointmentSelectorProps {
  slots: AppointmentSlot[]
}

export default function AppointmentSelector({ slots }: AppointmentSelectorProps) {
  const [selectedSlot, setSelectedSlot] = useState(1)
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {slots.map((slot, i) => {
        const sel = selectedSlot === i
        const hov = hoverSlot === i && !sel
        return (
          <button
            key={i}
            onClick={() => setSelectedSlot(i)}
            onMouseEnter={() => setHoverSlot(i)}
            onMouseLeave={() => setHoverSlot(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              padding: '14px 16px',
              borderRadius: '12px',
              ...(sel
                ? {
                    ...Glass.slotActive,
                    outline: '1.5px solid rgba(32,181,223,0.45)',
                    outlineOffset: '-1px',
                  }
                : {
                    background: hov ? 'rgba(32,181,223,0.04)' : 'rgba(4,53,77,0.015)',
                    border: `1px solid ${T.border}`,
                  }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.14s ease',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: sel ? T.blue : T.navy,
                  marginBottom: '3px',
                }}
              >
                {slot.time}
              </div>
              <div style={{ fontSize: '12px', color: sel ? '#6B96E8' : T.slate2 }}>
                {slot.label}
              </div>
            </div>
            {sel ? (
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...Glass.verifyBadge,
                }}
              >
                <Ico p={ICONS.check} size={10} sw={2.5} style={{ color: '#fff' }} />
              </span>
            ) : (
              <Ico p={ICONS.arrowSm} size={15} sw={1.5} style={{ color: T.slate2 }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

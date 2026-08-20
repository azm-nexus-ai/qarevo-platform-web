'use client'

import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

export default function PhysicianLoopCard() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(4,53,77,0.06)',
        borderRadius: '20px',
        boxShadow: Sh.float,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '24px 24px 20px', flex: 1 }}>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '15px',
            fontWeight: 700,
            color: T.navy,
            letterSpacing: '-0.025em',
            display: 'block',
            marginBottom: '32px',
          }}
        >
          Physician-in-the-loop
        </span>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: 'linear-gradient(140deg, #EAF1FF 0%, #C8DAFE 100%)',
              margin: '0 auto 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 2px 16px rgba(32,181,223,0.14)',
            }}
          >
            <Ico p={ICONS.user} size={32} sw={1.25} style={{ color: T.blue }} />
            <span
              style={{
                position: 'absolute',
                bottom: '1px',
                right: '1px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'rgba(255,248,225,0.9)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: '2px solid rgba(255,255,255,0.88)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
              }}
            >
              ⏳
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              color: T.navy,
              letterSpacing: '-0.02em',
              marginBottom: '10px',
            }}
          >
            Awaiting Sign-off
          </div>
          <p
            style={{
              fontSize: '12.5px',
              color: T.slate,
              lineHeight: 1.65,
              maxWidth: '210px',
              margin: '0 auto',
            }}
          >
            AI insights require human verification before patient delivery.
          </p>
        </div>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <HoverBtn
          base={{
            width: '100%',
            padding: '11px 20px',
            borderRadius: '10px',
            background: 'rgba(4,53,77,0.04)',
            border: `1px solid ${T.border}`,
            cursor: 'pointer',
            fontSize: '13.5px',
            fontWeight: 600,
            color: T.navy,
            letterSpacing: '-0.015em',
          }}
          on={{ background: 'rgba(4,53,77,0.07)', border: '1px solid rgba(4,53,77,0.13)' }}
        >
          Review Case
        </HoverBtn>
      </div>
    </div>
  )
}

'use client'

import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import AIItem from '@/components/cards/AIItem'
import PhysicianLoopCard from '@/components/cards/PhysicianLoopCard'

export default function DashboardSection() {
  return (
    <div
      id="clinical-intelligence"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'linear-gradient(180deg, rgba(238,245,255,0.82) 0%, rgba(232,241,255,0.88) 100%)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        borderTop: '1px solid rgba(32,181,223,0.07)',
        paddingBottom: '80px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '120px',
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(32,181,223,0.04) 0%, transparent 100%)',
        }}
      />

      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '48px 32px 0',
          position: 'relative',
        }}
      >
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: T.blue,
              boxShadow: '0 0 0 3px rgba(32,181,223,0.15)',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: T.slate2,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Clinical Intelligence
          </span>
        </div>

        {/* Cards grid */}
        <div className="grid-responsive-dashboard">
          {/* Clinical Intelligence Dashboard */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(4,53,77,0.06)',
              borderRadius: '20px',
              boxShadow: Sh.float,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '22px 28px 20px',
                borderBottom: `1px solid ${T.borderFaint}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '15.5px',
                  fontWeight: 700,
                  color: T.navy,
                  letterSpacing: '-0.025em',
                }}
              >
                Clinical Intelligence Dashboard
              </span>
              <button
                style={{
                  cursor: 'pointer',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: T.blue,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  ...Glass.chip,
                }}
              >
                Explainable AI View
              </button>
            </div>

            <AIItem
              icon={ICONS.cpu}
              title="Multimodal Data Ingestion"
              body="Processing patient self-report and historical lab panels. Identified 3 critical markers for review."
              divider
            />
            <AIItem
              icon={ICONS.zap}
              title="Copilot Recommendation generated"
              titleColor={T.blue}
              body="Recommend early intervention protocol based on elevated marker X. Confidence score: 92%."
              action="View Training Data Source"
              glass
            />
          </div>

          <PhysicianLoopCard />
        </div>
      </div>
    </div>
  )
}

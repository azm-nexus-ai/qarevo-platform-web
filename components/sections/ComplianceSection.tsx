'use client'

import { T } from '@/lib/tokens'
import TrustCard from '@/components/cards/TrustCard'
import { TRUST_FRAMEWORKS } from '@/constants/healthcare'

export default function ComplianceSection() {
  return (
    <div
      id="security-governance"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.46)',
        backdropFilter: 'blur(32px) saturate(150%)',
        WebkitBackdropFilter: 'blur(32px) saturate(150%)',
        borderTop: '1px solid rgba(255,255,255,0.68)',
        borderBottom: '1px solid rgba(255,255,255,0.52)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(4,53,77,0.03)',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '24px 32px' }}>
        <div className="compliance-row">
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: T.slate2,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              flexShrink: 0,
              minWidth: '136px',
            }}
          >
            Governed by frameworks
          </span>
          <div className="trust-flex">
            {TRUST_FRAMEWORKS.map((framework) => (
              <TrustCard key={framework.label} {...framework} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

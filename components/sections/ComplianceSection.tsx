'use client'
import { useTranslations } from 'next-intl'

import { T } from '@/lib/tokens'
import TrustCard from '@/components/cards/TrustCard'
import { TRUST_FRAMEWORKS } from '@/constants/healthcare'

/** Message keys for TRUST_FRAMEWORKS, in the same order. */
const TRUST_KEYS = ['account', 'choices', 'access', 'preview'] as const

export default function ComplianceSection() {
  const t = useTranslations('landing')
  return (
    <div
      id="security-governance"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'var(--surface-subtle)',
        backdropFilter: 'blur(32px) saturate(150%)',
        WebkitBackdropFilter: 'blur(32px) saturate(150%)',
        borderTop: "1px solid var(--border)",
        borderBottom: '1px solid rgba(255,255,255,0.52)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(4,53,77,0.03)',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '24px 32px' }}>
        <div className="compliance-row">
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: T.slate2,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              flexShrink: 0,
              minWidth: '136px',
            }}
          >
            {t('builtAroundTrust')}
          </span>
          <div className="trust-flex">
            {TRUST_FRAMEWORKS.map((framework, index) => (
              <TrustCard key={framework.label} {...framework} label={t(`trust.${TRUST_KEYS[index]}.label`)} sub={t(`trust.${TRUST_KEYS[index]}.sub`)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

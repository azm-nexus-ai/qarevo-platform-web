'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T, Glass, Sh, PAGE_BG } from '@/lib/tokens'
import NavigationBar from '@/components/layout/NavigationBar'
import Footer from '@/components/layout/Footer'
import HoverBtn from '@/components/buttons/HoverBtn'

// ── Section card ─────────────────────────────────────────────────────────────
function WPCard({
  badge,
  title,
  children,
}: {
  badge?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(4,53,77,0.06)',
        borderRadius: '20px',
        boxShadow: Sh.float,
        padding: '28px 32px',
      }}
    >
      {badge && (
        <span
          style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: 700,
            color: T.blue,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'rgba(32,181,223,0.08)',
            border: '1px solid rgba(32,181,223,0.18)',
            borderRadius: '100px',
            padding: '3px 10px',
            marginBottom: '14px',
          }}
        >
          {badge}
        </span>
      )}
      <h2
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 'clamp(17px, 2.2vw, 22px)',
          fontWeight: 700,
          color: T.navy,
          letterSpacing: '-0.03em',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: '14.5px',
          lineHeight: 1.75,
          color: T.slate,
          letterSpacing: '-0.005em',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Stat bubble ────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '24px 20px',
        borderRadius: '16px',
        ...Glass.aiCard,
      }}
    >
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 800,
          color: T.blue,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: '8px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>
        {label}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhitepaperPage() {
  const router = useRouter()

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflowX: 'hidden',
        background: PAGE_BG,
      }}
    >
      {/* Ambient dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.10) 1px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 30%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 30%, black 40%, transparent 100%)',
        }}
      />

      <NavigationBar />

      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: '1080px', margin: '0 auto' }} className="container-pad">
          <section style={{ textAlign: 'center', padding: '80px 0 64px' }}>
            {/* Eyebrow */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px 6px 10px',
                borderRadius: '100px',
                marginBottom: '32px',
                ...Glass.pill,
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: T.blue,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Clinical Whitepaper · 2025 Edition
              </span>
            </div>

            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 'clamp(30px, 5.5vw, 60px)',
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: '-0.038em',
                color: T.navy,
                maxWidth: '700px',
                margin: '0 auto 20px',
              }}
            >
              Clinical AI Architecture{' '}
              <span style={{ color: T.slate2, fontWeight: 700 }}>for European Healthcare</span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(14px, 1.8vw, 16.5px)',
                lineHeight: 1.75,
                color: T.slate,
                maxWidth: '520px',
                margin: '0 auto 40px',
                letterSpacing: '-0.01em',
              }}
            >
              A technical overview of Qarevo Health&apos;s approach to multimodal clinical intelligence,
              enterprise security architecture, GDPR-native data governance, and explainable AI safety.
            </p>

            <div className="hero-btns">
              <HoverBtn
                onClick={() => router.push('/auth')}
                base={{
                  background: T.blue,
                  border: 'none',
                  cursor: 'pointer',
                  padding: '13px 28px',
                  borderRadius: '11px',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: '#fff',
                  letterSpacing: '-0.015em',
                  boxShadow: '0 1px 4px rgba(32,181,223,0.28), 0 4px 20px rgba(32,181,223,0.22)',
                }}
                on={{
                  transform: 'translateY(-1.5px)',
                  boxShadow: '0 3px 10px rgba(32,181,223,0.35), 0 10px 36px rgba(32,181,223,0.22)',
                }}
              >
                Contact Sales
              </HoverBtn>
              <HoverBtn
                onClick={() => {
                  // PDF download placeholder — replace href with actual PDF path
                  const a = document.createElement('a')
                  a.href = '#'
                  a.download = 'Qarevo-Health-Whitepaper-2025.pdf'
                  a.click()
                }}
                base={{
                  cursor: 'pointer',
                  padding: '12px 24px',
                  borderRadius: '11px',
                  fontSize: '14.5px',
                  fontWeight: 500,
                  color: T.navy2,
                  letterSpacing: '-0.015em',
                  ...Glass.pill,
                }}
                on={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(4,53,77,0.13)' }}
              >
                Download PDF
              </HoverBtn>
            </div>
          </section>
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'rgba(255,255,255,0.46)',
            backdropFilter: 'blur(32px) saturate(150%)',
            WebkitBackdropFilter: 'blur(32px) saturate(150%)',
            borderTop: '1px solid rgba(255,255,255,0.68)',
            borderBottom: '1px solid rgba(255,255,255,0.52)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <div
            style={{
              maxWidth: '1080px',
              margin: '0 auto',
              padding: '32px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
            className="container-pad stats-grid"
          >
            <Stat value="92%" label="Copilot Confidence Score" />
            <Stat value="GDPR" label="Native by Design" />
            <Stat value="ISO 27001" label="Certified Infrastructure" />
            <Stat value="CE" label="Medical Device Marked" />
          </div>
        </div>

        {/* ── Content sections ─────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            padding: '64px 32px 80px',
          }}
          className="container-pad"
        >
          {/* Back link */}
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: T.slate2,
              textDecoration: 'none',
              marginBottom: '40px',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = T.blue)}
            onMouseLeave={e => (e.currentTarget.style.color = T.slate2)}
          >
            ← Back to Platform
          </Link>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Executive Summary */}
            <WPCard badge="Executive Summary" title="Overview — Why Clinical AI Requires a Different Approach">
              <p style={{ margin: '0 0 12px' }}>
                Healthcare data is among the most sensitive and complex datasets in existence. Existing horizontal
                AI platforms — designed for general-purpose tasks — are fundamentally misaligned with the clinical
                workflow, regulatory requirements, and patient safety obligations of European healthcare.
              </p>
              <p style={{ margin: 0 }}>
                Qarevo Health was built from first principles as a medical-grade platform: multimodal data ingestion,
                longitudinal patient modelling, explainable AI recommendations, and a governance layer that treats
                GDPR compliance not as an afterthought but as a core architectural constraint.
              </p>
            </WPCard>

            {/* Two-column grid */}
            <div className="whitepaper-grid">
              {/* Clinical Intelligence */}
              <WPCard badge="Clinical Intelligence" title="Multimodal Data Ingestion & AI Copilot">
                <p style={{ margin: '0 0 12px' }}>
                  The Qarevo Clinical AI engine processes structured and unstructured data simultaneously — lab panels,
                  patient-reported outcomes, longitudinal health records, and real-time vitals — to surface clinically
                  meaningful signals that manual review would miss.
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}>
                  <li style={{ marginBottom: '6px' }}>Confidence scores per recommendation (default threshold: 85%)</li>
                  <li style={{ marginBottom: '6px' }}>Explainability layers with Training Data Source citations</li>
                  <li style={{ marginBottom: '6px' }}>Physician-in-the-loop override at every decision point</li>
                  <li>Continuous retraining on anonymised outcome data</li>
                </ul>
              </WPCard>

              {/* Security Architecture */}
              <WPCard badge="Security Architecture" title="Zero-Trust Infrastructure & Encryption">
                <p style={{ margin: '0 0 12px' }}>
                  Every service-to-service call is authenticated and authorised independently. Data is encrypted at rest
                  (AES-256) and in transit (TLS 1.3). Database-level column encryption protects PHI at the storage layer.
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}>
                  <li style={{ marginBottom: '6px' }}>mTLS between all microservices</li>
                  <li style={{ marginBottom: '6px' }}>Hardware Security Module (HSM) key management</li>
                  <li style={{ marginBottom: '6px' }}>Automated secret rotation every 24 hours</li>
                  <li>SOC 2 Type II audit trail with immutable logs</li>
                </ul>
              </WPCard>

              {/* GDPR Compliance */}
              <WPCard badge="GDPR Compliance" title="Data Residency, Consent & Right to Erasure">
                <p style={{ margin: '0 0 12px' }}>
                  Patient data is processed and stored exclusively within the European Economic Area (EEA). No data
                  is transferred to third-country processors without explicit DPA agreements satisfying GDPR Chapter V.
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}>
                  <li style={{ marginBottom: '6px' }}>Granular consent management with timestamped audit logs</li>
                  <li style={{ marginBottom: '6px' }}>Automated Right to Erasure (Article 17) workflows</li>
                  <li style={{ marginBottom: '6px' }}>Data Minimisation by design — collect only what is clinically necessary</li>
                  <li>DPO-assigned & DPIA completed for all high-risk processing</li>
                </ul>
              </WPCard>

              {/* AI Safety */}
              <WPCard badge="AI Safety" title="Explainability, Bias Auditing & Human Oversight">
                <p style={{ margin: '0 0 12px' }}>
                  The EU AI Act classifies clinical decision support as high-risk AI. Qarevo&apos;s safety framework is
                  designed to satisfy all obligations under the Act&apos;s conformity assessment requirements.
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}>
                  <li style={{ marginBottom: '6px' }}>SHAP/LIME explainability for every recommendation</li>
                  <li style={{ marginBottom: '6px' }}>Demographic bias auditing quarterly</li>
                  <li style={{ marginBottom: '6px' }}>Human override is always final — AI is advisory only</li>
                  <li>Model version control with rollback capability</li>
                </ul>
              </WPCard>
            </div>

            {/* Infrastructure Overview — full width */}
            <WPCard badge="Infrastructure Overview" title="Scalable, Resilient, EU-Native Cloud Architecture">
              <div className="whitepaper-grid" style={{ marginTop: '4px' }}>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '14px',
                      fontWeight: 700,
                      color: T.navy,
                      letterSpacing: '-0.02em',
                      margin: '0 0 8px',
                    }}
                  >
                    Deployment
                  </h3>
                  <ul style={{ margin: '0', paddingLeft: '18px', fontSize: '14px', lineHeight: 1.7 }}>
                    <li>Multi-region active/passive with automatic failover</li>
                    <li>99.9% SLA with RPO &lt; 5 minutes and RTO &lt; 15 minutes</li>
                    <li>EU data centres: Frankfurt, Amsterdam, Dublin</li>
                    <li>Kubernetes-native with horizontal autoscaling</li>
                  </ul>
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '14px',
                      fontWeight: 700,
                      color: T.navy,
                      letterSpacing: '-0.02em',
                      margin: '0 0 8px',
                    }}
                  >
                    Compliance Certifications
                  </h3>
                  <ul style={{ margin: '0', paddingLeft: '18px', fontSize: '14px', lineHeight: 1.7 }}>
                    <li>ISO 27001 — Information Security Management</li>
                    <li>ISO 13485 — Medical Device Quality Management</li>
                    <li>CE Marking under EU MDR 2017/745</li>
                    <li>SOC 2 Type II — Trust Services Criteria</li>
                  </ul>
                </div>
              </div>
            </WPCard>

            {/* CTA card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(32,181,223,0.06) 0%, rgba(52,140,234,0.06) 100%)',
                border: '1px solid rgba(32,181,223,0.16)',
                borderRadius: '20px',
                padding: '40px 36px',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 'clamp(20px, 3vw, 28px)',
                  fontWeight: 800,
                  color: T.navy,
                  letterSpacing: '-0.03em',
                  margin: '0 0 12px',
                }}
              >
                Ready to see it in action?
              </h2>
              <p
                style={{
                  fontSize: '15px',
                  color: T.slate,
                  margin: '0 0 32px',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.65,
                }}
              >
                Speak with a clinical solutions engineer about deploying Qarevo at your institution.
              </p>
              <div className="hero-btns">
                <HoverBtn
                  onClick={() => router.push('/auth')}
                  base={{
                    background: T.blue,
                    border: 'none',
                    cursor: 'pointer',
                    padding: '13px 30px',
                    borderRadius: '11px',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.015em',
                    boxShadow: '0 1px 4px rgba(32,181,223,0.28), 0 4px 20px rgba(32,181,223,0.22)',
                  }}
                  on={{
                    transform: 'translateY(-1.5px)',
                    boxShadow: '0 3px 10px rgba(32,181,223,0.35), 0 10px 36px rgba(32,181,223,0.22)',
                  }}
                >
                  Contact Sales
                </HoverBtn>
                <HoverBtn
                  onClick={() => router.push('/')}
                  base={{
                    cursor: 'pointer',
                    padding: '12px 26px',
                    borderRadius: '11px',
                    fontSize: '14.5px',
                    fontWeight: 500,
                    color: T.navy2,
                    letterSpacing: '-0.015em',
                    ...Glass.pill,
                  }}
                  on={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(4,53,77,0.13)' }}
                >
                  View Platform
                </HoverBtn>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

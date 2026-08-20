import type { Metadata } from 'next'
import Link from 'next/link'
import { T, PAGE_BG, Glass, Sh } from '@/lib/tokens'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Qarevo Health cookie policy and consent preferences.',
}

const SECTIONS = [
  {
    title: 'Essential Cookies',
    body: 'These cookies are strictly necessary for the platform to function correctly. They enable core services such as session authentication, security tokens, and load balancing. They cannot be disabled.',
  },
  {
    title: 'Analytics Cookies',
    body: 'We use privacy-preserving analytics to understand how users interact with the platform so we can improve it. No personally identifiable information is collected. These cookies can be disabled.',
  },
  {
    title: 'Preference Cookies',
    body: 'These cookies remember your settings and preferences (such as language and display options) across sessions so you do not need to reconfigure them each time.',
  },
  {
    title: 'Your Rights',
    body: 'Under GDPR Article 7, you may withdraw consent at any time. You may also instruct your browser to block or delete all cookies. Withdrawing consent will not affect the lawfulness of processing based on consent before its withdrawal.',
  },
]

export default function CookiesPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Header card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: Sh.float,
            padding: '36px 40px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '100px',
              fontSize: '10px',
              fontWeight: 700,
              color: T.blue,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              ...Glass.chip,
            }}
          >
            GDPR Compliant
          </div>

          <h1
            style={{
              margin: '0 0 12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 'clamp(22px, 4vw, 30px)',
              fontWeight: 800,
              color: T.navy,
              letterSpacing: '-0.03em',
            }}
          >
            Cookie Policy
          </h1>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '14px',
              color: T.slate,
              lineHeight: 1.7,
            }}
          >
            Qarevo Health uses a minimal set of cookies to operate the platform securely and improve your experience.
            We never sell data or use tracking cookies for advertising purposes.
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: T.slate2 }}>
            Last updated: 1 August 2025
          </p>
        </div>

        {/* Section cards */}
        {SECTIONS.map(({ title, body }) => (
          <div
            key={title}
            style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.86)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(4,53,77,0.07)',
              padding: '24px 32px',
              marginBottom: '12px',
            }}
          >
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '15.5px',
                fontWeight: 700,
                color: T.navy,
                letterSpacing: '-0.025em',
                margin: '0 0 8px',
              }}
            >
              {title}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
              {body}
            </p>
          </div>
        ))}

        {/* Back link */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
            ← Return to Home
          </Link>
          <span style={{ color: T.slate2, fontSize: '14px' }}>·</span>
          <Link href="/privacy" style={{ color: T.slate2, textDecoration: 'none', fontSize: '14px' }}>
            Privacy Policy
          </Link>
          <span style={{ color: T.slate2, fontSize: '14px' }}>·</span>
          <Link href="/terms" style={{ color: T.slate2, textDecoration: 'none', fontSize: '14px' }}>
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  )
}

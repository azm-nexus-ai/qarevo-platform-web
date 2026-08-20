'use client'

import Link from 'next/link'
import { T, Glass } from '@/lib/tokens'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'

const FOOTER_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Support', href: '/support' },
  { label: 'Contact', href: '/auth' },
]

const PRODUCT_LINKS = [
  { label: 'Platform Overview', href: '/#hero' },
  { label: 'Clinical Intelligence', href: '/#clinical-intelligence' },
  { label: 'Security & Governance', href: '/#security-governance' },
  { label: 'Whitepaper', href: '/whitepaper' },
]

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.54)',
        backdropFilter: 'blur(24px) saturate(150%)',
        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        borderTop: '1px solid rgba(255,255,255,0.72)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '48px 32px 32px',
        }}
        className="container-pad"
      >
        {/* Top row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '40px',
            marginBottom: '40px',
            alignItems: 'start',
          }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <Link href="/" aria-label="Qarevo Health home" style={{ display: 'inline-block', marginBottom: '14px', textDecoration: 'none' }}>
              <AuthenticatedLogo width={130} />
            </Link>
            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.7,
                color: T.slate2,
                maxWidth: '260px',
                margin: 0,
                letterSpacing: '-0.005em',
              }}
            >
              European healthcare engineered for precision. Verified physicians, clinical AI, and enterprise-grade data governance.
            </p>
          </div>

          {/* Product links */}
          <div>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: T.slate2,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                margin: '0 0 14px',
              }}
            >
              Platform
            </p>
            <nav aria-label="Footer platform links">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    color: T.slate,
                    textDecoration: 'none',
                    marginBottom: '8px',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.blue)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.slate)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal links */}
          <div>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: T.slate2,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                margin: '0 0 14px',
              }}
            >
              Legal & Support
            </p>
            <nav aria-label="Footer legal links">
              {FOOTER_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    color: T.slate,
                    textDecoration: 'none',
                    marginBottom: '8px',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.blue)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.slate)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(4,53,77,0.1) 20%, rgba(4,53,77,0.1) 80%, transparent)',
            marginBottom: '24px',
          }}
          aria-hidden="true"
        />

        {/* Bottom row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: T.slate2,
              margin: 0,
              letterSpacing: '-0.005em',
            }}
          >
            © {new Date().getFullYear()} Qarevo Health. All rights reserved. EU GDPR Compliant.
          </p>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0F9E77',
                letterSpacing: '-0.01em',
                ...Glass.chip,
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#0F9E77',
                  flexShrink: 0,
                }}
              />
              CE Marked
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 600,
                color: T.blue,
                letterSpacing: '-0.01em',
                ...Glass.chip,
              }}
            >
              ISO 27001
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

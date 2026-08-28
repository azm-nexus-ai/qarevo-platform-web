'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

// ─── Left panel mesh background ───────────────────────────────────────────────

const PANEL_BG = [
  'radial-gradient(ellipse 80% 60% at 20% 10%,  rgba(32,181,223,0.32)  0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 85% 18%,  rgba(32,181,223,0.22)  0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 55% 100%, rgba(52,140,234,0.26) 0%, transparent 58%)',
  'radial-gradient(ellipse 50% 45% at 92% 82%,  rgba(165,224,218,0.18)  0%, transparent 50%)',
  'radial-gradient(ellipse 90% 80% at 5%  90%,  rgba(32,181,223,0.14)  0%, transparent 55%)',
  T.navy,
].join(', ')

// ─── Floating glass stat card ──────────────────────────────────────────────────

function FloatCard({
  top, left, right, bottom,
  icon, iconColor, iconBg,
  label, value, sub, subColor,
  style: extraStyle,
}: {
  top?: string; left?: string; right?: string; bottom?: string
  icon: string | readonly string[]
  iconColor: string; iconBg: string
  label: string; value: string; sub: string; subColor: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      position: 'absolute',
      top, left, right, bottom,
      padding: '14px 18px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.13)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
      minWidth: '148px',
      ...extraStyle,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ico p={icon} size={14} sw={1.75} color={iconColor} />
        </div>
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: '11.5px', fontWeight: 600, color: subColor }}>{sub}</div>
    </div>
  )
}

// ─── Abstract healthcare visualization ────────────────────────────────────────

function HealthVisual() {
  return (
    <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', inset: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)' }} />
      <div style={{ position: 'absolute', inset: '72px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)' }} />

      <div style={{
        position: 'absolute', inset: '108px', borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.35) 0%, rgba(32,181,223,0.18) 50%, transparent 75%)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(52,140,234,0.28)',
        boxShadow: '0 0 60px rgba(32,181,223,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico p={ICONS.heart} size={38} sw={1.25} color="rgba(255,255,255,0.88)" />
      </div>

      {[
        { angle: 0,   icon: ICONS.brain,    bg: 'rgba(52,140,234,0.25)',  border: 'rgba(52,140,234,0.3)' },
        { angle: 72,  icon: ICONS.shield,   bg: 'rgba(9,173,112,0.25)',   border: 'rgba(165,224,218,0.3)'  },
        { angle: 144, icon: ICONS.activity, bg: 'rgba(32,181,223,0.25)',   border: 'rgba(52,140,234,0.3)'  },
        { angle: 216, icon: ICONS.steth,    bg: 'rgba(32,181,223,0.25)',   border: 'rgba(165,224,218,0.3)'  },
        { angle: 288, icon: ICONS.cpu,      bg: 'rgba(217,119,6,0.2)',    border: 'rgba(251,191,36,0.25)' },
      ].map(({ angle, icon, bg, border }) => {
        const r = 120
        const rad = (angle - 90) * Math.PI / 180
        const x = 150 + r * Math.cos(rad)
        const y = 150 + r * Math.sin(rad)
        return (
          <div key={angle} style={{
            position: 'absolute',
            left: `${x - 22}px`, top: `${y - 22}px`,
            width: '44px', height: '44px', borderRadius: '14px',
            background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${border}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico p={icon} size={18} sw={1.5} color="rgba(255,255,255,0.85)" />
          </div>
        )
      })}

      <svg viewBox="0 0 300 28" style={{ position: 'absolute', bottom: '10px', left: 0, width: '100%', opacity: 0.5 }}>
        <polyline points="0,14 55,14 72,3 82,25 92,3 102,25 116,14 300,14" fill="none" stroke="rgba(52,140,234,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="102" cy="25" r="2.5" fill="rgba(52,140,234,0.9)" />
      </svg>
    </div>
  )
}

// ─── Left panel ────────────────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div style={{
      background: PANEL_BG,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 48px',
      overflow: 'hidden',
      height: '100%',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1.2px)', backgroundSize: '24px 24px' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-100px', right: '-80px', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.16) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label='Qarevo Health home'>
          <Image
            src='/brand/Untitled design - 2026-08-03T165058.603.png'
            alt='Qarevo Health'
            width={160}
            height={34}
            priority
            unoptimized
            style={{ width: '160px', height: 'auto' }}
          />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        <HealthVisual />
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(22px, 2.4vw, 30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.15, margin: '0 0 12px' }}>
            Clinical intelligence.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Beautifully coordinated.</span>
          </h2>
          <p style={{ fontSize: '14.5px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            180,000 patients across Europe trust Qarevo for verified physicians, AI-powered diagnostics, and seamless care coordination.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', height: '108px', marginBottom: '24px' }}>
          <FloatCard top="0" left="0" icon={ICONS.user} iconColor="rgba(52,140,234,0.9)" iconBg="rgba(52,140,234,0.22)" label="Active Patients" value="180K+" sub="↑ 12% this month" subColor="rgba(110,231,183,0.85)" />
          <FloatCard top="0" right="0" icon={ICONS.steth} iconColor="rgba(165,224,218,0.9)" iconBg="rgba(9,173,112,0.22)" label="Physicians" value="4,200+" sub="Verified & active" subColor="rgba(147,197,253,0.8)" />
          <FloatCard bottom="0" style={{ left: '50%', transform: 'translateX(-50%)' }} icon={ICONS.shield} iconColor="rgba(52,140,234,0.9)" iconBg="rgba(32,181,223,0.22)" label="Satisfaction" value="98%" sub="Patient-rated" subColor="rgba(251,191,36,0.85)" />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['HIPAA', 'GDPR', 'ISO 27001', 'SOC 2 Type II'].map(b => (
            <span key={b} style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.04em' }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Social button ─────────────────────────────────────────────────────────────

function SocialBtn({ provider, onClick }: { provider: 'google' | 'microsoft'; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cfg = {
    google: {
      label: 'Continue with Google',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.075 17.64 11.767 17.64 9.2z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
      ),
    },
    microsoft: {
      label: 'Continue with Microsoft',
      icon: (
        <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
      ),
    },
  }[provider]

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '13px 18px', borderRadius: '13px',
        border: `1.5px solid ${hovered ? 'rgba(4,53,77,0.14)' : T.border}`,
        background: hovered ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '11px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
        color: T.navy, letterSpacing: '-0.015em', transition: 'all 0.15s ease',
        boxShadow: hovered ? '0 2px 8px rgba(4,53,77,0.1), inset 0 1px 0 #fff' : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(4,53,77,0.06)',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  )
}

// ─── Right panel ───────────────────────────────────────────────────────────────

function RightPanel() {
  const router = useRouter()
  const [primaryHov, setPrimaryHov] = useState(false)
  const [secondaryHov, setSecondaryHov] = useState(false)

  return (
    <div style={{
      flex: 1, background: '#EDF2FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px', minHeight: '100vh', position: 'relative',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 60% at 80% 20%, rgba(32,181,223,0.07) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(52,140,234,0.06) 0%, transparent 55%)' }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '420px',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 20px 60px rgba(4,53,77,0.1), 0 60px 120px rgba(4,53,77,0.07)',
        padding: '44px 40px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '26px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Welcome to<br />Qarevo Health
          </h1>
          <p style={{ fontSize: '14.5px', color: T.slate, lineHeight: 1.68, margin: '0 auto', letterSpacing: '-0.01em', maxWidth: '300px' }}>
            Securely access your healthcare journey powered by intelligent care coordination.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <Link
            href="/auth/sign-up"
            onMouseEnter={() => setPrimaryHov(true)}
            onMouseLeave={() => setPrimaryHov(false)}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
              background: primaryHov ? 'linear-gradient(135deg,#348CEA 0%,#0F47B8 100%)' : `linear-gradient(135deg,${T.blue} 0%,#348CEA 100%)`,
              color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
              letterSpacing: '-0.02em', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s ease', textDecoration: 'none',
              boxShadow: primaryHov ? '0 8px 24px rgba(32,181,223,0.45)' : '0 3px 10px rgba(32,181,223,0.32), 0 1px 3px rgba(32,181,223,0.2)',
              transform: primaryHov ? 'translateY(-1px)' : 'none',
            }}
          >
            Get Started
            <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
          </Link>

          <Link
            href="/auth/doctor-register"
            onMouseEnter={() => setSecondaryHov(true)}
            onMouseLeave={() => setSecondaryHov(false)}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: '13px',
              border: `1.5px solid ${secondaryHov ? 'rgba(4,53,77,0.14)' : T.border}`,
              background: secondaryHov ? 'rgba(4,53,77,0.04)' : 'rgba(4,53,77,0.02)',
              color: T.navy, fontFamily: 'inherit', fontSize: '15px', fontWeight: 600,
              letterSpacing: '-0.02em', cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: secondaryHov ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.6)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Physician Registration
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(4,53,77,0.08)' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: T.slate2, whiteSpace: 'nowrap' }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(4,53,77,0.08)' }} />
        </div>

        <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: 0, letterSpacing: '-0.01em' }}>
          Already have an account?{' '}
          <Link href="/auth/sign-in" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
          {' '}or{' '}
          <Link href="/auth/doctor/login" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>Physician Portal</Link>
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
          <Ico p={ICONS.shield} size={12} sw={1.75} color={T.slate2} />
          <span style={{ fontSize: '11.5px', color: T.slate2, letterSpacing: '-0.01em' }}>HIPAA & GDPR compliant · AES-256 encrypted</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{`* { box-sizing: border-box; } @media (max-width: 860px) { .auth-left { display: none !important; } }`}</style>
      <div className="auth-left" style={{ flex: '0 0 52%' }}>
        <LeftPanel />
      </div>
      <RightPanel />
    </div>
  )
}

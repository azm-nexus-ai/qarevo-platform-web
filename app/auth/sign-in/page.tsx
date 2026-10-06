'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { getOnboardingRedirectPath, readAuthFlowState } from '@/lib/auth-flow'
import { ApiError, getApiErrorDetail, loginPatient, loginPatientWithPasskey, storeAuthTokens } from '@/lib/api'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

// ─── Page bg ──────────────────────────────────────────────────────────────────

const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at 12% 8%,   rgba(32,181,223,0.08) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 90% 18%,  rgba(32,181,223,0.06) 0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  '#EDF2FA',
].join(', ')

// ─── Left panel ────────────────────────────────────────────────────────────────

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

const TRUST_FEATURES = [
  { icon: ICONS.lock,     label: 'Secure Medical Records',     sub: 'AES-256 encrypted at rest and in transit' },
  { icon: ICONS.brain,    label: 'AI-Assisted Healthcare',     sub: 'Personalised clinical intelligence' },
  { icon: ICONS.video,    label: 'Virtual Consultations',      sub: 'HD video with verified physicians' },
  { icon: ICONS.shield,   label: 'End-to-End Encryption',      sub: 'HIPAA & GDPR compliant infrastructure' },
]

function WellnessVisual() {
  return (
    <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto', flexShrink: 0 }}>
      {/* Rings */}
      {[0, 28, 56].map((inset, i) => (
        <div key={i} style={{ position: 'absolute', inset, borderRadius: '50%', border: `1px solid rgba(255,255,255,${0.05 + i * 0.04})` }} />
      ))}
      {/* Core orb */}
      <div style={{
        position: 'absolute', inset: '84px', borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, rgba(52,140,234,0.32) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)',
        border: '1px solid rgba(52,140,234,0.26)',
        boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico p={ICONS.heart} size={34} sw={1.25} color="rgba(255,255,255,0.9)" />
      </div>
      {/* Pulse ripple */}
      <div style={{
        position: 'absolute', inset: '72px', borderRadius: '50%',
        border: '1px solid rgba(52,140,234,0.18)',
        animation: 'none',
      }} />
      {/* Orbit nodes */}
      {[
        { angle: 0,   icon: ICONS.steth,    bg: 'rgba(9,173,112,0.28)',  border: 'rgba(165,224,218,0.3)'  },
        { angle: 90,  icon: ICONS.shield,   bg: 'rgba(32,181,223,0.28)',  border: 'rgba(52,140,234,0.3)'  },
        { angle: 180, icon: ICONS.activity, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.lock,     bg: 'rgba(32,181,223,0.28)',  border: 'rgba(165,224,218,0.3)'  },
      ].map(({ angle, icon, bg, border }) => {
        const r = 100, rad = (angle - 90) * Math.PI / 180
        const x = 130 + r * Math.cos(rad), y = 130 + r * Math.sin(rad)
        return (
          <div key={angle} style={{
            position: 'absolute', left: `${x - 20}px`, top: `${y - 20}px`,
            width: '40px', height: '40px', borderRadius: '13px',
            background: bg, border: `1px solid ${border}`,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico p={icon} size={17} sw={1.5} color="rgba(255,255,255,0.88)" />
          </div>
        )
      })}
      {/* ECG */}
      <svg viewBox="0 0 260 24" style={{ position: 'absolute', bottom: '8px', left: 0, width: '100%', opacity: 0.45 }}>
        <polyline points="0,12 48,12 64,2 72,22 80,2 88,22 100,12 260,12" fill="none" stroke="rgba(52,140,234,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="88" cy="22" r="2.5" fill="rgba(52,140,234,0.9)" />
      </svg>
    </div>
  )
}

function LeftPanel() {
  return (
    <div style={{
      width: '380px', flexShrink: 0,
      background: LEFT_BG,
      position: 'sticky', top: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 44px 44px',
      overflow: 'hidden',
    }}>
      {/* Dot grid */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Logo */}
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

      {/* Centre content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <WellnessVisual />
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Welcome back.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Your care awaits.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Continue managing your health with trusted physicians and AI-powered clinical intelligence.
          </p>
        </div>
      </div>

      {/* Feature list */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {TRUST_FEATURES.map(({ icon, label, sub }, i) => (
          <div key={label} style={{ display: 'flex', gap: '13px', alignItems: 'flex-start', padding: '13px 0', borderTop: i === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
              <Ico p={icon} size={14} sw={1.5} color="rgba(147,197,253,0.9)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '-0.015em', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Primitives ────────────────────────────────────────────────────────────────

function Field({ label, placeholder, type = 'text', value, onChange, onBlur, error, success, icon, rightSlot, autoComplete }: {
  label: string; placeholder: string; type?: string
  value: string; onChange: (v: string) => void; onBlur?: () => void
  error?: string; success?: boolean
  icon?: string | readonly string[]
  rightSlot?: React.ReactNode
  autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  const id = useId()

  const bdr   = error ? 'rgba(220,38,38,0.55)' : success ? 'rgba(9,173,112,0.5)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'
  const glow  = focused ? (error ? '0 0 0 3px rgba(220,38,38,0.08)' : '0 0 0 3px rgba(32,181,223,0.09)') : 'none'
  const bg    = error ? '#FFF5F5' : success ? '#F0FDF8' : focused ? '#fff' : 'rgba(255,255,255,0.7)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.blue : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
            <Ico p={icon} size={14} sw={1.75} />
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.() }}
          style={{
            width: '100%',
            padding: `12px ${rightSlot || success || error ? '40px' : '14px'} 12px ${icon ? '38px' : '14px'}`,
            borderRadius: '11px', border: `1.5px solid ${bdr}`,
            background: bg, color: T.navy, fontSize: '14px', fontFamily: 'inherit',
            outline: 'none', boxShadow: glow, transition: 'all 0.15s ease',
            letterSpacing: type === 'password' ? '0.08em' : 'normal',
          }}
        />
        {(rightSlot || success || error) && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {rightSlot
              ? rightSlot
              : success ? <Ico p={ICONS.check} size={14} sw={2.5} color={T.green} />
              : <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} />}
          </span>
        )}
      </div>
      {error && <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.4 }}>{error}</p>}
    </div>
  )
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: 'pointer', userSelect: 'none' }}>
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={onChange}
        onKeyDown={e => e.key === ' ' && onChange()}
        style={{
          width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
          border: `1.5px solid ${checked ? T.blue : 'rgba(4,53,77,0.18)'}`,
          background: checked ? T.blue : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.14s', boxShadow: checked ? '0 1px 4px rgba(32,181,223,0.25)' : 'none',
          outline: 'none',
        }}
      >
        {checked && <Ico p={ICONS.check} size={9} sw={3} color="#fff" />}
      </div>
      <span style={{ fontSize: '13px', color: T.slate, letterSpacing: '-0.005em' }}>{children}</span>
    </label>
  )
}

function SocialBtn({ provider, onClick }: { provider: 'google' | 'apple'; onClick?: () => void }) {
  const [h, setH] = useState(false)
  const isApple = provider === 'apple'
  const label = isApple ? 'Continue with Apple' : 'Continue with Google'

  const googleIcon = (
    <svg width="17" height="17" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.075 17.64 11.767 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
  const appleIcon = (
    <svg width="16" height="16" viewBox="0 0 814 1000" fill="white" style={{ flexShrink: 0 }}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-47.4-148.2-87.5c-50.2-45.2-91.2-116.4-91.2-183.9 0-191.3 133.4-293.3 264.4-293.3 64 0 117.4 42.2 158.1 42.2 39 0 99.5-44.4 168.1-44.4 27.4 0 109.8 2.6 168.1 71.2zm-56.7-194.4c26.1-30.8 44.9-73.8 44.9-116.8 0-5.8-.6-11.6-1.9-16.8-42.2 1.9-91.9 28.1-122 62.8-23.8 26.7-45.8 70.6-45.8 114.2 0 6.4.6 12.9 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 37.4 0 82.8-23.2 109.3-62.8z"/>
    </svg>
  )

  return (
    <button
      type="button"
      className="signin-social-btn"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        flex: 1, padding: '11px 14px', borderRadius: '11px', cursor: 'pointer',
        border: isApple ? 'none' : `1.5px solid ${h ? 'rgba(4,53,77,0.13)' : T.border}`,
        background: isApple
          ? h ? T.navy2 : T.navy
          : h ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
        fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600,
        color: isApple ? '#fff' : T.navy,
        letterSpacing: '-0.01em', transition: 'all 0.14s ease',
        boxShadow: isApple
          ? h ? '0 4px 14px rgba(4,53,77,0.3)' : Sh.inner
          : h ? '0 2px 8px rgba(4,53,77,0.09)' : 'inset 0 1px 0 rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
      }}
    >
      {isApple ? appleIcon : googleIcon}
      {label}
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getFriendlySignInError(error: unknown) {
  const detail = getApiErrorDetail(error)?.toLowerCase() ?? ''

  if (detail.includes('valid email') || detail.includes('email address')) {
    return 'Enter a valid email address. Doctor accounts should use the doctor sign-in page.'
  }
  if (detail.includes('incorrect') || detail.includes('invalid') || detail.includes('password')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (detail.includes('verify') || detail.includes('verification')) {
    return 'Please verify your account before signing in.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Incorrect email or password. Please try again.'
  }
  if (error instanceof ApiError && error.status === 422) {
    return 'Please check your email and password, then try again.'
  }
  if (error instanceof ApiError && error.status >= 500) {
    return 'Sign in is temporarily unavailable. Please try again shortly.'
  }
  if (error instanceof Error && /passkey|browser|cancelled/i.test(error.message)) {
    return error.message
  }

  return 'We could not sign you in right now. Please try again.'
}

export default function SignInPage() {
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [touched,  setTouched]  = useState({ email: false, password: false })
  const [authError, setAuthError] = useState('')

  const emailErr = touched.email && !EMAIL_RE.test(email) ? 'Enter a valid email address' : ''
  const passErr  = touched.password && password.length < 1 ? 'Password is required' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!EMAIL_RE.test(email) || !password) return
    setLoading(true)
    setAuthError('')

    try {
      const response = await loginPatient({ email, password })
      storeAuthTokens({ ...response, role: 'PATIENT' })
      const authFlowState = readAuthFlowState()
      if (authFlowState?.isAuthenticated) {
        const nextRoute = authFlowState.onboardingCompleted
          ? '/patient/dashboard'
          : getOnboardingRedirectPath(authFlowState)
        router.push(nextRoute)
        return
      }

      const onboardingIncomplete = /new|incomplete|onboard/i.test(email)
      router.push(onboardingIncomplete ? '/auth/profile-setup' : '/patient/dashboard')
    } catch (error) {
      setAuthError(getFriendlySignInError(error))
    } finally {
      setLoading(false)
    }
  }

  const completePatientSignIn = () => {
    const authFlowState = readAuthFlowState()
    if (authFlowState?.isAuthenticated) {
      const nextRoute = authFlowState.onboardingCompleted
        ? '/patient/dashboard'
        : getOnboardingRedirectPath(authFlowState)
      router.push(nextRoute)
      return
    }

    router.push('/patient/dashboard')
  }

  const handlePasskeySignIn = async () => {
    setTouched((current) => ({ ...current, email: true }))
    if (!EMAIL_RE.test(email)) return

    setPasskeyLoading(true)
    setAuthError('')
    try {
      const response = await loginPatientWithPasskey(email)
      storeAuthTokens({ ...response, role: 'PATIENT' })
      completePatientSignIn()
    } catch (error) {
      setAuthError(getFriendlySignInError(error))
    } finally {
      setPasskeyLoading(false)
    }
  }

  const pwToggle = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShowPw(s => !s)}
      aria-label={showPw ? 'Hide password' : 'Show password'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex' }}
    >
      <Ico p={showPw ? ICONS.eyeOff : ICONS.eye} size={14} sw={1.75} />
    </button>
  )

  return (
    <div className="signin-page" style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', width: '100%', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(4,53,77,0.3); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shake { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-5px); } 40%,80% { transform:translateX(5px); } }
        @media (max-width: 860px) {
          .signin-left { display: none !important; }
          .signin-form-area {
            min-height: 100svh !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            padding: 24px 16px 30px !important;
            width: 100% !important;
          }
          .signin-form-wrap {
            width: 100% !important;
            max-width: 520px !important;
            margin: 0 auto !important;
          }
          .signin-card {
            width: 100% !important;
            max-width: 100% !important;
            padding: 32px 24px 28px !important;
          }
        }
        .signin-page { min-width: 0; }
        .signin-form-area,
        .signin-form-wrap,
        .signin-card { min-width: 0; }
        .signin-social-btn { min-width: 0; }
        @media (max-width: 640px) {
          .signin-page { display: block !important; }
          .signin-form-area {
            min-height: 100svh !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            padding: 22px 14px 28px !important;
            width: 100% !important;
          }
          .signin-form-wrap {
            width: 100% !important;
            max-width: none !important;
          }
          .signin-card {
            width: 100% !important;
            max-width: 100% !important;
            padding: 24px 18px 22px !important;
            border-radius: 20px !important;
          }
          .signin-logo-row {
            gap: 14px !important;
            margin-bottom: 22px !important;
          }
          .signin-logo-row h1 {
            font-size: 22px !important;
            letter-spacing: 0 !important;
          }
          .signin-social-row {
            flex-direction: column !important;
          }
          .signin-social-btn {
            width: 100% !important;
            flex: none !important;
          }
          .signin-trust-grid {
            gap: 10px 14px !important;
          }
        }
        @media (max-width: 380px) {
          .signin-form-area { padding-left: 10px !important; padding-right: 10px !important; }
          .signin-card { padding-left: 14px !important; padding-right: 14px !important; }
          .signin-card-mark { display: none !important; }
          .signin-logo-row h1 { font-size: 20px !important; }
        }
      `}</style>

      {/* Left panel */}
      <div className="signin-left">
        <LeftPanel />
      </div>

      {/* Right: form area */}
      <div className="signin-form-area" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh' }}>
        <div className="signin-form-wrap" style={{ width: '100%', maxWidth: '460px' }}>

          {/* Back */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back
          </Link>

          {/* Card */}
          <div className="signin-card" style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
            padding: '40px 40px 36px',
            animation: authError ? 'shake 0.35s ease' : 'none',
          }}>

            {/* Logo mark */}
            <div className="signin-logo-row" style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>
                  Sign in to Qarevo
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  Welcome back - your care ecosystem is ready.
                </p>
              </div>
              <div className="signin-card-mark" style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.heart} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {/* Auth error banner */}
            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: '11px', background: '#FFF5F5', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: T.red, lineHeight: 1.5, letterSpacing: '-0.005em' }}>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Email */}
                <Field
                  label="Email Address"
                  placeholder="emma@example.com"
                  type="email"
                  value={email}
                  onChange={v => { setEmail(v); setAuthError('') }}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  error={emailErr}
                  success={EMAIL_RE.test(email)}
                  icon={ICONS.ema}
                  autoComplete="email"
                />

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Password</label>
                    <Link href="/auth/forgot-password" style={{ fontSize: '12.5px', fontWeight: 600, color: T.blue, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <Field
                    label=""
                    placeholder="Your password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={v => { setPassword(v); setAuthError('') }}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    error={passErr}
                    icon={ICONS.lock}
                    rightSlot={!passErr ? pwToggle : undefined}
                    autoComplete="current-password"
                  />
                </div>

                {/* Remember me */}
                <Checkbox checked={remember} onChange={() => setRemember(r => !r)}>
                  Remember me for 30 days
                </Checkbox>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
                    background: loading ? 'rgba(32,181,223,0.5)' : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                    color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
                    letterSpacing: '-0.02em', cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: loading ? 'none' : '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                    marginTop: '4px',
                  }}
                >
                  {loading
                    ? <><span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Signing in…</>
                    : <>Continue <Ico p={ICONS.arrowFwd} size={15} sw={2.2} /></>}
                </button>

                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading || loading}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '13px',
                    border: '1.5px solid rgba(4,53,77,0.1)',
                    background: passkeyLoading ? 'rgba(247,250,252,0.72)' : 'rgba(255,255,255,0.78)',
                    color: T.navy,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    cursor: passkeyLoading || loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                  }}
                >
                  {passkeyLoading
                    ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(4,53,77,0.18)', borderTopColor: T.blue, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Checking passkey…</>
                    : <><Ico p={ICONS.shield} size={15} sw={1.8} /> Sign in with passkey</>}
                </button>

                {/* Create account */}
                <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '2px 0 0', letterSpacing: '-0.01em' }}>
                  {"Don't have an account? "}
                  <Link href="/auth/sign-up" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
                </p>
              </div>
            </form>

            {/* Social */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(4,53,77,0.08)' }} />
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>or continue with</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(4,53,77,0.08)' }} />
              </div>
              <div className="signin-social-row" style={{ display: 'flex', gap: '10px' }}>
                <SocialBtn provider="google" onClick={() => {
                  const authFlowState = readAuthFlowState()
                  const nextRoute = authFlowState?.isAuthenticated && !authFlowState.onboardingCompleted
                    ? getOnboardingRedirectPath(authFlowState)
                    : '/patient/dashboard'
                  router.push(nextRoute)
                }} />
                <SocialBtn provider="apple" onClick={() => {
                  const authFlowState = readAuthFlowState()
                  const nextRoute = authFlowState?.isAuthenticated && !authFlowState.onboardingCompleted
                    ? getOnboardingRedirectPath(authFlowState)
                    : '/patient/dashboard'
                  router.push(nextRoute)
                }} />
              </div>
            </div>

            {/* Trust indicators */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div className="signin-trust-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.lock,     label: 'Secure Login'    },
                  { icon: ICONS.shield,   label: 'Encrypted Data'  },
                  { icon: ICONS.check,    label: 'HIPAA · GDPR'    },
                  { icon: ICONS.activity, label: 'MFA Support'     },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: '12px', color: T.slate2, marginTop: '20px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
            By signing in you agree to our{' '}
            <Link href="/terms" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

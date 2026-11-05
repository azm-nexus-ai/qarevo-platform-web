'use client'
import PortalSignInReference, { WrongPortalNotice } from '@/components/auth/PortalSignInReference'
import SessionPolicyHint from '@/components/auth/SessionPolicyHint'
import { authenticatedPortalHandoff, safePortalDestination, type PortalHandoff } from '@/lib/portal-handoff'

import { useState, useId, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useLoginCooldown } from '@/lib/use-login-cooldown'
import { getOnboarding, onboardingPath } from '@/lib/patient-onboarding'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { setAuthenticatedOnboardingStage } from '@/lib/auth-flow'
import { ApiError, getApiErrorDetail, getLoginThrottleMessage, loginPatient, loginPatientWithPasskey, type AuthTokenResponse } from '@/lib/api'
import { usePortalAction } from '@/lib/portal-action'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import SocialSignInButtons from '@/components/auth/SocialSignInButtons'

// ─── Page bg ──────────────────────────────────────────────────────────────────

const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at 12% 8%,   rgba(32,181,223,0.08) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 90% 18%,  rgba(32,181,223,0.06) 0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  'var(--canvas)',
].join(', ')

// ─── Left panel ────────────────────────────────────────────────────────────────

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.brandNavy,
].join(', ')

const TRUST_FEATURES = [
  { icon: ICONS.lock,     label: 'Medical Records',            sub: 'View the records saved to your account' },
  { icon: ICONS.steth,    label: 'Clinician-Led Care',         sub: 'Your clinician reviews consultation information' },
  { icon: ICONS.video,    label: 'Consultation Appointments',   sub: 'View and manage your appointments' },
  { icon: ICONS.shield,   label: 'Account-Based Access',      sub: 'Access your saved account information' },
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
      position: 'relative', flex: 1, minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '32px',
      padding: '44px 44px 44px',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Dot grid */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
      </div>

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
          <h2 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Welcome back.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Your care awaits.</span>
          </h2>
          <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Access your appointments, saved medical records and clinician-approved care information.
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
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Primitives ────────────────────────────────────────────────────────────────

function Field({ label, placeholder, type = 'text', value, onChange, onBlur, error, success, icon, rightSlot, autoComplete, inputId }: {
  label: string; placeholder: string; type?: string
  value: string; onChange: (v: string) => void; onBlur?: () => void
  error?: string; success?: boolean
  icon?: string | readonly string[]
  rightSlot?: React.ReactNode
  autoComplete?: string
  inputId?: string
}) {
  const [focused, setFocused] = useState(false)
  const generatedId = useId()
  const id = inputId || generatedId

  const bdr   = error ? 'rgba(220,38,38,0.55)' : success ? 'rgba(9,173,112,0.5)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'
  const glow  = focused ? (error ? '0 0 0 3px rgba(220,38,38,0.08)' : '0 0 0 3px rgba(32,181,223,0.09)') : 'none'
  const bg    = error ? '#FFF5F5' : success ? '#F0FDF8' : focused ? '#fff' : 'rgba(255,255,255,0.7)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.link : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
            <Ico p={icon} size={14} sw={1.75} />
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
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
      {error && <p id={`${id}-error`} role="alert" style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{error}</p>}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const subscribeToPasskeySupport = () => () => {}
const passkeySupported = () => window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials?.get
const serverPasskeySupport = () => false

function getFriendlySignInError(error: unknown) {
  const throttle = getLoginThrottleMessage(error)
  if (throttle) return throttle

  const detail = getApiErrorDetail(error)?.toLowerCase() ?? ''

  if (error instanceof ApiError && error.status === 422 && (detail.includes('email') || detail.includes('e-mail'))) {
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
  const captureAction = usePortalAction()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [touched,  setTouched]  = useState({ email: false, password: false })
  const [authError, setAuthError] = useState('')
  const [handoff, setHandoff] = useState<PortalHandoff | null>(null)
  const cooldown = useLoginCooldown()
  const supportsPasskeys = useSyncExternalStore(subscribeToPasskeySupport, passkeySupported, serverPasskeySupport)

  const emailErr = touched.email && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : ''
  const passErr  = touched.password && password.length < 1 ? 'Password is required' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || cooldown.seconds > 0) return
    setTouched({ email: true, password: true })
    if (!EMAIL_RE.test(email.trim()) || !password) return
    setLoading(true)
    setAuthError(''); setHandoff(null)
    const action = captureAction()
    let response: AuthTokenResponse | undefined
    const current = () => action.isCurrent({ completedSession: response?.browser_session })
    try {
      response = await loginPatient({ email: email.trim(), password })
      if (current()) await completePatientSignIn(current)
    } catch (error) {
      if (!current()) return
      cooldown.record(error)
      const wrongPortal = authenticatedPortalHandoff(error)
      setHandoff(wrongPortal)
      setAuthError(wrongPortal ? '' : getFriendlySignInError(error))
    } finally {
      if (current()) setLoading(false)
    }
  }

  const completePatientSignIn = async (current: () => boolean) => {
    if (!current()) return
    if (new URLSearchParams(window.location.search).get('next') === 'profile-setup') {
      setAuthenticatedOnboardingStage('personal-information')
      router.replace('/auth/profile-setup/personal-information')
      return
    }
    const progress = await getOnboarding()
    if (!current()) return
    const intended = safePortalDestination(new URLSearchParams(window.location.search).get('next'), 'PATIENT')
    router.replace(progress.complete ? intended || '/patient/dashboard' : onboardingPath(progress.next_step))
  }

  const handlePasskeySignIn = async () => {
    if (!supportsPasskeys || loading || passkeyLoading || cooldown.seconds > 0) return
    setTouched((current) => ({ ...current, email: true }))
    if (!EMAIL_RE.test(email.trim())) return

    setPasskeyLoading(true)
    setAuthError(''); setHandoff(null)
    const action = captureAction()
    let response: AuthTokenResponse | undefined
    const current = () => action.isCurrent({ completedSession: response?.browser_session })
    try {
      response = await loginPatientWithPasskey(email.trim())
      if (current()) await completePatientSignIn(current)
    } catch (error) {
      if (!current()) return
      cooldown.record(error)
      const wrongPortal = authenticatedPortalHandoff(error)
      setHandoff(wrongPortal)
      setAuthError(wrongPortal ? '' : getFriendlySignInError(error))
    } finally {
      if (current()) setPasskeyLoading(false)
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
    <div className="signin-page" style={{ minHeight: '100dvh', background: PAGE_BG, display: 'flex', alignItems: 'stretch', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: var(--text-muted); }
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
        .signin-left { display: flex; align-self: stretch; min-height: 100dvh; }
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
            background: "var(--surface-glass)",
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: "1px solid var(--border)",
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
            padding: '40px 40px 36px',
            animation: authError ? 'shake 0.35s ease' : 'none',
          }}>

            {/* Logo mark */}
            <div className="signin-logo-row" style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>
                  Sign in to Qarevo
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  Welcome back - your care ecosystem is ready.
                </p>
              </div>
              <div className="signin-card-mark" style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.heart} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {handoff && <WrongPortalNotice handoff={handoff}/>}
            {/* Auth error banner */}
            {(cooldown.message || authError) && (
              <div role="alert" style={{ padding: '12px 16px', borderRadius: '11px', background: "var(--danger-soft)", border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: T.red, lineHeight: 1.5, letterSpacing: '-0.005em' }}>{cooldown.message || authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Email */}
                <Field
                  label="Email Address (Required)"
                  placeholder="emma@example.com"
                  type="email"
                  value={email}
                  onChange={v => { setEmail(v); setAuthError(''); setHandoff(null) }}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  error={emailErr}
                  success={EMAIL_RE.test(email.trim())}
                  icon={ICONS.ema}
                  autoComplete="email"
                />

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <label htmlFor="patient-password" style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Password (Required)</label>
                    <Link href="/auth/forgot-password" style={{ fontSize: "13px", fontWeight: 600, color: T.link, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <Field
                    label=""
                    inputId="patient-password"
                    placeholder="Your password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={v => { setPassword(v); setAuthError(''); setHandoff(null) }}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    error={passErr}
                    icon={ICONS.lock}
                    rightSlot={!passErr ? pwToggle : undefined}
                    autoComplete="current-password"
                  />
                </div>

                <SessionPolicyHint />

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || cooldown.seconds > 0}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
                    background: loading ? 'rgba(32,181,223,0.5)' : `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`,
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
                  disabled={!supportsPasskeys || passkeyLoading || loading || cooldown.seconds > 0}
                  aria-describedby='patient-passkey-help'
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '13px',
                    border: "1.5px solid var(--border)",
                    background: passkeyLoading ? "var(--surface-subtle)" : "var(--surface-glass)",
                    color: T.navy,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    cursor: !supportsPasskeys || passkeyLoading || loading || cooldown.seconds > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                  }}
                >
                  {passkeyLoading
                    ? <><span style={{ width: '14px', height: '14px', border: "2px solid var(--border)", borderTopColor: T.blue, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Checking passkey…</>
                    : <><Ico p={ICONS.shield} size={15} sw={1.8} /> Sign in with passkey</>}
                </button>
                <p id='patient-passkey-help' style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {supportsPasskeys
                    ? 'Use a passkey previously registered in patient Settings. The same session limits apply.'
                    : 'Passkeys require a supported browser on HTTPS or localhost. Use your password to sign in.'}
                </p>

                {/* Create account */}
                <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '2px 0 0', letterSpacing: '-0.01em' }}>
                  {"Don't have an account? "}
                  <Link href="/auth/sign-up" style={{ color: T.link, fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
                </p>
              </div>
            </form>

            {/* Social */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ flex: 1, height: '1px', background: "var(--surface-hover)" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: T.slate2, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>or continue with</span>
                <div style={{ flex: 1, height: '1px', background: "var(--surface-hover)" }} />
              </div>
              <PortalSignInReference portal='PATIENT'/>
              <SocialSignInButtons portal='PATIENT' />
            </div>

            {/* Trust indicators */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: "1px solid var(--border)" }}>
              <div className="signin-trust-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.lock,     label: 'Account Sign-In' },
                  { icon: ICONS.shield,   label: 'Session Expiry'  },
                  { icon: ICONS.check,    label: 'Development Preview'    },
                  { icon: ICONS.activity, label: 'Password Recovery' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: "13px", color: T.slate2, marginTop: '20px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
            By signing in you agree to our{' '}
            <Link href="/terms" style={{ color: T.link, fontWeight: 500, textDecoration: 'none' }}>Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: T.link, fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

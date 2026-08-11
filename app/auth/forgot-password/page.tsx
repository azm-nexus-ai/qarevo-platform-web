'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { T, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

type ErrorKind = 'empty' | 'invalid' | 'network' | 'server' | 'rate' | 'expired' | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

function WellnessShield() {
  return (
    <div style={{ position: 'relative', width: '250px', height: '250px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 30, 58].map((inset, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${0.06 + i * 0.04})`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '86px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.32) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)',
          border: '1px solid rgba(52,140,234,0.26)',
          boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico p={ICONS.lock} size={32} sw={1.35} color='rgba(255,255,255,0.9)' />
      </div>

      {[
        { angle: 0, icon: ICONS.shield, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.ema, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.check, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.activity, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
      ].map(({ angle, icon, bg, border }) => {
        const r = 98
        const rad = (angle - 90) * Math.PI / 180
        const x = 125 + r * Math.cos(rad)
        const y = 125 + r * Math.sin(rad)
        return (
          <div
            key={angle}
            style={{
              position: 'absolute',
              left: `${x - 19}px`,
              top: `${y - 19}px`,
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
          </div>
        )
      })}

      <svg viewBox='0 0 250 24' style={{ position: 'absolute', bottom: '8px', left: 0, width: '100%', opacity: 0.42 }}>
        <polyline
          points='0,12 42,12 58,2 66,22 74,2 82,22 95,12 250,12'
          fill='none'
          stroke='rgba(52,140,234,0.85)'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <circle cx='82' cy='22' r='2.5' fill='rgba(52,140,234,0.9)' />
      </svg>
    </div>
  )
}

function LeftPanel() {
  return (
    <div
      style={{
        width: '380px',
        flexShrink: 0,
        background: LEFT_BG,
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '44px 44px 44px',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-80px',
          left: '-60px',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-80px',
          right: '-60px',
          width: '340px',
          height: '340px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico p={ICONS.heart} size={15} sw={1.5} color='#fff' />
          </div>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: '15.5px',
              color: '#fff',
              letterSpacing: '-0.03em',
            }}
          >
            Qarevo Health
          </span>
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <WellnessShield />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '24px',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.035em',
              lineHeight: 1.18,
              margin: '0 0 10px',
            }}
          >
            Recover access safely.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Your care remains protected.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Account recovery is encrypted end-to-end and designed to be quick, calm, and trustworthy.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Encrypted Reset Flow', sub: 'Secure links with expiry safeguards' },
          { icon: ICONS.shield, label: 'Privacy by Default', sub: 'No account details exposed during recovery' },
          { icon: ICONS.check, label: 'HIPAA · GDPR Ready', sub: 'Built for healthcare-grade trust' },
        ].map(({ icon, label, sub }, i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              gap: '13px',
              alignItems: 'flex-start',
              padding: '13px 0',
              borderTop: i === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <Ico p={icon} size={14} sw={1.5} color='rgba(147,197,253,0.9)' />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '-0.015em', marginBottom: '2px' }}>
                {label}
              </div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertBanner({ kind }: { kind: Exclude<ErrorKind, 'empty' | 'invalid' | null> }) {
  const content = {
    network: {
      title: 'Network connection issue',
      body: 'We could not reach our servers. Please check your connection and try again.',
    },
    server: {
      title: 'Service temporarily unavailable',
      body: 'Our recovery service is momentarily unavailable. Please try again shortly.',
    },
    rate: {
      title: 'Too many requests',
      body: 'For your security, please wait a few minutes before requesting another reset link.',
    },
    expired: {
      title: 'Request window expired',
      body: 'This reset attempt expired. Please request a fresh password reset link.',
    },
  }[kind]

  return (
    <div
      role='alert'
      aria-live='assertive'
      style={{
        padding: '12px 16px',
        borderRadius: '11px',
        background: '#FFF5F5',
        border: '1px solid rgba(220,38,38,0.24)',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        marginBottom: '18px',
      }}
    >
      <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} style={{ marginTop: '1px', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: T.red, lineHeight: 1.4, letterSpacing: '-0.005em' }}>{content.title}</div>
        <div style={{ fontSize: '12.5px', color: '#B93434', lineHeight: 1.5, letterSpacing: '-0.005em' }}>{content.body}</div>
      </div>
    </div>
  )
}

function EmailField({
  value,
  onChange,
  onBlur,
  error,
  success,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: string
  success: boolean
  disabled?: boolean
}) {
  const id = useId()
  const [focused, setFocused] = useState(false)

  const bdr = error
    ? 'rgba(220,38,38,0.55)'
    : success
    ? 'rgba(9,173,112,0.5)'
    : focused
    ? 'rgba(32,181,223,0.45)'
    : 'rgba(4,53,77,0.1)'

  const glow = focused
    ? error
      ? '0 0 0 3px rgba(220,38,38,0.08)'
      : '0 0 0 3px rgba(32,181,223,0.09)'
    : 'none'

  const bg = error ? '#FFF5F5' : success ? '#F0FDF8' : focused ? '#fff' : 'rgba(255,255,255,0.7)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        Email Address
      </label>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: '13px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: focused ? T.blue : T.slate2,
            display: 'flex',
            transition: 'color 0.15s',
            pointerEvents: 'none',
          }}
        >
          <Ico p={ICONS.ema} size={14} sw={1.75} />
        </span>
        <input
          id={id}
          type='email'
          value={value}
          placeholder='Enter your registered email address'
          autoComplete='email'
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur()
          }}
          style={{
            width: '100%',
            padding: '12px 40px 12px 38px',
            borderRadius: '11px',
            border: `1.5px solid ${bdr}`,
            background: bg,
            color: T.navy,
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            boxShadow: glow,
            transition: 'all 0.15s ease',
            opacity: disabled ? 0.6 : 1,
          }}
        />
        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          {success ? <Ico p={ICONS.check} size={14} sw={2.5} color={T.green} /> : error ? <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} /> : null}
        </span>
      </div>
      {error ? <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.4 }}>{error}</p> : null}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const emailValue = email.trim()
  const emailErr = touched && !emailValue ? 'Email address is required' : touched && !EMAIL_RE.test(emailValue) ? 'Enter a valid email address' : ''
  const emailOk = EMAIL_RE.test(emailValue) && !emailErr

  const shouldShowBanner = errorKind && !['empty', 'invalid'].includes(errorKind)

  const classifyError = (inputEmail: string): Exclude<ErrorKind, 'empty' | 'invalid' | null> | null => {
    const lower = inputEmail.toLowerCase()
    if (lower.includes('+network') || lower.startsWith('network@')) return 'network'
    if (lower.includes('+server') || lower.startsWith('server@')) return 'server'
    if (lower.includes('+rate') || lower.startsWith('rate@')) return 'rate'
    if (lower.includes('+expired') || lower.startsWith('expired@')) return 'expired'
    return null
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = email.trim()
    setTouched(true)

    if (!cleaned) {
      setErrorKind('empty')
      return
    }
    if (!EMAIL_RE.test(cleaned)) {
      setErrorKind('invalid')
      return
    }

    setErrorKind(null)
    setLoading(true)

    setTimeout(() => {
      const simulated = classifyError(cleaned)
      setLoading(false)

      if (simulated) {
        setErrorKind(simulated)
        return
      }

      setSent(true)
      setSentTo(cleaned)
      setErrorKind(null)
    }, 1200)
  }

  const resend = () => {
    setLoading(true)
    setErrorKind(null)
    setTimeout(() => {
      setLoading(false)
      const simulated = classifyError(sentTo)
      if (simulated) {
        setErrorKind(simulated)
        return
      }
      setSent(true)
    }, 1100)
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(4,53,77,0.3); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) { .forgot-left { display: none !important; } }
      `}</style>

      <div className='forgot-left'>
        <LeftPanel />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>
          <Link
            href='/auth/sign-in'
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: T.slate2,
              textDecoration: 'none',
              marginBottom: '28px',
              letterSpacing: '-0.01em',
            }}
          >
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back to Sign In
          </Link>

          <section
            aria-live='polite'
            style={{
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(28px) saturate(200%)',
              WebkitBackdropFilter: 'blur(28px) saturate(200%)',
              borderRadius: '22px',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
              padding: '40px 40px 36px',
              animation: 'fadeUp 0.3s ease',
            }}
          >
            {!sent ? (
              <>
                <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                  <div>
                    <h1
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '24px',
                        fontWeight: 800,
                        color: T.navy,
                        letterSpacing: '-0.035em',
                        lineHeight: 1.2,
                        margin: '0 0 7px',
                      }}
                    >
                      Forgot your password?
                    </h1>
                    <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.65, margin: 0, letterSpacing: '-0.01em' }}>
                      No problem. Enter the email address associated with your Qarevo Health account and we&apos;ll send you secure instructions to reset your password.
                    </p>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '13px',
                      background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                      boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ico p={ICONS.lock} size={20} sw={1.35} color='#fff' />
                  </div>
                </header>

                {shouldShowBanner ? <AlertBanner kind={errorKind as Exclude<ErrorKind, 'empty' | 'invalid' | null>} /> : null}

                <form onSubmit={submit} noValidate>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <EmailField
                      value={email}
                      onChange={(v) => {
                        setEmail(v)
                        setErrorKind(null)
                      }}
                      onBlur={() => setTouched(true)}
                      error={emailErr}
                      success={emailOk}
                      disabled={loading}
                    />

                    <button
                      type='submit'
                      disabled={loading || !emailValue}
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: '13px',
                        border: 'none',
                        background:
                          loading || !emailValue
                            ? 'rgba(32,181,223,0.5)'
                            : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                        color: '#fff',
                        fontFamily: 'inherit',
                        fontSize: '15px',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        cursor: loading || !emailValue ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                        boxShadow:
                          loading || !emailValue ? 'none' : '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                        marginTop: '4px',
                        minHeight: '48px',
                      }}
                    >
                      {loading ? (
                        <>
                          <span
                            style={{
                              width: '15px',
                              height: '15px',
                              border: '2px solid rgba(255,255,255,0.35)',
                              borderTopColor: '#fff',
                              borderRadius: '50%',
                              animation: 'spin 0.7s linear infinite',
                              display: 'inline-block',
                            }}
                          />
                          Sending secure link…
                        </>
                      ) : (
                        <>
                          Send Reset Link
                          <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
                        </>
                      )}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Link href='/auth/sign-in' style={{ color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                        Back to Sign In
                      </Link>
                      <p style={{ margin: 0, fontSize: '13.5px', color: T.slate2, letterSpacing: '-0.01em' }}>
                        Need a new account?{' '}
                        <Link href='/auth/sign-up' style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>
                          Create New Account
                        </Link>
                      </p>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ animation: 'fadeUp 0.3s ease' }}>
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      margin: '0 auto 16px',
                      background: 'rgba(9,173,112,0.14)',
                      border: '1px solid rgba(9,173,112,0.24)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.62), 0 8px 18px rgba(9,173,112,0.14)',
                    }}
                  >
                    <Ico p={ICONS.check} size={22} sw={2.5} color={T.green} />
                  </div>

                  <h1
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '24px',
                      fontWeight: 800,
                      color: T.navy,
                      letterSpacing: '-0.035em',
                      lineHeight: 1.2,
                      margin: '0 0 8px',
                    }}
                  >
                    Check your email
                  </h1>
                  <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.65, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                    We&apos;ve sent password reset instructions to your email address. If an account exists with this email, you&apos;ll receive a secure password reset link shortly.
                  </p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2 }}>
                    Sent to <span style={{ fontWeight: 700, color: T.navy }}>{sentTo}</span>
                  </p>
                </div>

                {shouldShowBanner ? <AlertBanner kind={errorKind as Exclude<ErrorKind, 'empty' | 'invalid' | null>} /> : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link
                    href='/auth/reset-password'
                    style={{
                      width: '100%',
                      padding: '13px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                      color: '#fff',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      minHeight: '46px',
                      boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                    }}
                  >
                    Continue to Reset Password
                    <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
                  </Link>

                  <button
                    type='button'
                    onClick={resend}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: '12px',
                      border: `1.5px solid ${loading ? 'rgba(4,53,77,0.08)' : 'rgba(4,53,77,0.12)'}`,
                      background: loading ? 'rgba(4,53,77,0.02)' : 'rgba(255,255,255,0.78)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: T.navy,
                      letterSpacing: '-0.015em',
                      minHeight: '46px',
                    }}
                  >
                    {loading ? (
                      <>
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid rgba(4,53,77,0.18)',
                            borderTopColor: T.navy,
                            borderRadius: '50%',
                            animation: 'spin 0.7s linear infinite',
                            display: 'inline-block',
                          }}
                        />
                        Resending…
                      </>
                    ) : (
                      'Resend Email'
                    )}
                  </button>

                  <button
                    type='button'
                    onClick={() => {
                      setSent(false)
                      setLoading(false)
                      setErrorKind(null)
                    }}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '11px',
                      border: '1px solid rgba(4,53,77,0.08)',
                      background: 'rgba(4,53,77,0.02)',
                      color: T.slate,
                      fontFamily: 'inherit',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      cursor: 'pointer',
                    }}
                  >
                    Change Email Address
                  </button>

                  <Link
                    href='/auth/sign-in'
                    style={{
                      textAlign: 'center',
                      color: T.blue,
                      fontSize: '13.5px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      letterSpacing: '-0.01em',
                      paddingTop: '4px',
                    }}
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.lock, label: 'Secure Recovery' },
                  { icon: ICONS.shield, label: 'Encrypted Workflow' },
                  { icon: ICONS.check, label: 'HIPAA · GDPR' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p style={{ textAlign: 'center', fontSize: '12px', color: T.slate2, marginTop: '20px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
            By continuing you agree to our{' '}
            <Link href='/terms' style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>
              Terms
            </Link>{' '}
            and{' '}
            <Link href='/privacy' style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

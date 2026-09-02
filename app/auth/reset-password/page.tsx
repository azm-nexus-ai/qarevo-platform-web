'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { resetPassword, ApiError, getApiErrorDetail } from '@/lib/api'

type ErrorKind = 'weak' | 'mismatch' | 'expiredToken' | 'invalidToken' | 'server' | 'network' | null

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

function isLowercase(char: string) {
  return char >= 'a' && char <= 'z'
}

function checkPasswordRules(password: string) {
  let hasUpper = false
  let hasLower = false
  let hasNumber = false
  let hasSpecial = false

  for (const c of password) {
    if (c >= 'A' && c <= 'Z') hasUpper = true
    else if (isLowercase(c)) hasLower = true
    else if (c >= '0' && c <= '9') hasNumber = true
    else hasSpecial = true
  }

  return {
    min8: password.length >= 8,
    upper: hasUpper,
    lower: hasLower,
    number: hasNumber,
    special: hasSpecial,
  }
}

function getStrength(password: string) {
  const rules = checkPasswordRules(password)
  const score = Object.values(rules).filter(Boolean).length

  const levels = [
    { label: 'Weak', color: '#8298AF' },
    { label: 'Fair', color: '#6D8BC0' },
    { label: 'Good', color: '#4D7FE0' },
    { label: 'Strong', color: '#2E8BCB' },
    { label: 'Excellent', color: T.green },
  ]

  const idx = Math.max(0, Math.min(score - 1, levels.length - 1))
  const active = password.length === 0 ? { label: 'Weak', color: '#8298AF' } : levels[idx]

  return { rules, score, ...active }
}

function SecurityOrb() {
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
        <Ico p={ICONS.shield} size={31} sw={1.35} color='rgba(255,255,255,0.9)' />
      </div>

      {[
        { angle: 0, icon: ICONS.lock, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.check, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.activity, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.heart, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
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
        <SecurityOrb />
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
            Security first.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Your records stay protected.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Protecting your medical information is Qarevo Health&apos;s highest priority. Create a strong password to safely restore account access.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'End-to-End Encryption', sub: 'Password updates are securely processed' },
          { icon: ICONS.shield, label: 'Identity Verified', sub: 'Only authenticated users can reset credentials' },
          { icon: ICONS.check, label: 'HIPAA · GDPR Ready', sub: 'Healthcare-grade compliance and safety' },
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

function AlertBanner({ kind }: { kind: Exclude<ErrorKind, 'mismatch' | 'weak' | null> }) {
  const content = {
    expiredToken: {
      title: 'Reset link expired',
      body: 'This reset link has expired. Please request a new password reset email.',
    },
    invalidToken: {
      title: 'Invalid reset link',
      body: 'This reset link is invalid or already used. Please request a fresh link.',
    },
    server: {
      title: 'Service temporarily unavailable',
      body: 'Password update is temporarily unavailable. Please try again shortly.',
    },
    network: {
      title: 'Network connection issue',
      body: 'We could not reach our servers. Check your connection and try again.',
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  success,
  show,
  onToggle,
  autoComplete,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: string
  success: boolean
  show: boolean
  onToggle: () => void
  autoComplete: string
  disabled?: boolean
}) {
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
        {label}
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
          <Ico p={ICONS.lock} size={14} sw={1.75} />
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          placeholder='••••••••••••'
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur()
          }}
          style={{
            width: '100%',
            padding: '12px 70px 12px 38px',
            borderRadius: '11px',
            border: `1.5px solid ${bdr}`,
            background: bg,
            color: T.navy,
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            boxShadow: glow,
            transition: 'all 0.15s ease',
            letterSpacing: show ? 'normal' : '0.08em',
            opacity: disabled ? 0.6 : 1,
          }}
        />

        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type='button'
            onClick={onToggle}
            aria-label={show ? 'Hide password' : 'Show password'}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              color: T.slate2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico p={show ? ICONS.user : ICONS.lock} size={13} sw={1.75} />
          </button>

          {success ? <Ico p={ICONS.check} size={14} sw={2.5} color={T.green} /> : error ? <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} /> : null}
        </div>
      </div>
      {error ? <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.4 }}>{error}</p> : null}
    </div>
  )
}

function RuleItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        background: met ? 'rgba(9,173,112,0.1)' : 'rgba(4,53,77,0.05)',
        color: met ? T.green : T.slate2,
        transition: 'all 0.18s ease',
        letterSpacing: '-0.005em',
      }}
    >
      {met ? <Ico p={ICONS.check} size={9} sw={3} color={T.green} /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(4,53,77,0.2)' }} />}
      {label}
    </div>
  )
}

function PasswordGuide({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const { rules, score, label, color } = getStrength(password)
  const match = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 14px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: `1px solid ${T.borderFaint}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: T.slate, letterSpacing: '-0.01em' }}>Password Strength</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color, letterSpacing: '-0.005em' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '100px',
              background: idx <= score ? color : 'rgba(4,53,77,0.09)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <RuleItem met={rules.min8} label='At least 8 characters' />
        <RuleItem met={rules.upper} label='One uppercase letter' />
        <RuleItem met={rules.lower} label='One lowercase letter' />
        <RuleItem met={rules.number} label='One number' />
        <RuleItem met={rules.special} label='One special character' />
      </div>

      {confirmPassword.length > 0 ? (
        <div style={{ fontSize: '12px', color: match ? T.green : T.red, fontWeight: 600, letterSpacing: '-0.005em' }}>
          {match ? 'Passwords match.' : 'Passwords do not match.'}
        </div>
      ) : null}
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState({ newPassword: false, confirmPassword: false })
  const [loading, setLoading] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)

  const newId = useId()
  const confirmId = useId()

  const strength = getStrength(newPassword)
  const rules = strength.rules
  const strongEnough = Object.values(rules).every(Boolean)

  const newErr =
    touched.newPassword && !newPassword
      ? 'New password is required'
      : touched.newPassword && !strongEnough
      ? 'Please create a stronger password that satisfies all requirements'
      : ''

  const confirmErr =
    touched.confirmPassword && !confirmPassword
      ? 'Please confirm your new password'
      : touched.confirmPassword && confirmPassword !== newPassword
      ? 'Passwords do not match'
      : ''

  const showAlert = errorKind && !['mismatch', 'weak'].includes(errorKind)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ newPassword: true, confirmPassword: true })

    if (!newPassword || !confirmPassword) return
    if (!strongEnough) {
      setErrorKind('weak')
      return
    }
    if (confirmPassword !== newPassword) {
      setErrorKind('mismatch')
      return
    }

    if (!token) {
      setErrorKind('invalidToken')
      return
    }

    setErrorKind(null)
    setLoading(true)

    try {
      await resetPassword(token, newPassword)
      setUpdated(true)
      setErrorKind(null)
    } catch (error) {
      setLoading(false)
      const detail = getApiErrorDetail(error)?.toLowerCase() ?? ''
      
      if (detail.includes('expired') || detail.includes('expir')) {
        setErrorKind('expiredToken')
      } else if (detail.includes('invalid') || detail.includes('used')) {
        setErrorKind('invalidToken')
      } else if (detail.includes('network') || detail.includes('fetch')) {
        setErrorKind('network')
      } else if (error instanceof ApiError && error.status >= 500) {
        setErrorKind('server')
      } else {
        setErrorKind('invalidToken')
      }
    } finally {
      setLoading(false)
    }
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
        @media (max-width: 900px) { .reset-left { display: none !important; } }
      `}</style>

      <div className='reset-left'>
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
            {!updated ? (
              <>
                {errorKind === 'invalidToken' && !token ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        margin: '0 auto 16px',
                        background: 'rgba(220,38,38,0.1)',
                        border: '1px solid rgba(220,38,38,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ico p={ICONS.info} size={22} sw={2} color={T.red} />
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
                      Invalid Reset Link
                    </h1>
                    <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.65, margin: '0 0 22px', letterSpacing: '-0.01em' }}>
                      The password reset link is missing or invalid. Please request a new password reset link to continue.
                    </p>
                    <Link
                      href='/auth/forgot-password'
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: '13px',
                        border: 'none',
                        background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                        color: '#fff',
                        fontFamily: 'inherit',
                        fontSize: '15px',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                        textDecoration: 'none',
                      }}
                    >
                      Request New Reset Link
                      <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
                    </Link>
                  </div>
                ) : (
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
                          Reset Your Password
                        </h1>
                        <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.65, margin: 0, letterSpacing: '-0.01em' }}>
                          Enter a secure new password for your Qarevo Health account.
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
                        <Ico p={ICONS.shield} size={20} sw={1.35} color='#fff' />
                      </div>
                    </header>

                    {showAlert ? <AlertBanner kind={errorKind as Exclude<ErrorKind, 'mismatch' | 'weak' | null>} /> : null}

                    <form onSubmit={onSubmit} noValidate>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <PasswordField
                          id={newId}
                          label='New Password'
                          placeholder='Enter your new password'
                          value={newPassword}
                          onChange={setNewPassword}
                          show={showNew}
                          onToggle={() => setShowNew(!showNew)}
                          onBlur={() => setTouched({ ...touched, newPassword: true })}
                          error={newErr}
                          autoComplete='new-password'
                        />

                        <PasswordField
                          id={confirmId}
                          label='Confirm New Password'
                          placeholder='Confirm your new password'
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          show={showConfirm}
                          onToggle={() => setShowConfirm(!showConfirm)}
                          onBlur={() => setTouched({ ...touched, confirmPassword: true })}
                          error={confirmErr}
                          autoComplete='new-password'
                        />

                        <PasswordStrength password={newPassword} confirmPassword={confirmPassword} />

                        <button
                          type='submit'
                          disabled={loading || !newPassword || !confirmPassword}
                          style={{
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: '13px',
                            border: 'none',
                            background:
                              loading || !newPassword || !confirmPassword
                                ? 'rgba(32,181,223,0.5)'
                                : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                            color: '#fff',
                            fontFamily: 'inherit',
                            fontSize: '15px',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            cursor: loading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease',
                            boxShadow:
                              loading || !newPassword || !confirmPassword ? 'none' : '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
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
                              Updating password…
                            </>
                          ) : (
                            <>
                              Update Password
                              <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
                            </>
                          )}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <Link href='/auth/sign-in' style={{ color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                            Back to Sign In
                          </Link>
                          <Link href='/' style={{ color: T.blue, fontSize: '13.5px', fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                            Return to Home
                          </Link>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </>
            ) : (
              <div style={{ animation: 'fadeUp 0.3s ease', textAlign: 'center' }}>
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    borderRadius: '18px',
                    margin: '0 auto 16px',
                    background: 'rgba(9,173,112,0.14)',
                    border: '1px solid rgba(9,173,112,0.24)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.62), 0 8px 18px rgba(9,173,112,0.14)',
                  }}
                >
                  <Ico p={ICONS.check} size={24} sw={2.6} color={T.green} />
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
                  Password Updated Successfully
                </h1>

                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.65, margin: '0 0 22px', letterSpacing: '-0.01em' }}>
                  Your password has been successfully updated. You can now securely sign in to your Qarevo Health account.
                </p>

                <Link
                  href='/auth/sign-in'
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '13px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                    textDecoration: 'none',
                  }}
                >
                  Continue to Sign In
                  <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
                </Link>
              </div>
            )}

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.lock, label: 'Secure Credentials' },
                  { icon: ICONS.shield, label: 'Encrypted Update' },
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

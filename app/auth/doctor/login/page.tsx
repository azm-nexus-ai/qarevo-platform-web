'use client'
import { useTranslations } from 'next-intl'
import PortalSignInReference, { WrongPortalNotice } from '@/components/auth/PortalSignInReference'
import SessionPolicyHint from '@/components/auth/SessionPolicyHint'
import { authenticatedPortalHandoff, safePortalDestination, type PortalHandoff } from '@/lib/portal-handoff'

import { useEffect, useState, useId } from 'react'
import Link from 'next/link'
import SocialSignInButtons from '@/components/auth/SocialSignInButtons'
import { useLoginCooldown } from '@/lib/use-login-cooldown'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { apiPost, type DoctorLoginRequest } from '@/lib/api'
import { apiErrorInfo, useAuthErrorMessage } from '@/lib/auth-errors'
import { usePortalAction } from '@/lib/portal-action'

// Page background
const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at 12% 8%,   rgba(32,181,223,0.08) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 90% 18%,  rgba(32,181,223,0.06) 0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  'var(--canvas)',
].join(', ')

// Left panel background
const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.brandNavy,
].join(', ')

// Field component
interface FieldProps {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  success?: boolean
  icon?: string | readonly string[]
  rightSlot?: React.ReactNode
  autoComplete?: string
  onBlur?: () => void
}

function Field({ label, placeholder, type = 'text', value, onChange, error, success, icon, rightSlot, autoComplete, onBlur }: FieldProps) {
  const t = useTranslations('auth.doctorSignIn')
  const [focused, setFocused] = useState(false)
  const id = useId()

  const bdr = error
    ? 'rgba(220,38,38,0.55)'
    : success
    ? 'rgba(9,173,112,0.5)'
    : focused
    ? 'rgba(32,181,223,0.45)'
    : 'rgba(4,53,77,0.1)'

  const shadow = focused
    ? error
      ? '0 0 0 3px rgba(220,38,38,0.08)'
      : '0 0 0 3px rgba(32,181,223,0.09)'
    : 'none'

  const bg = error
    ? 'var(--danger-soft)'
    : success
    ? 'var(--success-soft)'
    : focused
    ? 'var(--surface)'
    : 'var(--surface)'

  const hasLeft = !!icon
  const hasRight = !!rightSlot || success || !!error

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label} <span>{t('required')}</span>
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.link : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
            <Ico p={icon} size={14} sw={1.75} />
          </span>
        )}
        <input
          id={id}
          required
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.() }}
          style={{
            width: '100%',
            padding: `12px ${hasRight ? '40px' : '14px'} 12px ${hasLeft ? '38px' : '14px'}`,
            borderRadius: '11px',
            border: `1.5px solid ${bdr}`,
            background: bg,
            color: T.navy,
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            boxShadow: shadow,
            transition: 'all 0.15s ease',
            letterSpacing: type === 'password' ? '0.08em' : 'normal',
          }}
        />
        {(hasRight || success || error) && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {rightSlot
              ? rightSlot
              : success ? <Ico p={ICONS.check} size={14} sw={2.5} color={T.green} />
              : error ? <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} />
              : null}
          </span>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{error}</p>}
    </div>
  )
}

// Left panel component
function LeftPanel() {
  const t = useTranslations('auth.doctorSignIn')
  return (
    <div style={{
      width: '380px',
      flexShrink: 0,
      background: LEFT_BG,
      position: 'sticky',
      top: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 44px',
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

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

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h2 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 12px' }}>
          {t('panelTitle')}
        </h2>
        <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
          {t('panelText')}
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Email verification', 'Clinician review', 'Protected access'].map(b => (
            <span key={b} style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.78)", letterSpacing: '0.04em' }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main page
export default function DoctorLoginPage() {
  const t = useTranslations('auth.doctorSignIn')
  const captureAction = usePortalAction()
  const router = useRouter()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [touched, setTouched] = useState({
    identifier: false,
    password: false,
  })

  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [handoff, setHandoff] = useState<PortalHandoff | null>(null)
  // Account states that are next steps, not failures: confirm the email, or wait for review.
  const [accountState, setAccountState] = useState<'verify' | 'review' | null>(null)
  const [verifiedNotice, setVerifiedNotice] = useState(false)
  const cooldown = useLoginCooldown()
  const errorMessage = useAuthErrorMessage()
  useEffect(() => {
    const timer = window.setTimeout(() => setVerifiedNotice(new URLSearchParams(window.location.search).get('verified') === 'email'), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const identifierErr = touched.identifier && !identifier ? t('identifierRequired') : ''
  const passErr = touched.password && !password ? t('passwordRequired') : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || cooldown.seconds > 0) return
    setTouched({ identifier: true, password: true })

    if (!identifier || !password) {
      return
    }

    setLoading(true)
    setAuthError(''); setHandoff(null); setAccountState(null)
    const action = captureAction()
    const current = () => action.isCurrent({ allowEndedSession: true })

    try {
      const loginData: DoctorLoginRequest = {
        identifier: identifier.trim(),
        password,
      }

      const response = await apiPost('/api/v1/auth/doctor/login', loginData) as { mfa_pending: boolean }
      if (!current()) return

      // Store TEMP_AUTH token for 2FA flow
      if (!response.mfa_pending) throw new Error('Secure clinician verification could not be started. Please retry.')
      sessionStorage.setItem('qarevo:doctor:identifier', identifier)

      // Redirect to 2FA verification page
      const intended = safePortalDestination(new URLSearchParams(window.location.search).get('next'), 'PROVIDER')
      router.push('/auth/doctor/2fa' + (intended ? `?${new URLSearchParams({ next: intended })}` : ''))
    } catch (error) {
      if (!current()) return
      cooldown.record(error)
      const wrongPortal = authenticatedPortalHandoff(error)
      setHandoff(wrongPortal)
      const { code, status } = apiErrorInfo(error)
      if (code === 'EMAIL_VERIFICATION_PENDING') setAccountState('verify')
      else if (code === 'CLINICIAN_APPROVAL_REQUIRED') setAccountState('review')
      setAuthError(wrongPortal || code === 'CLINICIAN_APPROVAL_REQUIRED' || code === 'EMAIL_VERIFICATION_PENDING' ? '' : status === 401 ? t('errors.invalid') : errorMessage(error, 'signIn'))
    } finally {
      if (current()) setLoading(false)
    }
  }

  const pwToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex' }}
    >
      <Ico p={showPassword ? ICONS.eyeOff : ICONS.eye} size={14} sw={1.75} />
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: var(--text-muted); } @media (max-width: 860px) { .doctor-login-left { display: none !important; } }`}</style>

      {/* Left panel */}
      <div className="doctor-login-left">
        <LeftPanel />
      </div>

      {/* Right panel - login form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>
          {/* Back link */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            {t('back')}
          </Link>

          {/* Form card */}
          <div style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: "1px solid var(--border)",
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
            padding: 'clamp(20px, 5vw, 40px)',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>
                  {t('title')}
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  {t('subtitle')}
                </p>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.steth} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {handoff && <WrongPortalNotice handoff={handoff}/>}
            {verifiedNotice && !accountState && !authError && (
              <div role="status" style={{ padding: '12px 16px', borderRadius: '11px', background: 'var(--success-soft)', marginBottom: '20px', fontSize: '14px', lineHeight: 1.45, color: 'var(--text)' }}>{t('verifiedNotice')}</div>
            )}
            {accountState && (
              <div role="status" style={{ padding: '12px 16px', borderRadius: '11px', background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', marginBottom: '20px', fontSize: '14px', lineHeight: 1.5, color: 'var(--text)', display: 'grid', gap: '8px' }}>
                <span>{accountState === 'verify' ? t('stateVerify') : t('stateReview')}</span>
                {accountState === 'verify' && (
                  <Link href={`/auth/doctor-verify-email${identifier.includes('@') ? `?email=${encodeURIComponent(identifier.trim())}` : ''}`} style={{ color: 'var(--link)', fontWeight: 700 }}>{t('stateVerifyAction')}</Link>
                )}
              </div>
            )}
            {/* Error banner */}
            {(cooldown.message || authError) && (
              <div role="alert" style={{ padding: '12px 16px', borderRadius: '11px', background: "var(--danger-soft)", border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={16} sw={1.75} color={T.red} />
                <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.45 }}>{cooldown.message || authError}</span>
              </div>
            )}

            {/* Form */}
            <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field
                label={t('identifierLabel')}
                placeholder="doctor@example.com"
                value={identifier}
                onChange={setIdentifier}
                icon={ICONS.user}
                error={identifierErr}
                onBlur={() => setTouched({ ...touched, identifier: true })}
                autoComplete="username"
              />

              <Field
                label={t('passwordLabel')}
                placeholder={t('passwordPlaceholder')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                icon={ICONS.lock}
                rightSlot={pwToggle}
                error={passErr}
                onBlur={() => setTouched({ ...touched, password: true })}
                autoComplete="current-password"
              />

              <SessionPolicyHint />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link href="/auth/doctor/forgot-password" style={{ fontSize: '13px', color: T.link, textDecoration: 'none', fontWeight: 500 }}>
                  {t('forgot')}
                </Link>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || cooldown.seconds > 0}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: loading ? 'rgba(32,181,223,0.4)' : `linear-gradient(135deg,${T.blue} 0%,var(--primary-end) 100%)`,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: loading ? 'none' : '0 3px 10px rgba(32,181,223,0.32), 0 1px 3px rgba(32,181,223,0.2)',
                }}
              >
                {loading ? t('authenticating') : t('submit')}
                {!loading && <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />}
              </button>
            </form>

            <PortalSignInReference portal='PROVIDER'/>
              <SocialSignInButtons portal='PROVIDER' />

            {/* 2FA notice */}
            <div style={{ marginTop: '20px', padding: '12px 16px', borderRadius: '11px', background: 'rgba(32,181,223,0.06)', border: '1px solid rgba(32,181,223,0.12)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Ico p={ICONS.shield} size={16} sw={1.75} color={T.blue} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", color: T.navy, fontWeight: 600, marginBottom: '4px' }}>
                    {t('twoFactorTitle')}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: T.slate, lineHeight: 1.4 }}>
                    {t('twoFactorText')}
                  </p>
                </div>
              </div>
            </div>

            {/* Register link */}
            <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '20px 0 0', letterSpacing: '-0.01em' }}>
              {t('newPhysician')}{' '}
              <Link href="/auth/doctor-register" style={{ color: T.link, fontWeight: 700, textDecoration: 'none' }}>
                {t('createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

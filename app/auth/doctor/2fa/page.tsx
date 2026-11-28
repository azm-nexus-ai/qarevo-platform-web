'use client'
import BrandLogo from '@/components/branding/BrandLogo'
import { safePortalDestination } from '@/lib/portal-handoff'

import { useState, useId, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { AuthTokenResponse, apiPost } from '@/lib/api'
import { apiErrorInfo, useAuthErrorMessage } from '@/lib/auth-errors'
import { useTranslations } from 'next-intl'
import { usePortalAction } from '@/lib/portal-action'
import { useCountdown } from '@/lib/use-countdown'

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
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  success?: boolean
  icon?: string | readonly string[]
  rightSlot?: React.ReactNode
  maxLength?: number
}

function Field({ label, placeholder, type = 'text', value, onChange, error, success, icon, rightSlot, maxLength }: FieldProps) {
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
    ? '#FFF5F5'
    : success
    ? '#F0FDF8'
    : focused
    ? '#fff'
    : 'rgba(255,255,255,0.7)'

  const hasLeft = !!icon
  const hasRight = !!rightSlot || success || !!error

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label}
      </label>
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
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
            letterSpacing: '0.05em',
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
      {error && <p style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{error}</p>}
    </div>
  )
}

// Left panel component
function LeftPanel() {
  const t = useTranslations('auth.doctorTwoFactor')
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
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label={t('qarevoHealthHome')}>
          <BrandLogo tone='white' width={160} />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h2 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 12px' }}>
          {t('panelTitle')}
        </h2>
        <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
          {t('panelBody')}
        </p>
      </div>

      <div aria-hidden style={{ position: 'relative', zIndex: 1 }} />
    </div>
  )
}

// Main page
export default function Doctor2FAPage() {
  const t = useTranslations('auth.doctorTwoFactor')
  const errorMessage = useAuthErrorMessage()
  const captureAction = usePortalAction()
  const router = useRouter()
  const verifyingRef = useRef(false)
  const [code, setCode] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [authError, setAuthError] = useState('')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sent, setSent] = useState(false)
  // Seconds until another code may be requested (the API enforces the same cooldown).
  const countdown = useCountdown(60)
  const cooldown = countdown.seconds
  const setCooldown = countdown.start

  const showError = (error: unknown) => {
    const info = apiErrorInfo(error)
    // The sign-in challenge ended (expired, used or replaced): only a new sign-in helps.
    if (info.status === 401 || info.code === 'MFA_EMAIL_RESEND_FAILED') setSessionEnded(true)
    if (info.code === 'CODE_RESEND_COOLDOWN' && info.retryAfter) setCooldown(info.retryAfter)
    setAuthError(errorMessage(error, 'code'))
  }

  const handleSendCode = async () => {
    if (resending || cooldown > 0) return
    const action = captureAction()
    setResending(true)
    setAuthError('')
    setSent(false)
    try {
      // The account comes from the sign-in challenge, so this also works for
      // doctors who signed in with a phone number.
      await apiPost('/api/v1/auth/mfa/resend-email', {})
      if (!action.isCurrent()) return
      setSent(true)
      setCode('')
      setCooldown(60)
    } catch (error) {
      if (action.isCurrent()) showError(error)
    } finally {
      if (action.isCurrent()) setResending(false)
    }
  }

  const handleVerify = async () => {
    if (verifyingRef.current || loading) return
    setTouched(true)
    if (code.length !== 6) {
      setAuthError(t('codeRequired'))
      return
    }
    setLoading(true)
    setAuthError('')
    verifyingRef.current = true
    const action = captureAction()
    let response: AuthTokenResponse | undefined
    const current = () => action.isCurrent({ completedSession: response?.browser_session })
    try {
      response = await apiPost<AuthTokenResponse>('/api/v1/auth/mfa/verify-email', { code })
      if (!current()) return
      sessionStorage.removeItem('qarevo:doctor:identifier')
      router.push(safePortalDestination(new URLSearchParams(window.location.search).get('next'), 'PROVIDER') || '/doctor/dashboard')
    } catch (error) {
      if (!current()) return
      showError(error)
      setCode('')
    } finally {
      verifyingRef.current = false
      if (current()) setLoading(false)
    }
  }

  const handleBack = () => {
    sessionStorage.removeItem('qarevo:doctor:identifier')
    router.push('/auth/doctor/login')
  }

  const codeError = touched && code.length !== 6 && !authError ? t('codeRequired') : ''

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: var(--text-muted); } @media (max-width: 860px) { .doctor-2fa-left { display: none !important; } } .doctor-2fa-card { padding: clamp(22px, 6vw, 40px); }`}</style>
      <div className="doctor-2fa-left"><LeftPanel /></div>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px, 6vw, 48px) 16px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '460px', minWidth: 0 }}>
          <button type="button" onClick={handleBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: 44, fontSize: '13px', fontWeight: 600, color: T.slate2, marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            {t('back')}
          </button>
          <div className="doctor-2fa-card" style={{ background: 'var(--surface-glass)', borderRadius: '22px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float, 0 24px 64px rgba(4,53,77,0.1))' }}>
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>{t('title')}</h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0 }}>{t('subtitle')}</p>
              </div>
              <div aria-hidden style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.shield} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {authError && (
              <div role="alert" style={{ padding: '12px 16px', borderRadius: '11px', background: 'var(--danger-soft)', border: '1px solid var(--danger-border, rgba(220,38,38,0.25))', display: 'grid', gap: '10px', marginBottom: '20px', color: 'var(--danger-text, var(--text))', fontSize: '14px', lineHeight: 1.45 }}>
                <span>{authError}</span>
                {sessionEnded && (
                  <button type="button" onClick={handleBack} style={{ justifySelf: 'start', minHeight: 40, padding: '0 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: T.navy, fontWeight: 700, cursor: 'pointer' }}>{t('signInAgain')}</button>
                )}
              </div>
            )}
            {sent && !authError && (
              <div role="status" style={{ padding: '12px 16px', borderRadius: '11px', background: 'var(--success-soft)', border: '1px solid var(--success-border, rgba(9,173,112,0.25))', marginBottom: '20px', fontSize: '14px', color: 'var(--text)', lineHeight: 1.45 }}>{t('sent')}</div>
            )}

            <form onSubmit={event => { event.preventDefault(); void handleVerify() }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} noValidate>
              <Field
                label={t('codeLabel')}
                placeholder={t('codePlaceholder')}
                type="text"
                value={code}
                onChange={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setAuthError('') }}
                icon={ICONS.shield}
                error={codeError}
                maxLength={6}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button type="button" onClick={handleSendCode} disabled={resending || cooldown > 0 || sessionEnded} aria-live="polite"
                  style={{ background: 'none', border: 'none', padding: 0, minHeight: 44, fontSize: '14px', color: cooldown > 0 || sessionEnded ? T.slate2 : T.link, fontWeight: 600, cursor: resending || cooldown > 0 ? 'not-allowed' : 'pointer' }}>
                  {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
                </button>
                <span style={{ fontSize: '13px', color: T.slate2 }}>{t('expiry')}</span>
              </div>
              <button type="submit" disabled={loading || sessionEnded}
                style={{ width: '100%', minHeight: 48, padding: '14px 20px', borderRadius: '13px', border: 'none', background: loading ? 'rgba(32,181,223,0.4)' : `linear-gradient(135deg,${T.blue} 0%,var(--primary-end) 100%)`, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? t('verifying') : t('verify')}
                {!loading && <Ico p={ICONS.check} size={15} sw={2.2} />}
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: '13px', color: T.slate2, margin: '20px 0 0', lineHeight: 1.5 }}>
              {t('noCode')}{' '}
              <Link href="/support" style={{ color: T.link, fontWeight: 600 }}>{t('contactSupport')}</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

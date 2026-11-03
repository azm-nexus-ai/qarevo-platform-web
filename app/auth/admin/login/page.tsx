'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { ApiError, getApiErrorDetail, getLoginThrottleMessage, loginAdmin, storeAuthTokens } from '@/lib/api'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at 12% 8%,   rgba(32,181,223,0.08) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 90% 18%,  rgba(32,181,223,0.06) 0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  'var(--canvas)',
].join(', ')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getFriendlyAdminError(error: unknown) {
  const throttle = getLoginThrottleMessage(error)
  if (throttle) return throttle

  const detail = getApiErrorDetail(error)?.toLowerCase() ?? ''

  if (error instanceof ApiError && error.status === 422 && (detail.includes('email') || detail.includes('e-mail'))) {
    return 'Enter a valid email address.'
  }
  if (detail.includes('incorrect') || detail.includes('invalid') || detail.includes('password')) {
    return 'Incorrect email or password.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Incorrect email or password.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'This account is not authorized for admin access.'
  }
  if (error instanceof ApiError && error.status >= 500) {
    return 'Admin login is temporarily unavailable. Please try again shortly.'
  }

  return 'We could not sign you in right now. Please try again.'
}

export default function AdminLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [authError, setAuthError] = useState('')

  const emailErr = touched.email && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : ''
  const passErr = touched.password && password.length < 1 ? 'Password is required' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!EMAIL_RE.test(email.trim()) || !password) return
    setLoading(true)
    setAuthError('')

    try {
      const response = await loginAdmin({ email: email.trim(), password })
      storeAuthTokens({ ...response, role: 'ADMIN' })
      router.push('/admin/dashboard')
    } catch (error) {
      setAuthError(getFriendlyAdminError(error))
    } finally {
      setLoading(false)
    }
  }

  const pwToggle = (
    <button
      type="button"
      onClick={() => setShowPw(s => !s)}
      aria-label={showPw ? 'Hide password' : 'Show password'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex' }}
    >
      <Ico p={showPw ? ICONS.eyeOff : ICONS.eye} size={14} sw={1.75} />
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: "var(--surface)",
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 8px rgba(4,53,77,0.06), 0 14px 34px rgba(4,53,77,0.10), 0 40px 84px rgba(4,53,77,0.08)',
        padding: 'clamp(22px, 5vw, 40px)',
        borderRadius: '20px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label='Qarevo Health home'>
            <AuthenticatedLogo width={160} priority />
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '26px',
            fontWeight: 800,
            color: T.navy,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: '0 0 8px',
          }}>
            Admin Sign In
          </h1>
          <p style={{
            fontSize: '14px',
            color: T.slate,
            lineHeight: 1.5,
            margin: 0,
          }}>
            Enter your admin credentials to access the back office.
          </p>
        </div>

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="admin-email" style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
              Email (Required)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: T.slate2, display: 'flex' }}>
                <Ico p={ICONS.message} size={14} sw={1.75} />
              </span>
              <input
                id="admin-email"
                required
                aria-invalid={!!emailErr}
                aria-describedby={emailErr ? "admin-email-error" : undefined}
                type="email"
                value={email}
                placeholder="admin@qarevo-health.de"
                autoComplete="email"
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setTouched(p => ({ ...p, email: true }))}
                onBlur={() => setTouched(p => ({ ...p, email: true }))}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 38px',
                  borderRadius: '11px',
                  border: `1.5px solid ${emailErr ? 'rgba(220,38,38,0.55)' : "var(--border)"}`,
                  background: emailErr ? "var(--danger-soft)" : "var(--surface)",
                  color: T.navy,
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxShadow: emailErr ? '0 0 0 3px rgba(220,38,38,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            </div>
            {emailErr && <p id="admin-email-error" role="alert" style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{emailErr}</p>}
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="admin-password" style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
              Password (Required)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: T.slate2, display: 'flex' }}>
                <Ico p={ICONS.lock} size={14} sw={1.75} />
              </span>
              <input
                id="admin-password"
                required
                aria-invalid={!!passErr}
                aria-describedby={passErr ? "admin-password-error" : undefined}
                type={showPw ? 'text' : 'password'}
                value={password}
                placeholder="••••••••"
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setTouched(p => ({ ...p, password: true }))}
                onBlur={() => setTouched(p => ({ ...p, password: true }))}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 38px',
                  borderRadius: '11px',
                  border: `1.5px solid ${passErr ? 'rgba(220,38,38,0.55)' : "var(--border)"}`,
                  background: passErr ? "var(--danger-soft)" : "var(--surface)",
                  color: T.navy,
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxShadow: passErr ? '0 0 0 3px rgba(220,38,38,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.08em',
                }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                {pwToggle}
              </span>
            </div>
            {passErr && <p id="admin-password-error" role="alert" style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{passErr}</p>}
          </div>

          {/* Error message */}
          {authError && (
            <div role="alert" style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.15)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: T.red, lineHeight: 1.4 }}>{authError}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px 20px',
              borderRadius: '11px',
              border: 'none',
              background: loading ? T.blue : T.blue,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(32,181,223,0.25)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <Link href='/auth/forgot-password' style={{ color: T.link, textAlign: 'center', padding: '10px' }}>Forgot your password?</Link>
        </form>

        {/* Back to main site */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              fontSize: '13px',
              color: T.slate2,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.blue}
            onMouseLeave={e => e.currentTarget.style.color = T.slate2}
          >
            <Ico p={ICONS.arrowBack} size={12} sw={1.75} />
            Back to main site
          </Link>
        </div>
      </div>
    </div>
  )
}

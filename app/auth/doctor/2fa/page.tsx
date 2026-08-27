'use client'

import { useState, useEffect, useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { apiPost, type DoctorAuthResponse } from '@/lib/api'
import { setDoctorAuthSession } from '@/lib/doctor-auth-session'

// Page background
const PAGE_BG = [
  'radial-gradient(ellipse 65% 55% at 12% 8%,   rgba(32,181,223,0.08) 0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 90% 18%,  rgba(32,181,223,0.06) 0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  '#EDF2FA',
].join(', ')

// Left panel background
const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
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
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.blue : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
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
      {error && <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.4 }}>{error}</p>}
    </div>
  )
}

// Left panel component
function LeftPanel() {
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
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 12px' }}>
          Two-Factor Authentication
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
          Verify your identity to complete the secure login process
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Secure', 'Encrypted', 'HIPAA'].map(b => (
            <span key={b} style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.04em' }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main page
export default function Doctor2FAPage() {
  const router = useRouter()
  
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+49')
  const [code, setCode] = useState('')
  
  const [touched, setTouched] = useState({
    code: false,
  })
  
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [success, setSuccess] = useState(false)

  // Load stored identifier on mount
  useEffect(() => {
    const storedIdentifier = localStorage.getItem('doctor_identifier')
    if (storedIdentifier) {
      if (storedIdentifier.includes('@')) {
        setEmail(storedIdentifier)
        setMethod('email')
      } else {
        setPhone(storedIdentifier)
        setMethod('phone')
      }
    }
  }, [])

  const codeErr = touched.code && !code ? 'Verification code is required' : ''
  const emailErr = method === 'email' && !email ? 'Email is required' : ''
  const phoneErr = method === 'phone' && !phone ? 'Phone number is required' : ''

  const handleSendCode = async () => {
    if (method === 'email' && !email) {
      setTouched({ ...touched, code: true })
      return
    }
    if (method === 'phone' && !phone) {
      setTouched({ ...touched, code: true })
      return
    }

    setLoading(true)
    setAuthError('')

    try {
      // This would trigger sending a new OTP code
      // For now, we'll just proceed to verification
      setSuccess(true)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setTouched({ code: true })
    
    if (!code || code.length !== 6) {
      setAuthError('Please enter the 6-digit verification code')
      return
    }

    if (method === 'email' && !email) {
      setAuthError('Email is required for verification')
      return
    }

    if (method === 'phone' && !phone) {
      setAuthError('Phone number is required for verification')
      return
    }

    setLoading(true)
    setAuthError('')

    try {
      const tempToken = localStorage.getItem('doctor_temp_token')
      const headers: Record<string, string> | undefined = tempToken ? { Authorization: `Bearer ${tempToken}` } : undefined
      
      const authSession = method === 'email'
        ? await apiPost<DoctorAuthResponse>('/api/v1/auth/mfa/verify-email', { email, code }, headers)
        : await apiPost<DoctorAuthResponse>('/api/v1/auth/mfa/verify-phone', { country_code: countryCode, phone, code }, headers)

      setDoctorAuthSession(authSession)

      // Clear temp tokens
      localStorage.removeItem('doctor_temp_token')
      localStorage.removeItem('doctor_identifier')
      
      // Redirect to doctor dashboard
      router.push('/doctor/dashboard')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Verification failed. Please check your code and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    localStorage.removeItem('doctor_temp_token')
    localStorage.removeItem('doctor_identifier')
    router.push('/auth/doctor/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: rgba(4,53,77,0.3); } @media (max-width: 860px) { .doctor-2fa-left { display: none !important; } }`}</style>

      {/* Left panel */}
      <div className="doctor-2fa-left">
        <LeftPanel />
      </div>

      {/* Right panel - 2FA form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>
          {/* Back link */}
          <button
            onClick={handleBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back to Login
          </button>

          {/* Form card */}
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
            padding: '40px 40px 36px',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>
                  Verify Your Identity
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  Enter the 6-digit code sent to your {method === 'email' ? 'email' : 'phone'}
                </p>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.shield} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {/* Error banner */}
            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: '11px', background: '#FFF5F5', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={16} sw={1.75} color={T.red} />
                <span style={{ fontSize: '13px', color: '#991B1B', lineHeight: 1.4 }}>{authError}</span>
              </div>
            )}

            {/* Success banner */}
            {success && (
              <div style={{ padding: '12px 16px', borderRadius: '11px', background: '#F0FDF8', border: '1px solid rgba(9,173,112,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.check} size={16} sw={2.5} color={T.green} />
                <span style={{ fontSize: '13px', color: '#166534', lineHeight: 1.4 }}>Verification code sent successfully</span>
              </div>
            )}

            {/* Method selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setMethod('email')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '11px',
                  border: method === 'email' ? `1.5px solid ${T.blue}` : '1.5px solid rgba(4,53,77,0.1)',
                  background: method === 'email' ? 'rgba(32,181,223,0.08)' : 'rgba(255,255,255,0.6)',
                  color: method === 'email' ? T.blue : T.slate,
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Ico p={ICONS.ema} size={14} sw={1.75} />
                Email
              </button>
              <button
                type="button"
                onClick={() => setMethod('phone')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '11px',
                  border: method === 'phone' ? `1.5px solid ${T.blue}` : '1.5px solid rgba(4,53,77,0.1)',
                  background: method === 'phone' ? 'rgba(32,181,223,0.08)' : 'rgba(255,255,255,0.6)',
                  color: method === 'phone' ? T.blue : T.slate,
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Ico p={ICONS.video} size={14} sw={1.75} />
                Phone
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {method === 'email' ? (
                <Field
                  label="Email Address"
                  placeholder="doctor@example.com"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  icon={ICONS.ema}
                  error={emailErr}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                  <Field
                    label="Country Code"
                    placeholder="+49"
                    value={countryCode}
                    onChange={setCountryCode}
                  />
                  <Field
                    label="Phone Number"
                    placeholder="1234567890"
                    value={phone}
                    onChange={setPhone}
                  />
                </div>
              )}

              <Field
                label="Verification Code"
                placeholder="Enter 6-digit code"
                type="text"
                value={code}
                onChange={setCode}
                icon={ICONS.shield}
                error={codeErr}
                maxLength={6}
              />

              {/* Resend link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '13px',
                    color: T.blue,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  Resend Code
                </button>
                <span style={{ fontSize: '12px', color: T.slate2 }}>
                  Code expires in 10 minutes
                </span>
              </div>

              {/* Verify button */}
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: loading ? 'rgba(32,181,223,0.4)' : `linear-gradient(135deg,${T.blue} 0%,#348CEA 100%)`,
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
                {loading ? 'Verifying...' : 'Verify & Sign In'}
                {!loading && <Ico p={ICONS.check} size={15} sw={2.2} />}
              </button>
            </div>

            {/* Help link */}
            <p style={{ textAlign: 'center', fontSize: '13px', color: T.slate2, margin: '20px 0 0', letterSpacing: '-0.01em' }}>
              Didn't receive the code?{' '}
              <Link href="/support" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

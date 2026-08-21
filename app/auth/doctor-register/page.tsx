'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { registerDoctor, type DoctorRegisterRequest } from '@/lib/api'

// Page background
const PAGE_BG = [
  'radial-gradient(ellipse 70% 55% at 15% 10%,  rgba(32,181,223,0.08)  0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 88% 20%,  rgba(32,181,223,0.06)  0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  '#EDF2FA',
].join(', ')

// Countries for phone country code
const COUNTRIES = [
  'Germany (+49)', 'Austria (+43)', 'Switzerland (+41)', 'France (+33)',
  'Netherlands (+31)', 'Belgium (+32)', 'Spain (+34)', 'Italy (+39)',
  'United Kingdom (+44)', 'Other',
]

// Password strength checker
function getStrength(pw: string) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/]/.test(pw),
    noCommon: !/(password|123456|qwerty|admin)/i.test(pw),
  }
  const score = Object.values(checks).filter(Boolean).length
  const levels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['', T.red, T.amber, '#2563EB', T.green, T.green]
  return { checks, score, label: levels[score] ?? '', color: colors[score] ?? T.slate2 }
}

// Field component
interface FieldProps {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
  success?: boolean
  optional?: boolean
  autoComplete?: string
  icon?: string | readonly string[]
  rightSlot?: React.ReactNode
  disabled?: boolean
  onBlur?: () => void
}

function Field({ label, placeholder, type = 'text', value, onChange, error, hint, success, optional, autoComplete, icon, rightSlot, disabled, onBlur }: FieldProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
          {label}
        </label>
        {optional && <span style={{ fontSize: '11.5px', color: T.slate2, fontWeight: 400 }}>Optional</span>}
      </div>
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
          disabled={disabled}
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
      {error && <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.4 }}>{error}</p>}
      {hint && !error && <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  )
}

// Checkbox component
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
          width: '17px',
          height: '17px',
          borderRadius: '5px',
          flexShrink: 0,
          border: `1.5px solid ${checked ? T.blue : 'rgba(4,53,77,0.18)'}`,
          background: checked ? T.blue : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.14s',
          boxShadow: checked ? '0 1px 4px rgba(32,181,223,0.25)' : 'none',
          outline: 'none',
        }}
      >
        {checked && <Ico p={ICONS.check} size={9} sw={3} color="#fff" />}
      </div>
      <span style={{ fontSize: '13px', color: T.slate, letterSpacing: '-0.005em' }}>{children}</span>
    </label>
  )
}

// Main page
export default function DoctorRegisterPage() {
  const router = useRouter()
  
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+49')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [isIndependent, setIsIndependent] = useState(false)
  
  const [consents, setConsents] = useState({
    terms_privacy: false,
    telehealth: false,
    marketing: false,
  })
  
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    phone: false,
    licenseNumber: false,
  })
  
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailErr = touched.email && !EMAIL_RE.test(email) ? 'Enter a valid email address' : ''
  const passErr = touched.password && password.length < 8 ? 'Password must be at least 8 characters' : ''
  const passStrength = getStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      phone: false,
      licenseNumber: false,
    })
    
    if (!EMAIL_RE.test(email) || password.length < 8 || !firstName || !lastName) {
      return
    }
    
    if (!consents.terms_privacy || !consents.telehealth) {
      setAuthError('You must accept Terms & Privacy and Telehealth consent')
      return
    }

    setLoading(true)
    setAuthError('')

    try {
      const registerData: DoctorRegisterRequest = {
        first_name: firstName,
        middle_name: middleName || undefined,
        last_name: lastName,
        email: email.toLowerCase(),
        password,
        phone: phone || undefined,
        country_code: countryCode,
        date_of_birth: dateOfBirth || undefined,
        gender: gender || null,
        specialty: specialty || undefined,
        experience_years: experienceYears ? parseInt(experienceYears) : undefined,
        license_number: licenseNumber || undefined,
        is_independent: isIndependent,
        consents,
      }

      const response = await registerDoctor(registerData)
      
      // Redirect to doctor-specific email verification page
      router.push(`/auth/doctor-verify-email?email=${encodeURIComponent(email)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.'
      
      // Improve error messages for better UX
      if (errorMessage.includes('Email already registered')) {
        setAuthError('This email is already registered. Please sign in or use a different email address.')
      } else if (errorMessage.includes('Password')) {
        setAuthError('Password does not meet requirements. Please use a stronger password.')
      } else if (errorMessage.includes('specialty')) {
        setAuthError('Invalid medical specialty. Please select a valid specialty.')
      } else {
        setAuthError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const pwToggle = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex' }}
    >
      <Ico p={showPassword ? ICONS.user : ICONS.lock} size={14} sw={1.75} />
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: rgba(4,53,77,0.3); } body { margin: 0; }`}</style>

      {/* Left panel - branding */}
      <div style={{
        width: '380px',
        flexShrink: 0,
        background: 'linear-gradient(135deg, #04354D 0%, #0E151A 100%)',
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
            Join Qarevo as<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>a Physician</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Create your physician account and start providing virtual consultations with clinical intelligence support.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['HIPAA', 'GDPR', 'ISO 27001'].map(b => (
              <span key={b} style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.04em' }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - registration form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          {/* Back link */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back
          </Link>

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
                  Physician Registration
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  Create your account to start seeing patients
                </p>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.steth} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {/* Error banner */}
            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: '11px', background: '#FFF5F5', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={16} sw={1.75} color={T.red} />
                <span style={{ fontSize: '13px', color: '#991B1B', lineHeight: 1.4 }}>{authError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChange={setFirstName}
                  error={touched.firstName && !firstName ? 'First name is required' : ''}
                  onBlur={() => setTouched({ ...touched, firstName: true })}
                />
                <Field
                  label="Last Name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={setLastName}
                  error={touched.lastName && !lastName ? 'Last name is required' : ''}
                  onBlur={() => setTouched({ ...touched, lastName: true })}
                />
              </div>

              <Field
                label="Middle Name"
                placeholder="Optional"
                value={middleName}
                onChange={setMiddleName}
                optional
              />

              <Field
                label="Email Address"
                placeholder="doctor@example.com"
                type="email"
                value={email}
                onChange={setEmail}
                icon={ICONS.ema}
                error={emailErr}
                onBlur={() => setTouched({ ...touched, email: true })}
                autoComplete="email"
              />

              <Field
                label="Password"
                placeholder="Create a strong password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                icon={ICONS.lock}
                rightSlot={pwToggle}
                error={passErr}
                onBlur={() => setTouched({ ...touched, password: true })}
                autoComplete="new-password"
              />

              {/* Password strength indicator */}
              {password && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: passStrength.color ? `${passStrength.color}15` : 'rgba(4,53,77,0.04)' }}>
                  <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${(passStrength.score / 5) * 100}%`, height: '100%', background: passStrength.color || T.slate2, transition: 'all 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: passStrength.color || T.slate2, minWidth: '50px' }}>{passStrength.label}</span>
                </div>
              )}

              {/* Phone fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                <Field
                  label="Country Code"
                  placeholder="+49"
                  value={countryCode}
                  onChange={setCountryCode}
                  optional
                />
                <Field
                  label="Phone Number"
                  placeholder="1234567890"
                  value={phone}
                  onChange={setPhone}
                  optional
                />
              </div>

              {/* Professional information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label="Date of Birth"
                  placeholder="Select date of birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  optional
                />
                <Field
                  label="Gender"
                  placeholder="e.g., Male, Female, Other"
                  type="text"
                  value={gender}
                  onChange={setGender}
                  optional
                />
              </div>

              <Field
                label="Medical Specialty"
                placeholder="e.g., Cardiology, General Practice"
                value={specialty}
                onChange={setSpecialty}
                optional
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label="Years of Experience"
                  placeholder="e.g., 5"
                  value={experienceYears}
                  onChange={setExperienceYears}
                  optional
                />
                <Field
                  label="License Number"
                  placeholder="Medical license number"
                  value={licenseNumber}
                  onChange={setLicenseNumber}
                  optional
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Checkbox
                  checked={isIndependent}
                  onChange={() => setIsIndependent(!isIndependent)}
                >
                  I am an independent practitioner
                </Checkbox>
              </div>

              {/* Consents */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(32,181,223,0.04)', border: '1px solid rgba(32,181,223,0.12)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Checkbox
                    checked={consents.terms_privacy}
                    onChange={() => setConsents({ ...consents, terms_privacy: !consents.terms_privacy })}
                  >
                    I accept the <Link href="/terms" style={{ color: T.blue, textDecoration: 'underline' }}>Terms of Service</Link> and <Link href="/privacy" style={{ color: T.blue, textDecoration: 'underline' }}>Privacy Policy</Link>
                  </Checkbox>
                  <Checkbox
                    checked={consents.telehealth}
                    onChange={() => setConsents({ ...consents, telehealth: !consents.telehealth })}
                  >
                    I consent to telehealth services and virtual consultations
                  </Checkbox>
                  <Checkbox
                    checked={consents.marketing}
                    onChange={() => setConsents({ ...consents, marketing: !consents.marketing })}
                  >
                    I agree to receive marketing communications (optional)
                  </Checkbox>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !consents.terms_privacy || !consents.telehealth}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: loading || !consents.terms_privacy || !consents.telehealth
                    ? 'rgba(32,181,223,0.4)'
                    : `linear-gradient(135deg,${T.blue} 0%,#348CEA 100%)`,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  cursor: loading || !consents.terms_privacy || !consents.telehealth ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: loading || !consents.terms_privacy || !consents.telehealth
                    ? 'none'
                    : '0 3px 10px rgba(32,181,223,0.32), 0 1px 3px rgba(32,181,223,0.2)',
                }}
              >
                {loading ? 'Creating Account...' : 'Create Physician Account'}
                {!loading && <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />}
              </button>
            </form>

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '24px 0 0', letterSpacing: '-0.01em' }}>
              Already have an account?{' '}
              <Link href="/auth/doctor/login" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

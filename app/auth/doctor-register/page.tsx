'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { focusValidation } from '@/components/ui/ValidationFeedback'
import { T } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ApiError, checkDoctorUsernameAvailability, getApiErrorDetail, registerDoctor, type DoctorRegisterRequest } from '@/lib/api'
import { cancelSocialRegistration, clearSocialProfile, readSocialProfile, type SocialProfile } from '@/lib/social-auth'

// Page background
const PAGE_BG = [
  'radial-gradient(ellipse 70% 55% at 15% 10%,  rgba(32,181,223,0.08)  0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 88% 20%,  rgba(32,181,223,0.06)  0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  'var(--canvas)',
].join(', ')

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
  const levels = ['', 'strengthWeak', 'strengthFair', 'strengthGood', 'strengthStrong', 'strengthExcellent']
  const colors = ['', T.red, T.amber, '#2563EB', T.green, T.green]
  return { checks, score, label: levels[score] ?? '', color: colors[score] ?? T.slate2 }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9._-]+$/
const COUNTRY_CODE_RE = /^\+[1-9]\d{0,2}$/
const PHONE_RE = /^\d{4,14}$/

function getFriendlyDoctorRegisterError(error: unknown, t: (key: string) => string) {
  const detail = getApiErrorDetail(error)?.toLowerCase() ?? ''
  if (error instanceof ApiError && /"error_code":"SOCIAL_/.test(error.body.replace(/\s/g, ''))) return t('errSocial')

  if (detail.includes('email already registered')) {
    return t('errEmailRegistered')
  }
  if (detail.includes('username already taken')) {
    return t('errUsernameTaken')
  }
  if (detail.includes('password')) {
    return t('errPassword')
  }
  if (detail.includes('specialty')) {
    return t('errSpecialty')
  }
  if (detail.includes('valid email') || detail.includes('email address')) {
    return t('errEmail')
  }
  if (detail.includes('phone')) {
    return t('errPhone')
  }
  if (error instanceof ApiError && error.status === 422) {
    return t('errCheck')
  }
  if (error instanceof ApiError && error.status >= 500) {
    return t('errUnavailable')
  }

  return 'We could not create the doctor account right now. Please try again.'
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
  const t = useTranslations('auth.doctorRegister')
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
          {label}{!optional && ' (Required)'}
        </label>
        {optional && <span style={{ fontSize: "13px", color: T.slate2, fontWeight: 400 }}>{t('optional')}</span>}
      </div>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.link : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
            <Ico p={icon} size={14} sw={1.75} />
          </span>
        )}
        <input
          id={id}
          type={type}
          required={!optional}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
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
      {error && <p id={`${id}-error`} className="field-error" style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{error}</p>}
      {hint && !error && <p id={`${id}-hint`} style={{ margin: 0, fontSize: "13px", color: T.slate2, lineHeight: 1.4 }}>{hint}</p>}
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
          border: `1.5px solid ${checked ? T.blue : "var(--border)"}`,
          background: checked ? T.blue : "var(--surface)",
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
  const t = useTranslations('auth.doctorRegister')
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+49')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [isOtherSpecialty, setIsOtherSpecialty] = useState(false)
  const [experienceYears, setExperienceYears] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [isIndependent, setIsIndependent] = useState(false)

  const [consentAccepted, setConsentAccepted] = useState(false)
  // Continuing a provider sign-up (the ticket stays in an HttpOnly cookie).
  const [social, setSocial] = useState<SocialProfile | null>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('social') !== '1') return
    const profile = readSocialProfile()
    if (!profile) return
    const timer = window.setTimeout(() => {
      setSocial(profile)
      if (profile.email) setEmail(profile.email)
      if (profile.first_name) setFirstName(current => current || profile.first_name)
      if (profile.last_name) setLastName(current => current || profile.last_name)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  const providerName = social ? { google: 'Google', microsoft: 'Microsoft', apple: 'Apple' }[social.provider] : ''
  const emailLocked = Boolean(social?.email_verified && social.email)

  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    username: false,
    email: false,
    password: false,
    countryCode: false,
    phone: false,
    dateOfBirth: false,
    gender: false,
    licenseNumber: false,
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [authError, setAuthError] = useState('')

  const normalizedUsername = username.trim().toLowerCase()
  const usernameErr = touched.username && normalizedUsername && !USERNAME_RE.test(normalizedUsername)
    ? t('valUsernameChars')
    : touched.username && normalizedUsername.length > 0 && normalizedUsername.length < 3
    ? t('valUsernameLength')
    : touched.username && usernameAvailable === false
    ? t('valUsernameTaken')
    : ''
  const emailErr = touched.email && !EMAIL_RE.test(email) ? t('valEmail') : ''
  const passErr = touched.password && (password.length < 8 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)) ? t('valPassword') : ''
  const countryCodeErr = touched.countryCode && !COUNTRY_CODE_RE.test(countryCode.trim()) ? t('valCountryCode') : ''
  const phoneErr = touched.phone && !PHONE_RE.test(phone.trim()) ? t('valPhone') : ''
  const dateOfBirthErr = touched.dateOfBirth && (!dateOfBirth || dateOfBirth >= new Date().toISOString().slice(0, 10)) ? t('valBirthDate') : ''
  const experienceErr = submitted && experienceYears && (!/^\d{1,2}$/.test(experienceYears) || Number(experienceYears) > 80) ? t('valExperience') : ''
  const specialtyErr = submitted && isOtherSpecialty && customSpecialty.trim().length < 2 ? t('valSpecialty') : ''
  const genderErr = touched.gender && !gender.trim() ? t('valGender') : ''
  const passStrength = getStrength(password)

  useEffect(() => {
    if (!normalizedUsername || normalizedUsername.length < 3 || !USERNAME_RE.test(normalizedUsername)) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setUsernameChecking(true)
      try {
        const result = await checkDoctorUsernameAvailability(normalizedUsername)
        if (!cancelled) setUsernameAvailable(result.valid && result.available)
      } catch {
        if (!cancelled) setUsernameAvailable(null)
      } finally {
        if (!cancelled) setUsernameChecking(false)
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [normalizedUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setAuthError('')
    setTouched({
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      password: true,
      countryCode: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      licenseNumber: false,
    })

    if (
      !EMAIL_RE.test(email) ||
      password.length < 8 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password) ||
      firstName.trim().length < 1 ||
      lastName.trim().length < 1 ||
      (experienceYears && (!/^\d{1,2}$/.test(experienceYears) || Number(experienceYears) > 80)) ||
      (isOtherSpecialty && customSpecialty.trim().length < 2) ||
      !COUNTRY_CODE_RE.test(countryCode.trim()) ||
      !PHONE_RE.test(phone.trim()) ||
      !dateOfBirth || dateOfBirth >= new Date().toISOString().slice(0, 10) ||
      !gender.trim() ||
      (!!normalizedUsername && (!USERNAME_RE.test(normalizedUsername) || normalizedUsername.length < 3 || usernameAvailable === false))
    ) {
      setAuthError(t('pleaseCorrectTheHighlightedFields'))
      focusValidation(e.currentTarget)
      return
    }

    if (!consentAccepted) {
      setAuthError(t('pleaseAcknowledgeTheDevelopmentTest'))
      return
    }

    setLoading(true)
    setAuthError('')

    try {
      const registerData: DoctorRegisterRequest = {
        first_name: firstName,
        middle_name: middleName || undefined,
        last_name: lastName,
        username: normalizedUsername || undefined,
        email: email.toLowerCase(),
        password,
        phone,
        country_code: countryCode,
        date_of_birth: dateOfBirth,
        gender,
        specialty: isOtherSpecialty ? customSpecialty : specialty,
        experience_years: experienceYears ? parseInt(experienceYears) : undefined,
        license_number: licenseNumber || undefined,
        is_independent: isIndependent,
        consents: {
          terms_privacy: true,
          telehealth: true,
          // Marketing is opt-in only; registration never assumes it.
          marketing: false,
        },
      }

      const created = await registerDoctor(registerData)
      clearSocialProfile()
      if (created.email_verified) {
        // The provider verified this address: next is Qarevo's review, not an email code.
        router.push('/auth/doctor-verify-email?confirmed=1')
        return
      }
      // Redirect to doctor-specific email verification page with phone details
      router.push(`/auth/doctor-verify-email?email=${encodeURIComponent(email)}&country_code=${countryCode}&phone=${phone || ''}`)
    } catch (error) {
      setAuthError(getFriendlyDoctorRegisterError(error, t))
    } finally {
      setLoading(false)
    }
  }

  const pwToggle = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? t('hidePasswordLabel') : t('showPasswordLabel')}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex' }}
    >
      <Ico p={showPassword ? ICONS.eyeOff : ICONS.eye} size={14} sw={1.75} />
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: var(--text-muted); } body { margin: 0; } @media (max-width: 860px) { .doctor-register-left { display: none !important; } } .doctor-register-card { padding: clamp(20px, 6vw, 40px); }`}</style>

      {/* Left panel - branding (hidden on small screens, like the other clinician auth pages) */}
      <div className="doctor-register-left" style={{
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
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label={t('qarevoHealthHome')}>
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
            {t('joinQarevoAs')}<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>{t('aPhysician')}</span>
          </h2>
          <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            {t('createYourPhysicianAccountAnd')}
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[t('badgeDevelopment'), t('badgeSynthetic'), t('badgeTestAccounts')].map(b => (
              <span key={b} style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.78)", letterSpacing: '0.04em' }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - registration form */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px, 6vw, 48px) 16px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '500px', minWidth: 0 }}>
          {/* Back link */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            {t('back')}
          </Link>

          {/* Form card */}
          <div className="doctor-register-card" style={{
            background: "var(--surface-glass)",
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: "1px solid var(--border)",
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.05)',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 7px' }}>
                  {t('physicianRegistration')}
                </h1>
                <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                  {t('createATestClinicianAccount')}
                </p>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.steth} size={20} sw={1.25} color="#fff" />
              </div>
            </div>

            {/* Error banner */}
            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: '11px', background: "var(--danger-soft)", border: '1px solid rgba(220,38,38,0.25)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <Ico p={ICONS.info} size={16} sw={1.75} color={T.red} />
                <span style={{ fontSize: '13px', color: '#991B1B', lineHeight: 1.4 }}>{authError}</span>
              </div>
            )}

            {/* Form */}
            <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label={t('firstName')}
                  placeholder={t('firstNamePlaceholder')}
                  value={firstName}
                  onChange={setFirstName}
                  error={touched.firstName && firstName.trim().length < 1 ? t('valFirstName') : ''}
                  onBlur={() => setTouched({ ...touched, firstName: true })}
                />
                <Field
                  label={t('lastName')}
                  placeholder={t('lastNamePlaceholder')}
                  value={lastName}
                  onChange={setLastName}
                  error={touched.lastName && lastName.trim().length < 1 ? t('valLastName') : ''}
                  onBlur={() => setTouched({ ...touched, lastName: true })}
                />
              </div>

              <Field
                label={t('middleName')}
                placeholder={t('optional')}
                value={middleName}
                onChange={setMiddleName}
                optional
              />

              <Field
                label={t('username')}
                placeholder="dr.john.doe"
                value={username}
                onChange={(value) => {
                  setUsername(value.toLowerCase())
                  setUsernameAvailable(null)
                  setUsernameChecking(false)
                }}
                icon={ICONS.user}
                error={usernameErr}
                hint={
                  usernameChecking
                    ? t('usernameChecking')
                    : usernameAvailable
                    ? t('usernameAvailable')
                    : t('usernameHint')
                }
                success={usernameAvailable === true && !usernameErr}
                onBlur={() => setTouched({ ...touched, username: true })}
                autoComplete="username"
                optional
              />

              {social && (
                <div role="status" style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', fontSize: '14px', lineHeight: 1.5, color: 'var(--text)', display: 'grid', gap: '6px' }}>
                  <span>{emailLocked ? t('socialVerified', { provider: providerName }) : t('socialUnverified', { provider: providerName })}</span>
                  <button type="button" onClick={() => { void cancelSocialRegistration(); setSocial(null) }} style={{ justifySelf: 'start', minHeight: 36, padding: 0, background: 'none', border: 'none', color: 'var(--link)', fontWeight: 700, cursor: 'pointer' }}>{t('socialCancel', { provider: providerName })}</button>
                </div>
              )}
              <Field
                label={t('emailAddress')}
                placeholder="doctor@example.com"
                type="email"
                value={email}
                onChange={emailLocked ? () => {} : setEmail}
                icon={ICONS.ema}
                error={emailErr}
                onBlur={() => setTouched({ ...touched, email: true })}
                autoComplete="email"
              />

              <Field
                label={t('password')}
                placeholder={t('createAStrongPassword')}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: passStrength.color ? `${passStrength.color}15` : "var(--surface-hover)" }}>
                  <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: "var(--surface-hover)", overflow: 'hidden' }}>
                    <div style={{ width: `${(passStrength.score / 5) * 100}%`, height: '100%', background: passStrength.color || T.slate2, transition: 'all 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: passStrength.color || T.slate2, minWidth: '50px' }}>{passStrength.label ? t(passStrength.label) : ''}</span>
                </div>
              )}

              {/* Phone fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                <Field
                  label={t('countryCode')}
                  placeholder="+49"
                  value={countryCode}
                  onChange={setCountryCode}
                  error={countryCodeErr}
                  onBlur={() => setTouched({ ...touched, countryCode: true })}
                />
                <Field
                  label={t('phoneNumber')}
                  hint={t('phoneHint')}
                  placeholder="1234567890"
                  value={phone}
                  onChange={setPhone}
                  error={phoneErr}
                  onBlur={() => setTouched({ ...touched, phone: true })}
                />
              </div>

              {/* Professional information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label={t('dateOfBirth')}
                  placeholder={t('selectDateOfBirth')}
                  type="date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  error={dateOfBirthErr}
                  onBlur={() => setTouched({ ...touched, dateOfBirth: true })}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
                    {t('gender')}
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    onBlur={() => setTouched({ ...touched, gender: true })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '11px',
                      border: genderErr ? '1.5px solid rgba(220,38,38,0.55)' : "1.5px solid var(--border)",
                      background: "var(--surface-glass)",
                      color: gender ? T.navy : T.slate2,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    <option value="">{t('selectGender')}</option>
                    <option value="Male">{t('male')}</option>
                    <option value="Female">{t('female')}</option>
                    <option value="Other">{t('other')}</option>
                  </select>
                  {genderErr && <p style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.4 }}>{genderErr}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
                  {t('medicalSpecialty')}
                  <span style={{ fontSize: "13px", color: T.slate2, fontWeight: 400, marginLeft: '4px' }}>{t('optional')}</span>
                </label>
                <select
                  value={specialty}
                  onChange={e => {
                    const value = e.target.value
                    setSpecialty(value)
                    setIsOtherSpecialty(value === 'OTHER')
                    if (value !== 'OTHER') setCustomSpecialty('')
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '11px',
                    border: "1.5px solid var(--border)",
                    background: "var(--surface-glass)",
                    color: specialty ? T.navy : T.slate2,
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                >
                  <option value="">{t('selectSpecialtyOptional')}</option>
                  <option value="GENERAL_MEDICINE">{t('generalMedicine')}</option>
                  <option value="FAMILY_MEDICINE">{t('familyMedicine')}</option>
                  <option value="INTERNAL_MEDICINE">{t('internalMedicine')}</option>
                  <option value="EMERGENCY_MEDICINE">{t('emergencyMedicine')}</option>
                  <option value="GENERAL_SURGERY">{t('generalSurgery')}</option>
                  <option value="CARDIOLOGY">{t('cardiology')}</option>
                  <option value="NEUROLOGY">{t('neurology')}</option>
                  <option value="DERMATOLOGY">{t('dermatology')}</option>
                  <option value="PEDIATRICS">{t('pediatrics')}</option>
                  <option value="GYNECOLOGY">{t('gynecology')}</option>
                  <option value="ONCOLOGY">{t('oncology')}</option>
                  <option value="PSYCHIATRY">{t('psychiatry')}</option>
                  <option value="RADIOLOGY">{t('radiology')}</option>
                  <option value="ANESTHESIOLOGY">{t('anesthesiology')}</option>
                  <option value="GASTROENTEROLOGY">{t('gastroenterology')}</option>
                  <option value="NEPHROLOGY">{t('nephrology')}</option>
                  <option value="PULMONOLOGY">{t('pulmonology')}</option>
                  <option value="UROLOGY">{t('urology')}</option>
                  <option value="OPHTHALMOLOGY">{t('ophthalmology')}</option>
                  <option value="ENT">{t('entOtolaryngology')}</option>
                  <option value="ENDOCRINOLOGY">{t('endocrinology')}</option>
                  <option value="HEMATOLOGY">{t('hematology')}</option>
                  <option value="RHEUMATOLOGY">{t('rheumatology')}</option>
                  <option value="INFECTIOUS_DISEASE">{t('infectiousDisease')}</option>
                  <option value="GERIATRICS">{t('geriatrics')}</option>
                  <option value="SPORTS_MEDICINE">{t('sportsMedicine')}</option>
                  <option value="PLASTIC_SURGERY">{t('plasticSurgery')}</option>
                  <option value="OTHER">{t('otherSpecifyBelow')}</option>
                </select>
                {isOtherSpecialty && (
                  <Field
                    label={t('pleaseSpecifyYourSpecialty')}
                    error={specialtyErr || undefined}
                    placeholder={t('eGSportsMedicinePalliative')}
                    value={customSpecialty}
                    onChange={setCustomSpecialty}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field
                  label={t('yearsOfExperience')}
                  error={experienceErr || undefined}
                  hint={t('experienceHint')}
                  placeholder="e.g., 5"
                  value={experienceYears}
                  onChange={setExperienceYears}
                  optional
                />
                <Field
                  label={t('licenseNumber')}
                  placeholder={t('medicalLicenseNumber')}
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
                  {t('iAmAnIndependentPractitioner')}
                </Checkbox>
              </div>

              {/* Consents */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(32,181,223,0.04)', border: '1px solid rgba(32,181,223,0.12)' }}>
                <Checkbox
                  checked={consentAccepted}
                  onChange={() => { setConsentAccepted(!consentAccepted); setAuthError('') }}
                >
                  {t('iWillUseSyntheticInformation')} <Link href="/terms" style={{ color: T.link, textDecoration: 'underline' }}>{t('termsOfService')}</Link> {t('and')} <Link href="/privacy" style={{ color: T.link, textDecoration: 'underline' }}>{t('privacyPolicy')}</Link> {t('areAwaitingApprovalThisDoes')}
                </Checkbox>
              </div>

              {submitted && !consentAccepted && <p className="field-error" role="alert">{t('acknowledgeTheDevelopmentTestConditions')}</p>}
              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: loading
                    ? 'rgba(32,181,223,0.4)'
                    : `linear-gradient(135deg,${T.blue} 0%,var(--primary-end) 100%)`,
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
                  boxShadow: loading
                    ? 'none'
                    : '0 3px 10px rgba(32,181,223,0.32), 0 1px 3px rgba(32,181,223,0.2)',
                }}
              >
                {loading ? t('creatingAccount') : t('createPhysicianAccount')}
                {!loading && <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />}
              </button>
            </form>

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '24px 0 0', letterSpacing: '-0.01em' }}>
              {t('alreadyHaveAccount')}{' '}
              <Link href="/auth/doctor/login" style={{ color: T.link, fontWeight: 700, textDecoration: 'none' }}>
                {t('signIn')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

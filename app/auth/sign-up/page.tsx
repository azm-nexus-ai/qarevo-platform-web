'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { useStore } from '@/store/useStore'

// ─── Page background ──────────────────────────────────────────────────────────

const PAGE_BG = [
  'radial-gradient(ellipse 70% 55% at 15% 10%,  rgba(32,181,223,0.08)  0%, transparent 55%)',
  'radial-gradient(ellipse 55% 50% at 88% 20%,  rgba(32,181,223,0.06)  0%, transparent 52%)',
  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(52,140,234,0.06) 0%, transparent 58%)',
  '#EDF2FA',
].join(', ')

// ─── COUNTRIES ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  'Austria', 'Belgium', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway',
  'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain',
  'Sweden', 'Switzerland', 'United Kingdom', 'Other',
]

// ─── Password strength ────────────────────────────────────────────────────────

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

// ─── Shared input primitive ────────────────────────────────────────────────────

interface FieldProps {
  label: string
  placeholder: string
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
        {hasLeft && (
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.blue : T.slate2, display: 'flex', transition: 'color 0.15s', pointerEvents: 'none' }}>
            <Ico p={icon!} size={14} sw={1.75} />
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
            padding: `11px ${hasRight ? '40px' : '14px'} 11px ${hasLeft ? '38px' : '14px'}`,
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
            opacity: disabled ? 0.5 : 1,
          }}
        />
        {(rightSlot || success || error) && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {rightSlot
              ? rightSlot
              : success
                ? <Ico p={ICONS.check} size={14} sw={2.5} color={T.green} />
                : <Ico p={ICONS.info} size={14} sw={1.75} color={T.red} />}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p style={{ margin: 0, fontSize: '12px', color: error ? T.red : T.slate2, lineHeight: 1.4, letterSpacing: '-0.005em' }}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

// ─── Password field ────────────────────────────────────────────────────────────

function PasswordField({ label, value, onChange, error, showStrength, confirm }: {
  label: string; value: string; onChange: (v: string) => void
  error?: string; showStrength?: boolean; confirm?: string
}) {
  const [show, setShow] = useState(false)
  const strength = showStrength ? getStrength(value) : null
  const isMatch = confirm !== undefined ? value === confirm && value.length > 0 : undefined

  const toggle = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShow(s => !s)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.slate2, display: 'flex', alignItems: 'center' }}
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      <Ico p={show ? ICONS.user : ICONS.lock} size={14} sw={1.75} />
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Field
        label={label}
        placeholder="••••••••••••"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        error={error}
        success={isMatch}
        icon={ICONS.lock}
        rightSlot={!error && !isMatch ? toggle : undefined}
        autoComplete={showStrength ? 'new-password' : 'current-password'}
      />
      {showStrength && value.length > 0 && strength && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Strength bar */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ flex: 1, height: '3px', borderRadius: '100px', background: i <= strength.score ? strength.color : 'rgba(4,53,77,0.09)', transition: 'background 0.2s' }} />
            ))}
            <span style={{ marginLeft: '8px', fontSize: '11.5px', fontWeight: 700, color: strength.color, minWidth: '60px' }}>{strength.label}</span>
          </div>
          {/* Requirement pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { key: 'length', label: '8+ chars' },
              { key: 'upper', label: 'Uppercase' },
              { key: 'number', label: 'Number' },
              { key: 'special', label: 'Symbol' },
            ].map(({ key, label }) => {
              const met = strength.checks[key as keyof typeof strength.checks]
              return (
                <span key={key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 9px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
                  background: met ? 'rgba(9,173,112,0.1)' : 'rgba(4,53,77,0.05)',
                  color: met ? T.green : T.slate2, letterSpacing: '-0.005em',
                  transition: 'all 0.18s',
                }}>
                  {met
                    ? <Ico p={ICONS.check} size={9} sw={3} color={T.green} />
                    : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(4,53,77,0.2)', display: 'inline-block' }} />}
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: () => void; children: React.ReactNode; error?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={onChange}
        onKeyDown={e => e.key === ' ' && onChange()}
        style={{
          marginTop: '1px', width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
          border: `1.5px solid ${error ? T.red : checked ? T.blue : 'rgba(4,53,77,0.18)'}`,
          background: checked ? T.blue : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.14s', boxShadow: checked ? '0 1px 4px rgba(32,181,223,0.25)' : 'none',
          outline: 'none',
        }}
      >
        {checked && <Ico p={ICONS.check} size={9} sw={3} color="#fff" />}
      </div>
      <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.55, letterSpacing: '-0.005em' }}>{children}</span>
    </label>
  )
}

// ─── Social button ─────────────────────────────────────────────────────────────

function SocialBtn({ provider, onClick }: { provider: 'google' | 'microsoft'; onClick?: () => void }) {
  const [h, setH] = useState(false)
  const cfg = {
    google: {
      label: 'Continue with Google',
      icon: (
        <svg width="17" height="17" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.075 17.64 11.767 17.64 9.2z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
      ),
    },
    microsoft: {
      label: 'Continue with Microsoft',
      icon: (
        <svg width="17" height="17" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
      ),
    },
  }[provider]

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        flex: 1, padding: '11px 14px', borderRadius: '11px',
        border: `1.5px solid ${h ? 'rgba(4,53,77,0.13)' : T.border}`,
        background: h ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '9px', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600,
        color: T.navy, letterSpacing: '-0.01em', transition: 'all 0.14s ease',
        boxShadow: h ? '0 2px 8px rgba(4,53,77,0.09)' : 'inset 0 1px 0 rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  )
}

// ─── Decorative left column ────────────────────────────────────────────────────

function LeftDecor() {
  return (
    <div style={{
      width: '360px', flexShrink: 0,
      background: [
        'radial-gradient(ellipse 80% 60% at 20% 15%,  rgba(32,181,223,0.28) 0%, transparent 55%)',
        'radial-gradient(ellipse 60% 55% at 85% 20%,  rgba(32,181,223,0.2)  0%, transparent 50%)',
        'radial-gradient(ellipse 70% 65% at 50% 95%,  rgba(52,140,234,0.22) 0%, transparent 55%)',
        T.navy,
      ].join(', '),
      borderRadius: '0 32px 32px 0',
      position: 'sticky', top: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '48px 40px',
      overflow: 'hidden',
    }}>
      {/* Dot grid */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1.2px)', backgroundSize: '22px 22px' }} />
      {/* Glow blobs */}
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '48px' }}>
          <Link href='/' aria-label='Qarevo Health home' style={{ display: 'inline-flex', alignItems: 'center' }}>
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

        {/* Central illustration — concentric rings with icon nodes */}
        <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 40px' }}>
          {[0, 30, 60].map((inset, i) => (
            <div key={i} style={{ position: 'absolute', inset, borderRadius: '50%', border: `1px solid rgba(255,255,255,${0.06 + i * 0.04})` }} />
          ))}
          {/* Core */}
          <div style={{
            position: 'absolute', inset: '60px', borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.3) 0%, rgba(32,181,223,0.15) 50%, transparent 75%)',
            border: '1px solid rgba(52,140,234,0.25)',
            boxShadow: '0 0 50px rgba(32,181,223,0.3), inset 0 1px 0 rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico p={ICONS.user} size={28} sw={1.25} color="rgba(255,255,255,0.88)" />
          </div>
          {/* Orbit nodes */}
          {[
            { angle: 0, icon: ICONS.shield, bg: 'rgba(9,173,112,0.28)', border: 'rgba(165,224,218,0.3)' },
            { angle: 90, icon: ICONS.brain, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
            { angle: 180, icon: ICONS.heart, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
            { angle: 270, icon: ICONS.lock, bg: 'rgba(217,119,6,0.22)', border: 'rgba(251,191,36,0.25)' },
          ].map(({ angle, icon, bg, border }) => {
            const r = 82; const rad = (angle - 90) * Math.PI / 180
            const x = 110 + r * Math.cos(rad), y = 110 + r * Math.sin(rad)
            return (
              <div key={angle} style={{ position: 'absolute', left: `${x - 18}px`, top: `${y - 18}px`, width: '36px', height: '36px', borderRadius: '11px', background: bg, border: `1px solid ${border}`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico p={icon} size={16} sw={1.5} color="rgba(255,255,255,0.85)" />
              </div>
            )
          })}
        </div>

        {/* Text */}
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 12px', textAlign: 'center' }}>
          Join 180,000 patients<br />
          <span style={{ color: 'rgba(147,197,253,0.9)' }}>across Europe</span>
        </h2>
        <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 32px', textAlign: 'center', letterSpacing: '-0.01em' }}>
          Verified physicians, AI-powered diagnostics, and seamless care — all in one secure platform.
        </p>

        {/* Social proof strip */}
        {[
          { icon: ICONS.shield, label: 'HIPAA Ready', color: 'rgba(165,224,218,0.85)' },
          { icon: ICONS.lock, label: 'GDPR Compliant', color: 'rgba(147,197,253,0.85)' },
          { icon: ICONS.check, label: 'ISO 27001', color: 'rgba(251,191,36,0.85)' },
        ].map(({ icon, label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Ico p={icon} size={14} sw={1.75} color={color} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sign-up form ──────────────────────────────────────────────────────────────

const PHONE_RE = /^\+?[0-9\s\-().]{6,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIGNUP_STORAGE_KEY = 'qarevo.auth.signup.v1'

export default function SignUpPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '',
    country: '', phone: '', referral: '',
  })
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({})
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const signup = useStore((state) => state.signup)
  const isLoading = useStore((state) => state.isLoading)
  const error = useStore((state) => state.error)

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const touch = (k: keyof typeof form) => setTouched(t => ({ ...t, [k]: true }))

  // Validation
  const errors = {
    firstName: touched.firstName && !form.firstName.trim() ? 'First name is required' : '',
    lastName: touched.lastName && !form.lastName.trim() ? 'Last name is required' : '',
    email: touched.email && !EMAIL_RE.test(form.email) ? 'Enter a valid email address' : '',
    password: touched.password && form.password.length < 8 ? 'Password must be at least 8 characters' : '',
    confirmPassword: touched.confirmPassword && form.confirmPassword !== form.password ? 'Passwords do not match' : '',
    country: touched.country && !form.country ? 'Please select your country' : '',
    phone: touched.phone && form.phone && !PHONE_RE.test(form.phone) ? 'Enter a valid phone number' : '',
  }

  const strength = getStrength(form.password)
  const isValid = !Object.values(errors).some(Boolean)
    && form.firstName && form.lastName && EMAIL_RE.test(form.email)
    && strength.score >= 3 && form.confirmPassword === form.password
    && form.country && terms && privacy

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ firstName: true, lastName: true, email: true, password: true, confirmPassword: true, country: true, phone: !!form.phone })
    if (!isValid) return
    try {
      window.localStorage.setItem(
        SIGNUP_STORAGE_KEY,
        JSON.stringify({
          fullName: `${form.firstName} ${form.lastName}`.trim(),
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          country: form.country,
          phone: form.phone,
        }),
      )
    } catch {
      // Ignore prototype-only storage failures.
    }
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/auth/verify-email') }, 1400)
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(4,53,77,0.3); }
        select option { background: #fff; color: #04354D; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .signup-left { display: none !important; } }
      `}</style>

      {/* Left decorative panel */}
      <div className="signup-left">
        <LeftDecor />
      </div>

      {/* Right: form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px 64px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>

          {/* Back link */}
          <Link href="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back
          </Link>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.86)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 24px 64px rgba(4,53,77,0.1), 0 48px 96px rgba(4,53,77,0.06)',
            padding: '40px 40px 36px',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 8px' }}>
                Create your Qarevo Account
              </h1>
              <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                Secure access to intelligent healthcare built around you.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Email */}
                <Field
                  label="Email Address"
                  placeholder="emma@example.com"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  error={errors.email}
                  success={EMAIL_RE.test(form.email)}
                  icon={ICONS.ema}
                  autoComplete="email"
                  onBlur={() => touch('email')}
                />

                {/* Password + strength */}
                <div onBlur={() => touch('password')}>
                  <PasswordField
                    label="Password"
                    value={form.password}
                    onChange={set('password')}
                    error={errors.password}
                    showStrength
                  />
                </div>

                {/* Confirm password */}
                <div onBlur={() => touch('confirmPassword')}>
                  <PasswordField
                    label="Confirm Password"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    error={errors.confirmPassword}
                    confirm={form.password}
                  />
                </div>

                {/* Agreements */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: `1px solid ${submitted && !terms ? 'rgba(220,38,38,0.3)' : T.borderFaint}` }}>
                  <Checkbox checked={terms} onChange={() => setTerms(t => !t)} error={submitted && !terms}>
                    I agree to the{' '}
                    <Link href="/terms" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>Terms of Service</Link>
                  </Checkbox>
                  <Checkbox checked={privacy} onChange={() => setPrivacy(p => !p)} error={submitted && !privacy}>
                    I agree to the{' '}
                    <Link href="/privacy" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>
                    {' '}and data processing under GDPR
                  </Checkbox>
                  <Checkbox checked={marketing} onChange={() => setMarketing(m => !m)} error={submitted && !marketing}>
                    I agree to receive marketing communications from Qarevo Health
                  </Checkbox>
                </div>

                {/* Submit */}
                <SubmitButton loading={loading} disabled={false} onClick={logConsole} />

                {/* Sign-in link */}
                <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, margin: '4px 0 0', letterSpacing: '-0.01em' }}>
                  Already have an account?{' '}
                  <Link href="/auth/sign-in" style={{ color: T.blue, fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                </p>
              </div>
            </form>


            {/* Trust row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)', flexWrap: 'wrap' }}>
              {[
                { icon: ICONS.lock, label: 'HIPAA Ready' },
                { icon: ICONS.shield, label: 'GDPR Compliant' },
                { icon: ICONS.check, label: 'ISO 27001' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Ico p={icon} size={12} sw={1.75} color={T.slate2} />
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Country select ────────────────────────────────────────────────────────────

function CountrySelect({ value, onChange, error, onBlur }: { value: string; onChange: (v: string) => void; error?: string; onBlur?: () => void }) {
  const [focused, setFocused] = useState(false)
  const id = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Country</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: focused ? T.blue : T.slate2, pointerEvents: 'none', display: 'flex' }}>
          <Ico p={ICONS.search} size={14} sw={1.75} />
        </span>
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.() }}
          style={{
            width: '100%', padding: '11px 36px 11px 38px', borderRadius: '11px',
            border: `1.5px solid ${error ? 'rgba(220,38,38,0.55)' : value ? 'rgba(9,173,112,0.5)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'}`,
            background: error ? '#FFF5F5' : value ? '#F0FDF8' : focused ? '#fff' : 'rgba(255,255,255,0.7)',
            color: value ? T.navy : 'rgba(4,53,77,0.3)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(32,181,223,0.09)' : 'none',
            transition: 'all 0.15s ease', appearance: 'none', cursor: 'pointer',
          }}
        >
          <option value="" disabled>Select your country</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.slate2 }}>
          {value
            ? <Ico p={ICONS.check} size={13} sw={2.5} color={T.green} />
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      </div>
      {error && <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{error}</p>}
    </div>
  )
}

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton({ loading, disabled, onClick }: { loading: boolean; disabled: boolean; onClick?: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
        background: loading || disabled
          ? 'rgba(32,181,223,0.5)'
          : h ? 'linear-gradient(135deg,#348CEA 0%,#0F47B8 100%)'
            : `linear-gradient(135deg,${T.blue} 0%,#348CEA 100%)`,
        color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
        letterSpacing: '-0.02em', cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'all 0.15s ease',
        boxShadow: loading || disabled ? 'none' : h
          ? '0 8px 24px rgba(32,181,223,0.42)'
          : '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
        transform: h && !disabled && !loading ? 'translateY(-1px)' : 'none',
      }}
    >
      {loading
        ? <><span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Creating account…</>
        : <>Create Account <Ico p={ICONS.arrowFwd} size={15} sw={2.2} /></>}
    </button>
  )
}


function logConsole () {
  console.log(`console logged`)
}
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

const STORAGE_KEY = 'qarevo.onboarding.contact-information.v1'
const SIGNUP_STORAGE_KEY = 'qarevo.auth.signup.v1'
const PERSONAL_INFO_STORAGE_KEY = 'qarevo.onboarding.personal-information.v1'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContactMethod = 'Phone Call' | 'SMS' | 'Email' | 'WhatsApp' | ''
type Relationship = 'Parent' | 'Spouse' | 'Sibling' | 'Guardian' | 'Friend' | 'Other' | ''

interface ContactForm {
  primaryPhone: string
  alternativePhone: string
  email: string
  country: string
  state: string
  city: string
  address: string
  postalCode: string
  preferredContactMethod: ContactMethod
  emergencyName: string
  emergencyRelationship: Relationship
  emergencyPhone: string
  emergencyAltPhone: string
  emergencyEmail: string
}

const INITIAL_FORM: ContactForm = {
  primaryPhone: '',
  alternativePhone: '',
  email: '',
  country: '',
  state: '',
  city: '',
  address: '',
  postalCode: '',
  preferredContactMethod: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  emergencyAltPhone: '',
  emergencyEmail: '',
}

const COUNTRY_CODES: Record<string, string> = {
  Nigeria: '+234',
  Ghana: '+233',
  Kenya: '+254',
  'South Africa': '+27',
  'United Kingdom': '+44',
  'United States': '+1',
  Canada: '+1',
  France: '+33',
  Germany: '+49',
  India: '+91',
}

const COUNTRY_OPTIONS = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'Canada', 'France', 'Germany', 'India', 'Other']

const STATE_OPTIONS: Record<string, string[]> = {
  Nigeria: ['Lagos', 'Abuja FCT', 'Oyo', 'Rivers', 'Kano'],
  Ghana: ['Greater Accra', 'Ashanti', 'Western', 'Northern'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'United States': ['California', 'Texas', 'New York', 'Florida'],
  Canada: ['Ontario', 'British Columbia', 'Quebec', 'Alberta'],
  France: ['Ile-de-France', 'Provence-Alpes-Cote d’Azur', 'Occitanie'],
  Germany: ['Berlin', 'Bavaria', 'Hamburg', 'Hesse'],
  India: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu'],
  Other: [],
}

function formatPhone(input: string, country: string) {
  const prefix = COUNTRY_CODES[country] || ''
  const digits = input.replace(/[^\d+]/g, '')

  if (!digits) return prefix ? `${prefix} ` : ''
  if (digits.startsWith('+')) return digits
  if (prefix && !digits.startsWith(prefix.replace('+', ''))) return `${prefix} ${digits}`
  return digits
}

function JourneyVisual() {
  return (
    <div style={{ position: 'relative', width: '252px', height: '252px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 30, 58].map((inset, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${0.06 + i * 0.04})`,
            animation: `ringFloat 5s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '84px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.33) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)',
          border: '1px solid rgba(52,140,234,0.26)',
          boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ProfileSetupMark priority />
      </div>

      {[
        { angle: 0, icon: ICONS.activity, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.user, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.shield, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.lock, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
      ].map(({ angle, icon, bg, border }, i) => {
        const r = 98
        const rad = (angle - 90) * Math.PI / 180
        const x = 126 + r * Math.cos(rad)
        const y = 126 + r * Math.sin(rad)
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
              animation: `nodeFloat 4.6s ease-in-out ${i * 0.25}s infinite`,
            }}
          >
            <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
          </div>
        )
      })}
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
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ProfileSetupLogo priority />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <JourneyVisual />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Care stays within reach.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>We’ll know how to support you.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Your contact details and emergency information help us communicate clearly and respond quickly when it matters most.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.ema, label: 'Reliable Communication', sub: 'Stay informed with timely health updates' },
          { icon: ICONS.user, label: 'Emergency Preparedness', sub: 'Support contacts available when needed' },
          { icon: ICONS.shield, label: 'Private and Secure', sub: 'Protected communication across your care journey' },
        ].map(({ icon, label, sub }) => (
          <div key={label} style={{ display: 'flex', gap: '13px', alignItems: 'flex-start', padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
              <Ico p={icon} size={14} sw={1.5} color='rgba(147,197,253,0.9)' />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '-0.015em', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>{body}</p>
    </div>
  )
}

export default function ContactInformationPage() {
  const router = useRouter()
  const [form, setForm] = useState<ContactForm>(INITIAL_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedTick, setSavedTick] = useState(false)
  const [saveMessage, setSaveMessage] = useState('Progress autosaves as you type')
  const [submitting, setSubmitting] = useState(false)
  const [continueHover, setContinueHover] = useState(false)
  const [showOptionalPhones, setShowOptionalPhones] = useState(false)
  const [showOptionalEmergency, setShowOptionalEmergency] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      const signupRaw = window.localStorage.getItem(SIGNUP_STORAGE_KEY)
      const personalRaw = window.localStorage.getItem(PERSONAL_INFO_STORAGE_KEY)

      if (stored) {
        setForm({ ...INITIAL_FORM, ...JSON.parse(stored) })
        return
      }

      const signup = signupRaw ? (JSON.parse(signupRaw) as { email?: string; country?: string; phone?: string }) : null
      const personal = personalRaw ? (JSON.parse(personalRaw) as { fullName?: string }) : null

      setForm((prev) => ({
        ...prev,
        email: signup?.email || '',
        country: signup?.country || '',
        primaryPhone: signup?.phone || '',
        emergencyName: personal?.fullName || '',
      }))
    } catch {
      // Ignore storage parse issues in prototype mode.
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
        setSavedTick(true)
        setSaveMessage('Changes Saved')
        window.setTimeout(() => {
          setSavedTick(false)
          setSaveMessage('Progress autosaves as you type')
        }, 1400)
      } catch {
        setSaveMessage('Could not autosave right now')
      }
    }, 320)

    return () => window.clearTimeout(id)
  }, [form])

  const helpText = useMemo(
    () =>
      "If you're unable to communicate during a medical situation, we'll know who to contact quickly and securely.",
    [],
  )

  const stateOptions = STATE_OPTIONS[form.country] ?? []

  const updateField = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validatePhone = (value: string, required: boolean) => {
    if (!value.trim()) return required ? 'This field is required' : ''
    const digits = value.replace(/[^\d]/g, '')
    return digits.length < 7 ? 'Enter a valid phone number' : ''
  }

  const collectErrors = (value: ContactForm) => {
    const nextErrors: Record<string, string> = {}

    if (!value.primaryPhone.trim()) nextErrors.primaryPhone = 'Primary phone number is required'
    else if (validatePhone(value.primaryPhone, true)) nextErrors.primaryPhone = validatePhone(value.primaryPhone, true)

    if (value.alternativePhone && validatePhone(value.alternativePhone, false)) nextErrors.alternativePhone = 'Enter a valid alternative phone number'
    if (!EMAIL_RE.test(value.email)) nextErrors.email = 'Enter a valid email address'
    if (!value.country.trim()) nextErrors.country = 'Please select your country'
    if (!value.state.trim()) nextErrors.state = 'Please select your state or province'
    if (!value.city.trim()) nextErrors.city = 'City is required'
    if (!value.address.trim()) nextErrors.address = 'Residential address is required'
    if (!value.preferredContactMethod) nextErrors.preferredContactMethod = 'Please choose a preferred contact method'

    if (!value.emergencyName.trim()) nextErrors.emergencyName = 'Emergency contact name is required'
    if (!value.emergencyRelationship) nextErrors.emergencyRelationship = 'Please select a relationship'
    if (!value.emergencyPhone.trim()) nextErrors.emergencyPhone = 'Emergency contact phone number is required'
    else if (validatePhone(value.emergencyPhone, true)) nextErrors.emergencyPhone = validatePhone(value.emergencyPhone, true)

    if (value.emergencyAltPhone && validatePhone(value.emergencyAltPhone, false)) nextErrors.emergencyAltPhone = 'Enter a valid alternative number'
    if (value.emergencyEmail && !EMAIL_RE.test(value.emergencyEmail)) nextErrors.emergencyEmail = 'Enter a valid emergency contact email'

    return nextErrors
  }

  const validate = () => {
    const nextErrors = collectErrors(form)
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const fieldBorder = (name: keyof ContactForm) => {
    if (errors[name] && touched[name]) return '1.5px solid rgba(220,38,38,0.5)'
    if (touched[name] && !errors[name] && String(form[name]).trim()) return '1.5px solid rgba(9,173,112,0.45)'
    return '1.5px solid rgba(4,53,77,0.1)'
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({
      primaryPhone: true,
      alternativePhone: true,
      email: true,
      country: true,
      state: true,
      city: true,
      address: true,
      postalCode: true,
      preferredContactMethod: true,
      emergencyName: true,
      emergencyRelationship: true,
      emergencyPhone: true,
      emergencyAltPhone: true,
      emergencyEmail: true,
    })
    if (!validate()) return
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setOnboardingStage('health-profile')
      router.push('/auth/profile-setup/medical-history-allergies')
    }, 900)
  }

  const canContinue = !submitting && Object.keys(collectErrors(form)).length === 0

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(4,53,77,0.3); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes nodeFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (max-width: 900px) {
          .ci-left { display: none !important; }
          .ci-wrap { padding: 24px 16px !important; }
          .ci-card { padding: 28px 22px 24px !important; border-radius: 20px !important; }
          .ci-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className='ci-left'>
        <LeftPanel />
      </div>

      <div className='ci-wrap' style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '760px' }}>
          <form
            className='ci-card'
            onSubmit={onSubmit}
            noValidate
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(34px) saturate(200%)',
              WebkitBackdropFilter: 'blur(34px) saturate(200%)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.92)',
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)',
              padding: '36px 32px',
              animation: 'fadeUp 0.3s ease',
            }}
          >
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Profile Setup</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Step 3 of 6</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>50% Complete</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Approximately 2 Minutes</p>
              </div>
            </div>

            <header style={{ marginBottom: '16px' }}>
              <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2 }}>
                Stay Connected
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>
                Help us reach you when needed and let us know who we should contact in case of an emergency.
              </p>
            </header>

            <div style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '100px', background: savedTick ? T.greenLight : 'rgba(4,53,77,0.03)', border: `1px solid ${savedTick ? 'rgba(9,173,112,0.25)' : 'rgba(4,53,77,0.08)'}` }}>
              <Ico p={savedTick ? ICONS.check : ICONS.activity} size={11} sw={2} color={savedTick ? T.green : T.slate2} />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: savedTick ? T.teal : T.slate2, letterSpacing: '-0.005em' }}>{saveMessage}</span>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <SectionHeader title='Contact Information' body='Your preferred contact details help us coordinate care updates, reminders, and healthcare communication.' />

              <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='primaryPhone' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Primary Phone Number</label>
                  <input id='primaryPhone' value={form.primaryPhone} autoComplete='tel' onChange={(e) => updateField('primaryPhone', formatPhone(e.target.value, form.country))} onBlur={() => setTouched((prev) => ({ ...prev, primaryPhone: true }))} placeholder={form.country && COUNTRY_CODES[form.country] ? `${COUNTRY_CODES[form.country]} 801 234 5678` : '+234 801 234 5678'} style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('primaryPhone'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  {touched.primaryPhone && errors.primaryPhone ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.primaryPhone}</p> : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='email' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Email Address</label>
                  <input id='email' type='email' value={form.email} autoComplete='email' onChange={(e) => updateField('email', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, email: true }))} placeholder='you@example.com' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('email'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  {touched.email && errors.email ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.email}</p> : null}
                </div>
              </div>

              <button type='button' onClick={() => setShowOptionalPhones((prev) => !prev)} style={{ marginBottom: showOptionalPhones ? '12px' : '0', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: T.blue, fontSize: '12.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {showOptionalPhones ? 'Hide optional phone fields' : 'Add alternative phone number'}
              </button>

              {showOptionalPhones ? (
                <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor='alternativePhone' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Alternative Phone Number <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span></label>
                    <input id='alternativePhone' value={form.alternativePhone} autoComplete='tel' onChange={(e) => updateField('alternativePhone', formatPhone(e.target.value, form.country))} onBlur={() => setTouched((prev) => ({ ...prev, alternativePhone: true }))} placeholder='Alternative number' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('alternativePhone'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                    {touched.alternativePhone && errors.alternativePhone ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.alternativePhone}</p> : null}
                  </div>
                </div>
              ) : null}

              <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='country' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Country</label>
                  <input id='country' list='countries' value={form.country} autoComplete='country-name' onChange={(e) => updateField('country', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, country: true }))} placeholder='Start typing to search' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('country'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  <datalist id='countries'>{COUNTRY_OPTIONS.map((item) => <option key={item} value={item} />)}</datalist>
                  {touched.country && errors.country ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.country}</p> : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='state' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>State / Province</label>
                  <input id='state' list='states' value={form.state} onChange={(e) => updateField('state', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, state: true }))} placeholder='Select state or province' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('state'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  <datalist id='states'>{stateOptions.map((item) => <option key={item} value={item} />)}</datalist>
                  {touched.state && errors.state ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.state}</p> : null}
                </div>
              </div>

              <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='city' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>City</label>
                  <input id='city' value={form.city} autoComplete='address-level2' onChange={(e) => updateField('city', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, city: true }))} placeholder='City' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('city'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  {touched.city && errors.city ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.city}</p> : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='postalCode' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Postal Code <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span></label>
                  <input id='postalCode' value={form.postalCode} autoComplete='postal-code' onChange={(e) => updateField('postalCode', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, postalCode: true }))} placeholder='Postal code' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('postalCode'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <label htmlFor='address' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Residential Address</label>
                <textarea id='address' value={form.address} autoComplete='street-address' onChange={(e) => updateField('address', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, address: true }))} placeholder='Street address, area, and relevant location details' rows={3} style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('address'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                {touched.address && errors.address ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.address}</p> : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Preferred Contact Method</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['Phone Call', 'SMS', 'Email', 'WhatsApp'] as const).map((option) => {
                    const active = form.preferredContactMethod === option
                    return (
                      <button
                        key={option}
                        type='button'
                        onClick={() => updateField('preferredContactMethod', option)}
                        onBlur={() => setTouched((prev) => ({ ...prev, preferredContactMethod: true }))}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '100px',
                          border: active ? `1px solid ${T.blueMid}` : '1px solid rgba(4,53,77,0.08)',
                          background: active ? T.blueLight : 'rgba(255,255,255,0.78)',
                          color: active ? T.blue : T.slate,
                          fontSize: '12.5px',
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          cursor: 'pointer',
                        }}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
                {touched.preferredContactMethod && errors.preferredContactMethod ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.preferredContactMethod}</p> : null}
              </div>
            </div>

            <div style={{ marginBottom: '18px', paddingTop: '4px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <SectionHeader title='Emergency Contact' body='Let us know who we should reach in case of an urgent medical situation.' />

              <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='emergencyName' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Emergency Contact Name</label>
                  <input id='emergencyName' value={form.emergencyName} autoComplete='name' onChange={(e) => updateField('emergencyName', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, emergencyName: true }))} placeholder='Full name' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('emergencyName'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  {touched.emergencyName && errors.emergencyName ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.emergencyName}</p> : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='relationship' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Relationship</label>
                  <select id='relationship' value={form.emergencyRelationship} onChange={(e) => updateField('emergencyRelationship', e.target.value as Relationship)} onBlur={() => setTouched((prev) => ({ ...prev, emergencyRelationship: true }))} style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('emergencyRelationship'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}>
                    <option value=''>Select</option>
                    <option value='Parent'>Parent</option>
                    <option value='Spouse'>Spouse</option>
                    <option value='Sibling'>Sibling</option>
                    <option value='Guardian'>Guardian</option>
                    <option value='Friend'>Friend</option>
                    <option value='Other'>Other</option>
                  </select>
                  {touched.emergencyRelationship && errors.emergencyRelationship ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.emergencyRelationship}</p> : null}
                </div>
              </div>

              <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor='emergencyPhone' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Emergency Contact Phone Number</label>
                  <input id='emergencyPhone' value={form.emergencyPhone} autoComplete='tel' onChange={(e) => updateField('emergencyPhone', formatPhone(e.target.value, form.country))} onBlur={() => setTouched((prev) => ({ ...prev, emergencyPhone: true }))} placeholder='Primary emergency number' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('emergencyPhone'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                  {touched.emergencyPhone && errors.emergencyPhone ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.emergencyPhone}</p> : null}
                </div>
              </div>

              <button type='button' onClick={() => setShowOptionalEmergency((prev) => !prev)} style={{ marginBottom: showOptionalEmergency ? '12px' : '0', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: T.blue, fontSize: '12.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {showOptionalEmergency ? 'Hide optional emergency fields' : 'Add optional emergency contact details'}
              </button>

              {showOptionalEmergency ? (
                <div className='ci-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor='emergencyAltPhone' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Alternative Number <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span></label>
                    <input id='emergencyAltPhone' value={form.emergencyAltPhone} autoComplete='tel' onChange={(e) => updateField('emergencyAltPhone', formatPhone(e.target.value, form.country))} onBlur={() => setTouched((prev) => ({ ...prev, emergencyAltPhone: true }))} placeholder='Alternative emergency number' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('emergencyAltPhone'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                    {touched.emergencyAltPhone && errors.emergencyAltPhone ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.emergencyAltPhone}</p> : null}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor='emergencyEmail' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Emergency Contact Email <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span></label>
                    <input id='emergencyEmail' type='email' value={form.emergencyEmail} autoComplete='email' onChange={(e) => updateField('emergencyEmail', e.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, emergencyEmail: true }))} placeholder='email@example.com' style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('emergencyEmail'), background: 'rgba(255,255,255,0.78)', color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }} />
                    {touched.emergencyEmail && errors.emergencyEmail ? <p style={{ margin: 0, fontSize: '12px', color: T.red }}>{errors.emergencyEmail}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ marginBottom: '16px', padding: '12px 13px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.info} size={13} sw={1.75} color={T.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Why do we ask for an emergency contact?</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2, lineHeight: 1.55, letterSpacing: '-0.005em' }}>{helpText}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type='submit'
                disabled={!canContinue}
                onMouseEnter={() => setContinueHover(true)}
                onMouseLeave={() => setContinueHover(false)}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: canContinue ? continueHover ? 'linear-gradient(135deg,#348CEA 0%,#0F47B8 100%)' : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(32,181,223,0.5)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  cursor: canContinue ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: canContinue ? '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)' : 'none',
                  transition: 'all 0.15s ease',
                  transform: canContinue && continueHover ? 'translateY(-1px)' : 'none',
                  opacity: submitting ? 0.92 : 1,
                }}
              >
                <span>{submitting ? 'Saving and continuing...' : 'Continue'}</span>
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </button>

              <Link href='/auth/profile-setup/personal-information' style={{ textAlign: 'center', color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'
import { getApiErrorDetail, getPatientSettings, updateProfile } from '@/lib/api'
import { hydrateAccountDraft } from '@/lib/hydrate-account-draft'
import { ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { createAccountDraftStorage } from '@/lib/account-storage'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.brandNavy,
].join(', ')

const STORAGE_KEY = 'qarevo.onboarding.personal-information.v1'

type Gender = 'Male' | 'Female' | 'Prefer Not to Say' | ''
type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Prefer Not to Say' | ''

interface PersonalInfoForm {
  fullName: string
  preferredName: string
  dateOfBirth: string
  gender: Gender
  nationality: string
  preferredLanguage: string
  maritalStatus: MaritalStatus
  photoDataUrl: string
}

const INITIAL_FORM: PersonalInfoForm = {
  fullName: '',
  preferredName: '',
  dateOfBirth: '',
  gender: '',
  nationality: '',
  preferredLanguage: '',
  maritalStatus: '',
  photoDataUrl: '',
}

const NATIONALITIES = [
  'Nigerian',
  'Ghanaian',
  'Kenyan',
  'South African',
  'British',
  'American',
  'Canadian',
  'French',
  'German',
  'Italian',
  'Spanish',
  'Indian',
  'Pakistani',
  'Chinese',
  'Japanese',
  'Brazilian',
  'Other',
]

const LANGUAGES = ['German', 'English']

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
        { angle: 0, icon: ICONS.steth, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.brain, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.activity, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.shield, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
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
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ProfileSetupLogo priority />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <JourneyVisual />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
              fontSize: '24px',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.035em',
              lineHeight: 1.18,
              margin: '0 0 10px',
            }}
          >
            Your profile shapes your care.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Just a few details to get started.</span>
          </h2>
          <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            The information you share helps us personalize recommendations, match you to trusted physicians, and improve each consultation.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.user, label: 'Personalized Onboarding', sub: 'Guided, lightweight, and secure' },
          { icon: ICONS.steth, label: 'Better Physician Matching', sub: 'Profile insights improve recommendations' },
          { icon: ICONS.shield, label: 'Protected Information', sub: 'Enterprise-grade security and encryption' },
        ].map(({ icon, label, sub }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              gap: '13px',
              alignItems: 'flex-start',
              padding: '13px 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '-0.015em', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function isPastDate(dateValue: string) {
  if (!dateValue) return false
  const selected = new Date(dateValue)
  const now = new Date()
  if (Number.isNaN(selected.getTime())) return false
  return selected <= now
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const firstName = parts.shift() || ''
  const lastName = parts.join(' ')
  return { firstName, lastName }
}

export default function PersonalInformationPage() {
  const router = useRouter()
  const [draftStorage] = useState(createAccountDraftStorage)
  const [draftReady, setDraftReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedTick, setSavedTick] = useState(false)
  const [continueHover, setContinueHover] = useState(false)
  const [saveMessage, setSaveMessage] = useState('Draft autosaves in this tab')
  const [submitError, setSubmitError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<PersonalInfoForm>(INITIAL_FORM)

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => hydrateAccountDraft<PersonalInfoForm>(draftStorage, STORAGE_KEY, async () => {
    const saved = await getPatientSettings()
    return {
      fullName: [saved.first_name, saved.last_name].filter(Boolean).join(' '),
      preferredName: saved.preferred_name || '', dateOfBirth: saved.date_of_birth || '',
      gender: (saved.gender || '') as Gender, nationality: saved.nationality || '',
      preferredLanguage: saved.language || '', maritalStatus: (saved.marital_status || '') as MaritalStatus,
    }
  }, data => setForm({ ...INITIAL_FORM, ...data, photoDataUrl: '' }),
  error => setSubmitError(getApiErrorDetail(error) || 'Could not load your saved profile. Reload to try again.'),
  () => setDraftReady(true)), [draftStorage])

  useEffect(() => {
    if (!draftReady) return
    const id = window.setTimeout(() => {
      try {
        draftStorage.setItem(STORAGE_KEY, JSON.stringify(form))
        setSavedTick(true)
        setSaveMessage('Draft saved in this tab')
        window.setTimeout(() => {
          setSavedTick(false)
          setSaveMessage('Draft autosaves in this tab')
        }, 1400)
      } catch {
        setSaveMessage('Could not autosave right now')
      }
    }, 320)

    return () => window.clearTimeout(id)
  }, [form, draftStorage, draftReady])

  const canContinue = draftReady && !submitting

  const helperText = useMemo(
    () =>
      'We use your personal information to personalize your healthcare experience, improve physician matching, and ensure accurate medical records.',
    [],
  )

  const updateField = <K extends keyof PersonalInfoForm>(key: K, value: PersonalInfoForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors(collectErrors({ ...form, [key]: value }))
  }

  const collectErrors = (form: PersonalInfoForm) => {
    const nextErrors: Record<string, string> = {}

    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Please enter your full name'
    if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Date of birth is required'
    else if (!isPastDate(form.dateOfBirth)) nextErrors.dateOfBirth = 'Please provide a valid past date'

    if (!form.gender) nextErrors.gender = 'Please select a gender option'
    if (!form.nationality.trim()) nextErrors.nationality = 'Please select your nationality'
    if (!form.preferredLanguage.trim()) nextErrors.preferredLanguage = 'Please select your preferred language'
    if (!form.maritalStatus) nextErrors.maritalStatus = 'Please select your marital status'

    return nextErrors
  }

  const validate = () => {
    const nextErrors = collectErrors(form)
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const markTouched = (key: keyof PersonalInfoForm) => {
    setTouched(previous => ({ ...previous, [key]: true }))
    setErrors(collectErrors(form))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setTouched({
      fullName: true,
      preferredName: true,
      dateOfBirth: true,
      gender: true,
      nationality: true,
      preferredLanguage: true,
      maritalStatus: true,
    })

    if (!validate()) { focusValidation(e.currentTarget); return }

    setSubmitting(true)
    try {
      const { firstName, lastName } = splitFullName(form.fullName)
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: form.dateOfBirth,
        gender: form.gender || undefined,
        preferred_name: form.preferredName.trim() || null,
        nationality: form.nationality,
        marital_status: form.maritalStatus || undefined,
        language: form.preferredLanguage as 'German' | 'English',
      })
      setSubmitting(false)
      draftStorage.removeItem(STORAGE_KEY)
      setOnboardingStage('contact-information')
      router.push('/auth/profile-setup/contact-information')
    } catch (error) {
      setSubmitError(getApiErrorDetail(error) || 'We could not save your personal information. Please try again.')
      setSubmitting(false)
    }
  }

  const fieldBorder = (name: keyof PersonalInfoForm) => {
    if (errors[name] && touched[name]) return '1.5px solid rgba(220,38,38,0.5)'
    if (touched[name] && !errors[name] && String(form[name]).trim()) return '1.5px solid rgba(9,173,112,0.45)'
    return '1.5px solid rgba(4,53,77,0.1)'
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: var(--text-muted); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes nodeFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (max-width: 900px) {
          .pi-left { display: none !important; }
          .pi-wrap { padding: 24px 16px !important; }
          .pi-card { padding: 28px 22px 24px !important; border-radius: 20px !important; }
          .pi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className='pi-left'>
        <LeftPanel />
      </div>

      <div className='pi-wrap' style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '720px' }}>
          <form
            className='pi-card'
            onSubmit={onSubmit}
            noValidate
            style={{
              background: "var(--surface-glass)",
              backdropFilter: 'blur(34px) saturate(200%)',
              WebkitBackdropFilter: 'blur(34px) saturate(200%)',
              borderRadius: '24px',
              border: "1px solid var(--border)",
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)',
              padding: '36px 32px',
              animation: 'fadeUp 0.3s ease',
            }}
          >
            <fieldset disabled={!draftReady || submitting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '16px',
              }}
            >
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Profile Setup</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Step 2 of 6</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>33% Complete</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Approximately 3 Minutes</p>
              </div>
            </div>

            <header style={{ marginBottom: '16px' }}>
              <h1
                style={{
                  margin: '0 0 8px',
                  fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                  fontSize: '24px',
                  fontWeight: 800,
                  color: T.navy,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.2,
                }}
              >
                Tell Us About Yourself
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>
                Let&apos;s begin with some basic personal information so we can personalize your healthcare experience.
              </p>
            </header>

            <div style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '100px', background: savedTick ? T.greenLight : "var(--surface-hover)", border: `1px solid ${savedTick ? 'rgba(9,173,112,0.25)' : "var(--border)"}` }}>
              <Ico p={savedTick ? ICONS.check : ICONS.activity} size={11} sw={2} color={savedTick ? T.green : T.slate2} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: savedTick ? T.teal : T.slate2, letterSpacing: '-0.005em' }}>{saveMessage}</span>
            </div>

            <ValidationSummary errors={Object.fromEntries(Object.entries(errors).filter(([key]) => touched[key]))} />
            {submitError ? (
              <div role='alert' style={{ padding: '11px 13px', borderRadius: '12px', background: 'rgba(254,242,242,0.88)', border: '1px solid rgba(220,38,38,0.22)', color: T.red, fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                {submitError}
              </div>
            ) : null}

            <div className='pi-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='fullName' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Full Name (Required)</label>
                <input
                  id='fullName' required aria-required='true'
                  value={form.fullName}
                  autoComplete='name'
                  onChange={(e) => updateField('fullName', e.target.value)}
                  onBlur={() => markTouched('fullName')}
                  placeholder='Emma Harrison'
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('fullName'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                />
                {touched.fullName && errors.fullName ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.fullName}</p> : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='preferredName' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Preferred Name <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span></label>
                <input
                  id='preferredName'
                  value={form.preferredName}
                  autoComplete='nickname'
                  onChange={(e) => updateField('preferredName', e.target.value)}
                  onBlur={() => markTouched('preferredName')}
                  placeholder='What should we call you?'
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('preferredName'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            </div>

            <div className='pi-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='dob' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Date of Birth (Required)</label>
                <input
                  id='dob' required aria-required='true'
                  type='date'
                  value={form.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  onBlur={() => markTouched('dateOfBirth')}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('dateOfBirth'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                />
                {touched.dateOfBirth && errors.dateOfBirth ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.dateOfBirth}</p> : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='gender' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Gender (Required)</label>
                <select
                  id='gender' required aria-required='true'
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value as Gender)}
                  onBlur={() => markTouched('gender')}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('gender'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value=''>Select</option>
                  <option value='Male'>Male</option>
                  <option value='Female'>Female</option>
                  <option value='Prefer Not to Say'>Prefer Not to Say</option>
                </select>
                {touched.gender && errors.gender ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.gender}</p> : null}
              </div>
            </div>

            <div className='pi-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='nationality' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Nationality (Required)</label>
                <select
                  id='nationality' required aria-required='true'
                  value={form.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  onBlur={() => markTouched('nationality')}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('nationality'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value=''>Select</option>
                  {NATIONALITIES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                {touched.nationality && errors.nationality ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.nationality}</p> : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor='language' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Preferred Language (Required)</label>
                <select
                  id='language' required aria-required='true'
                  value={form.preferredLanguage}
                  onChange={(e) => updateField('preferredLanguage', e.target.value)}
                  onBlur={() => markTouched('preferredLanguage')}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('preferredLanguage'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value=''>Select</option>
                  {LANGUAGES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                {touched.preferredLanguage && errors.preferredLanguage ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.preferredLanguage}</p> : null}
              </div>
            </div>

            <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor='maritalStatus' style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>Marital Status (Required)</label>
              <select
                id='maritalStatus' required aria-required='true'
                value={form.maritalStatus}
                onChange={(e) => updateField('maritalStatus', e.target.value as MaritalStatus)}
                onBlur={() => markTouched('maritalStatus')}
                style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: fieldBorder('maritalStatus'), background: "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
              >
                <option value=''>Select</option>
                <option value='Single'>Single</option>
                <option value='Married'>Married</option>
                <option value='Divorced'>Divorced</option>
                <option value='Widowed'>Widowed</option>
                <option value='Prefer Not to Say'>Prefer Not to Say</option>
              </select>
              {touched.maritalStatus && errors.maritalStatus ? <p style={{ margin: 0, fontSize: "13px", color: T.red }}>{errors.maritalStatus}</p> : null}
            </div>

            <div
              style={{
                marginBottom: '16px',
                padding: '12px 13px',
                borderRadius: '12px',
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.info} size={13} sw={1.75} color={T.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Why do we need this information?</p>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate2, lineHeight: 1.55, letterSpacing: '-0.005em' }}>{helperText}</p>
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
                  background: canContinue
                    ? continueHover
                      ? 'linear-gradient(135deg,var(--primary-end) 0%,#0F47B8 100%)'
                      : `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`
                    : 'rgba(32,181,223,0.5)',
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

              <Link
                href='/auth/profile-setup'
                style={{
                  textAlign: 'center',
                  color: T.slate2,
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                Back
              </Link>
            </div>
          </fieldset></form>
        </div>
      </div>
    </main>
  )
}

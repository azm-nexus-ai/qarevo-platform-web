'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PAGE_BG, T } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'
import { ApiError, createInsurance, getApiErrorDetail, updateInsurance } from '@/lib/api'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

const STORAGE_KEY = 'qarevo.onboarding.insurance-privacy-consent.v1'
const BACK_ROUTE = '/auth/profile-setup/medical-history-allergies'
const NEXT_ROUTE = '/auth/profile-setup/profile-completed'
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'application/pdf']

type InsuranceStatus = 'yes' | 'no' | ''
type ConsentKey = 'terms' | 'privacy' | 'health' | 'telemedicine' | 'marketing'

type UploadedFileMeta = {
  name: string
  size: number
  type: string
}

type InsuranceForm = {
  insuranceStatus: InsuranceStatus
  provider: string
  policyNumber: string
  memberId: string
  groupNumber: string
  insuranceFront: UploadedFileMeta | null
  insuranceBack: UploadedFileMeta | null
  consents: Record<ConsentKey, boolean>
}

type InsuranceErrors = Partial<Record<'insuranceStatus' | 'provider' | 'policyNumber' | 'memberId' | 'insuranceFront' | 'insuranceBack' | 'consents', string>>

const INITIAL_FORM: InsuranceForm = {
  insuranceStatus: '',
  provider: '',
  policyNumber: '',
  memberId: '',
  groupNumber: '',
  insuranceFront: null,
  insuranceBack: null,
  consents: {
    terms: false,
    privacy: false,
    health: false,
    telemedicine: false,
    marketing: false,
  },
}

const CONSENT_COPY: Array<{
  key: ConsentKey
  label: string
  required: boolean
  learnMore: string
  details: string
}> = [
  {
    key: 'terms',
    label: 'I agree to the Terms & Conditions.',
    required: true,
    learnMore: 'Learn More',
    details: 'These terms explain how Qarevo Health works, how the service is delivered, and the responsibilities that help keep care secure and reliable.',
  },
  {
    key: 'privacy',
    label: 'I acknowledge the Privacy Policy.',
    required: true,
    learnMore: 'Learn More',
    details: 'Our privacy policy explains how your personal and health information is collected, stored, and protected within the platform.',
  },
  {
    key: 'health',
    label: 'I consent to the secure processing of my health information for the purpose of delivering healthcare services.',
    required: true,
    learnMore: 'Learn More',
    details: 'Your information is processed only to support care delivery, physician review, documentation, and related healthcare operations.',
  },
  {
    key: 'telemedicine',
    label: 'I understand that telemedicine consultations may have limitations compared to in-person medical examinations.',
    required: true,
    learnMore: 'Learn More',
    details: 'Virtual consultations are convenient, but some assessments may still require an in-person visit, tests, or follow-up care.',
  },
  {
    key: 'marketing',
    label: 'I would like to receive healthcare reminders, wellness updates, and product announcements.',
    required: false,
    learnMore: 'Learn More',
    details: 'This optional preference helps us send reminders, updates, and product information. You can change this later in your settings.',
  },
]

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  const kilobytes = value / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

function validateFile(file: File | null | undefined) {
  if (!file) return 'Please upload a file.'
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Upload a PNG, JPEG, or PDF file.'
  if (file.size > MAX_UPLOAD_SIZE) return 'File size must be 10MB or less.'
  return ''
}

function parseStoredForm(raw: string | null): InsuranceForm | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<InsuranceForm>
    return {
      ...INITIAL_FORM,
      ...parsed,
      consents: { ...INITIAL_FORM.consents, ...(parsed.consents || {}) },
    }
  } catch {
    return null
  }
}

function validateFileMeta(file: UploadedFileMeta | null) {
  if (!file) return 'Upload required.'
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Upload a PNG, JPEG, or PDF file.'
  if (file.size > MAX_UPLOAD_SIZE) return 'File size must be 10MB or less.'
  return ''
}

function validateForm(form: InsuranceForm): InsuranceErrors {
  const nextErrors: InsuranceErrors = {}

  if (!form.insuranceStatus) {
    nextErrors.insuranceStatus = 'Please choose whether you currently have health insurance.'
  }

  if (form.insuranceStatus === 'yes') {
    if (!form.provider.trim()) nextErrors.provider = 'Insurance provider is required.'
    if (!form.policyNumber.trim()) nextErrors.policyNumber = 'Policy number is required.'
    if (!form.memberId.trim()) nextErrors.memberId = 'Member ID is required.'

    const frontError = validateFileMeta(form.insuranceFront)
    const backError = validateFileMeta(form.insuranceBack)
    if (frontError) nextErrors.insuranceFront = frontError
    if (backError) nextErrors.insuranceBack = backError
  }

  const requiredConsents = ['terms', 'privacy', 'health', 'telemedicine'] as const
  if (requiredConsents.some((key) => !form.consents[key])) {
    nextErrors.consents = 'Please review and accept the required consent items.'
  }

  return nextErrors
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
        padding: '44px',
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
        <div style={{ position: 'relative', width: '268px', height: '268px', margin: '0 auto', flexShrink: 0 }}>
          {[0, 28, 58].map((inset, index) => (
            <div key={index} style={{ position: 'absolute', inset, borderRadius: '50%', border: `1px solid rgba(255,255,255,${0.06 + index * 0.04})`, animation: `floatRing 5s ease-in-out ${index * 0.18}s infinite` }} />
          ))}
          <div style={{ position: 'absolute', inset: '84px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.34) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)', border: '1px solid rgba(52,140,234,0.26)', boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProfileSetupMark priority />
          </div>
          {[
            { angle: 0, icon: ICONS.lock, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
            { angle: 90, icon: ICONS.check, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
            { angle: 180, icon: ICONS.info, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
            { angle: 270, icon: ICONS.user, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
          ].map(({ angle, icon, bg, border }, index) => {
            const radius = 102
            const radians = ((angle - 90) * Math.PI) / 180
            const x = 134 + radius * Math.cos(radians)
            const y = 134 + radius * Math.sin(radians)

            return (
              <div key={angle} style={{ position: 'absolute', left: `${x - 19}px`, top: `${y - 19}px`, width: '38px', height: '38px', borderRadius: '12px', background: bg, border: `1px solid ${border}`, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `floatNode 4.6s ease-in-out ${index * 0.2}s infinite` }}>
                <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Coverage, handled carefully.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Privacy stays in focus.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            We only ask for the information needed to verify coverage, protect your records, and deliver safe digital healthcare.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Secure Storage', sub: 'Information is encrypted and protected' },
          { icon: ICONS.shield, label: 'Trusted Access', sub: 'Only authorized care teams can review it' },
          { icon: ICONS.check, label: 'Coverage Flexibility', sub: 'Add insurance now or later from your profile' },
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

function TextField({ label, value, onChange, placeholder, error, optional }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; error?: string; optional?: boolean }) {
  const id = useId()
  const [focused, setFocused] = useState(false)

  const border = error ? 'rgba(220,38,38,0.55)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'
  const background = error ? '#FFF5F5' : focused ? '#fff' : 'rgba(255,255,255,0.78)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label} {optional ? <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span> : null}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          minHeight: '44px',
          padding: '11px 12px',
          borderRadius: '11px',
          border: `1.5px solid ${border}`,
          background,
          color: T.navy,
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
      />
      {error ? <p style={{ margin: 0, fontSize: '12px', color: T.red, lineHeight: 1.45 }}>{error}</p> : null}
    </div>
  )
}

function ToggleChip({ label, active, onClick, tone = 'default' }: { label: string; active: boolean; onClick: () => void; tone?: 'default' | 'warning' }) {
  const [hovered, setHovered] = useState(false)
  const activeBg = tone === 'warning' ? 'rgba(217,119,6,0.12)' : 'rgba(32,181,223,0.1)'
  const activeBorder = tone === 'warning' ? 'rgba(217,119,6,0.28)' : 'rgba(32,181,223,0.24)'
  const activeColor = tone === 'warning' ? T.amber : T.blue

  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: '38px',
        padding: '8px 12px',
        borderRadius: '999px',
        border: `1px solid ${active ? activeBorder : hovered ? 'rgba(4,53,77,0.13)' : 'rgba(4,53,77,0.08)'}`,
        background: active ? activeBg : hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
        color: active ? activeColor : T.slate,
        fontSize: '12.5px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        boxShadow: active ? '0 2px 10px rgba(32,181,223,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.88)',
      }}
    >
      {label}
    </button>
  )
}

function CheckboxCard({
  checked,
  onChange,
  title,
  required,
  learnMore,
  details,
}: {
  checked: boolean
  onChange: () => void
  title: string
  required?: boolean
  learnMore: string
  details: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: checked ? 'rgba(234,241,255,0.68)' : 'rgba(255,255,255,0.78)',
        border: `1px solid ${checked ? 'rgba(32,181,223,0.18)' : 'rgba(4,53,77,0.06)'}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <button
          type='button'
          role='checkbox'
          aria-checked={checked}
          onClick={onChange}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '7px',
            border: `1.5px solid ${checked ? T.blue : 'rgba(4,53,77,0.18)'}`,
            background: checked ? T.blue : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
            cursor: 'pointer',
            outline: 'none',
            boxShadow: checked ? '0 1px 4px rgba(32,181,223,0.25)' : 'none',
          }}
        >
          {checked ? <Ico p={ICONS.check} size={11} sw={3} color='#fff' /> : null}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: T.navy, lineHeight: 1.45, letterSpacing: '-0.01em' }}>{title}</p>
              {required ? (
                <span style={{ display: 'inline-flex', marginTop: '6px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.08)', color: T.blue, fontSize: '11px', fontWeight: 700 }}>
                  Required
                </span>
              ) : (
                <span style={{ display: 'inline-flex', marginTop: '6px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(9,173,112,0.08)', color: T.green, fontSize: '11px', fontWeight: 700 }}>
                  Optional
                </span>
              )}
            </div>
            <button
              type='button'
              onClick={() => setExpanded((value) => !value)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.blue, fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              {expanded ? 'Hide' : learnMore}
            </button>
          </div>
          {expanded ? (
            <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)' }}>
              <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.005em' }}>{details}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function FileUploadCard({
  label,
  file,
  onFile,
  error,
  inputRef,
}: {
  label: string
  file: UploadedFileMeta | null
  onFile: (file: File | null) => void
  error?: string
  inputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.8)', border: `1px solid ${error ? 'rgba(220,38,38,0.18)' : 'rgba(4,53,77,0.06)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>{label}</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2, lineHeight: 1.5 }}>PNG, JPEG, or PDF. Maximum 10MB.</p>
        </div>
        <button
          type='button'
          onClick={() => inputRef.current?.click()}
          style={{ minHeight: '36px', padding: '8px 12px', borderRadius: '999px', border: '1px solid rgba(32,181,223,0.18)', background: 'rgba(234,241,255,0.78)', color: T.blue, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
        >
          Upload
        </button>
      </div>
      <input ref={inputRef} type='file' accept='.png,.jpg,.jpeg,.pdf' style={{ display: 'none' }} onChange={(event) => onFile(event.target.files?.[0] || null)} />
      <div
        style={{
          minHeight: '92px',
          borderRadius: '14px',
          border: `1px dashed ${error ? 'rgba(220,38,38,0.28)' : 'rgba(32,181,223,0.16)'}`,
          background: error ? 'rgba(255,245,245,0.9)' : 'rgba(234,241,255,0.48)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          textAlign: 'center',
        }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.greenLight, border: '1px solid rgba(9,173,112,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico p={ICONS.check} size={13} sw={2.4} color={T.green} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{file.name}</div>
              <div style={{ fontSize: '12px', color: T.slate2 }}>{formatBytes(file.size)} • {file.type.toUpperCase()}</div>
            </div>
            <button type='button' onClick={() => onFile(null)} style={{ background: 'none', border: 'none', color: T.red, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Remove
            </button>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2, lineHeight: 1.55 }}>
            Upload a clear photo or PDF of the card front or back.
          </p>
        )}
      </div>
      {error ? <p style={{ margin: '10px 0 0', fontSize: '12px', color: T.red, lineHeight: 1.45 }}>{error}</p> : null}
    </div>
  )
}

function SecurityPill({ icon, title }: { icon: string | readonly string[]; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ico p={icon} size={13} sw={1.8} color={T.blue} />
      </div>
      <span style={{ fontSize: '12.5px', fontWeight: 600, color: T.slate, lineHeight: 1.45 }}>{title}</span>
    </div>
  )
}

export default function InsurancePrivacyConsentPage() {
  const router = useRouter()
  const insuranceFrontRef = useRef<HTMLInputElement | null>(null)
  const insuranceBackRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<InsuranceForm>(INITIAL_FORM)
  const [savedTick, setSavedTick] = useState(false)
  const [saveMessage, setSaveMessage] = useState('Progress autosaves as you type')
  const [submitting, setSubmitting] = useState(false)
  const [continueHover, setContinueHover] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<InsuranceErrors>({})

  useEffect(() => {
    try {
      const stored = parseStoredForm(window.localStorage.getItem(STORAGE_KEY))
      if (stored) queueMicrotask(() => setForm(stored))
    } catch {
      // Ignore prototype storage issues.
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
        setSavedTick(true)
        setSaveMessage('Progress Saved')
        window.setTimeout(() => {
          setSavedTick(false)
          setSaveMessage('Progress autosaves as you type')
        }, 1400)
      } catch {
        setSaveMessage('Could not autosave right now')
      }
    }, 320)

    return () => window.clearTimeout(timer)
  }, [form])

  useEffect(() => {
    if (submitted) queueMicrotask(() => setErrors(validateForm(form)))
  }, [form, submitted])

  const validationErrors = useMemo(() => validateForm(form), [form])
  const canContinue = Object.keys(validationErrors).length === 0 && !submitting

  const updateField = <K extends keyof InsuranceForm>(key: K, value: InsuranceForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const setConsent = (key: ConsentKey, value: boolean) => {
    setForm((previous) => ({
      ...previous,
      consents: {
        ...previous.consents,
        [key]: value,
      },
    }))
  }

  const onFileSelect = (key: 'insuranceFront' | 'insuranceBack', file: File | null) => {
    if (!file) {
      updateField(key, null)
      setErrors((previous) => ({ ...previous, [key]: '' }))
      return
    }

    const nextError = validateFile(file)
    if (nextError) {
      setErrors((previous) => ({ ...previous, [key]: nextError }))
      return
    }

    updateField(key, { name: file.name, size: file.size, type: file.type })
    setErrors((previous) => ({ ...previous, [key]: '' }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError('')
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      if (form.insuranceStatus === 'yes') {
        const payload = {
          insurance_provider_name: form.provider.trim(),
          insurance_number: form.policyNumber.trim(),
          insured_status: form.memberId.trim(),
        }
        try {
          await createInsurance(payload)
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            await updateInsurance(payload)
          } else {
            throw error
          }
        }
      }
      setSubmitting(false)
      setOnboardingStage('profile-completed')
      router.push(NEXT_ROUTE)
    } catch (error) {
      setSubmitError(getApiErrorDetail(error) || 'We could not save your insurance information. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(4,53,77,0.3); }
        select option { background: #fff; color: #04354D; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatRing { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes floatNode { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (max-width: 900px) {
          .ipc-left { display: none !important; }
          .ipc-wrap { padding: 24px 16px !important; }
          .ipc-card { padding: 28px 22px 24px !important; border-radius: 20px !important; }
          .ipc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className='ipc-left'>
        <LeftPanel />
      </div>

      <div className='ipc-wrap' style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '860px' }}>
          <Link href={BACK_ROUTE} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            Back
          </Link>

          <form className='ipc-card' onSubmit={handleSubmit} noValidate style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(34px) saturate(200%)', WebkitBackdropFilter: 'blur(34px) saturate(200%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.92)', boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)', padding: '36px 32px', animation: 'fadeUp 0.3s ease' }}>
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Profile Setup</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Step 5 of 6</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>84% Complete</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Less than 1 Minute</p>
              </div>
            </div>

            <header style={{ marginBottom: '16px' }}>
              <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2 }}>Coverage & Privacy</h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>Help us understand your healthcare coverage while reviewing the important information that keeps your medical data secure.</p>
            </header>

            <div style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '100px', background: savedTick ? T.greenLight : 'rgba(4,53,77,0.03)', border: `1px solid ${savedTick ? 'rgba(9,173,112,0.25)' : 'rgba(4,53,77,0.08)'}` }}>
              <Ico p={savedTick ? ICONS.check : ICONS.activity} size={11} sw={2} color={savedTick ? T.green : T.slate2} />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: savedTick ? T.teal : T.slate2, letterSpacing: '-0.005em' }}>{saveMessage}</span>
            </div>

            {submitError ? (
              <div role='alert' style={{ padding: '11px 13px', borderRadius: '12px', background: 'rgba(254,242,242,0.88)', border: '1px solid rgba(220,38,38,0.22)', color: T.red, fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                {submitError}
              </div>
            ) : null}

            <section style={{ marginBottom: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>Insurance Information</h2>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>Do you currently have health insurance?</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <ToggleChip label='Yes' active={form.insuranceStatus === 'yes'} onClick={() => updateField('insuranceStatus', 'yes')} />
                <ToggleChip label='No' active={form.insuranceStatus === 'no'} onClick={() => updateField('insuranceStatus', 'no')} tone='warning' />
              </div>

              {submitted && errors.insuranceStatus ? <p style={{ margin: '0 0 12px', fontSize: '12px', color: T.red }}>{errors.insuranceStatus}</p> : null}

              {form.insuranceStatus === 'yes' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className='ipc-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <TextField label='Insurance Provider' value={form.provider} onChange={(value) => updateField('provider', value)} placeholder='Provider name' error={submitted && errors.provider ? errors.provider : undefined} />
                    <TextField label='Policy Number' value={form.policyNumber} onChange={(value) => updateField('policyNumber', value)} placeholder='Policy number' error={submitted && errors.policyNumber ? errors.policyNumber : undefined} />
                    <TextField label='Member ID' value={form.memberId} onChange={(value) => updateField('memberId', value)} placeholder='Member ID' error={submitted && errors.memberId ? errors.memberId : undefined} />
                    <TextField label='Group Number' value={form.groupNumber} onChange={(value) => updateField('groupNumber', value)} placeholder='Group number' optional />
                  </div>

                  <div className='ipc-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <FileUploadCard label='Upload Insurance Card - Front' file={form.insuranceFront} onFile={(file) => onFileSelect('insuranceFront', file)} error={submitted && errors.insuranceFront ? errors.insuranceFront : undefined} inputRef={insuranceFrontRef} />
                    <FileUploadCard label='Upload Insurance Card - Back' file={form.insuranceBack} onFile={(file) => onFileSelect('insuranceBack', file)} error={submitted && errors.insuranceBack ? errors.insuranceBack : undefined} inputRef={insuranceBackRef} />
                  </div>
                </div>
              ) : null}

              {form.insuranceStatus === 'no' ? (
                <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(234,241,255,0.55)', border: '1px solid rgba(32,181,223,0.12)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: T.navy }}>That’s perfectly okay.</p>
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>You can still access Qarevo Health services without insurance, and you may add your insurance details later from your profile settings.</p>
                </div>
              ) : null}
            </section>

            <section style={{ marginBottom: '18px', paddingTop: '4px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div style={{ marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>Privacy & Consent</h2>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>Please review and confirm the items below before completing your profile.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {CONSENT_COPY.map((consent) => (
                  <CheckboxCard
                    key={consent.key}
                    checked={form.consents[consent.key]}
                    onChange={() => setConsent(consent.key, !form.consents[consent.key])}
                    title={consent.label}
                    required={consent.required}
                    learnMore={consent.learnMore}
                    details={consent.details}
                  />
                ))}
              </div>

              {submitted && errors.consents ? <p style={{ margin: '10px 0 0', fontSize: '12px', color: T.red }}>{errors.consents}</p> : null}
            </section>

            <section style={{ marginBottom: '18px', paddingTop: '4px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div style={{ marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>Security Reassurance</h2>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>Your information is protected with security practices designed for healthcare data.</p>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                <SecurityPill icon={ICONS.lock} title='End-to-End Encryption' />
                <SecurityPill icon={ICONS.shield} title='HIPAA-Oriented Security Practices' />
                <SecurityPill icon={ICONS.info} title='Secure Cloud Infrastructure' />
                <SecurityPill icon={ICONS.user} title='Only authorized healthcare professionals can access your medical records' />
              </div>
            </section>

            <div style={{ marginBottom: '16px', padding: '12px 13px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.info} size={13} sw={1.75} color={T.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Your Privacy Matters</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2, lineHeight: 1.55, letterSpacing: '-0.005em' }}>Your medical information is encrypted, securely stored, and only shared with healthcare professionals involved in your care. Qarevo Health is committed to protecting your privacy and maintaining the highest standards of healthcare security.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type='submit'
                disabled={!canContinue}
                onMouseEnter={() => setContinueHover(true)}
                onMouseLeave={() => setContinueHover(false)}
                style={{ width: '100%', minHeight: '48px', padding: '14px 20px', borderRadius: '13px', border: 'none', background: canContinue ? continueHover ? 'linear-gradient(135deg,#348CEA 0%,#0F47B8 100%)' : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(32,181,223,0.5)', color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', cursor: canContinue ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: canContinue ? '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)' : 'none', transition: 'all 0.15s ease', transform: canContinue && continueHover ? 'translateY(-1px)' : 'none', opacity: submitting ? 0.92 : 1 }}
              >
                <span>{submitting ? 'Completing profile...' : 'Complete Profile'}</span>
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </button>

              <Link href={BACK_ROUTE} style={{ textAlign: 'center', color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

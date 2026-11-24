'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'
import { getApiErrorDetail } from '@/lib/api'
import { hydrateAccountDraft } from '@/lib/hydrate-account-draft'
import { getOnboarding, saveHealthHistory } from '@/lib/patient-onboarding'
import { ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { createAccountDraftStorage } from '@/lib/account-storage'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.brandNavy,
].join(', ')

const STORAGE_KEY = 'qarevo.onboarding.health-profile.v1'
const NEXT_ROUTE = '/auth/profile-setup/insurance-privacy-consent'

const MEDICAL_HISTORY_OPTIONS = [
  'Diabetes',
  'Hypertension',
  'Asthma',
  'Heart Disease',
  'Kidney Disease',
  'Cancer',
  'Mental Health Conditions',
  'Thyroid Disorders',
  'None',
  'Other',
] as const

const SURGERY_YEARS = Array.from({ length: 61 }, (_, index) => String(new Date().getFullYear() - index))
const ALLERGY_OPTIONS = ['Medication', 'Food', 'Environmental', 'Latex', 'Other', 'No Known Allergies'] as const
const FAMILY_HISTORY_OPTIONS = ['Diabetes', 'Hypertension', 'Cancer', 'Stroke', 'Heart Disease', 'Mental Health', 'None Known'] as const
const FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'As Needed', 'Other'] as const

type SurgeryEntry = { id: string; procedureName: string; hospital: string; year: string }
type MedicationEntry = { id: string; medicationName: string; dosage: string; frequency: string; purpose: string }
type HealthProfileForm = {
  medicalHistory: string[]
  medicalHistoryOther: string
  surgeriesStatus: 'yes' | 'no' | ''
  surgeries: SurgeryEntry[]
  allergies: string[]
  allergyDetails: Record<string, string>
  currentMedicationsMode: 'taking' | 'none' | ''
  medications: MedicationEntry[]
  familyHistory: string[]
}

type HealthProfileErrors = Partial<Record<'medicalHistory' | 'medicalHistoryOther' | 'surgeries' | 'allergies' | 'medications' | 'familyHistory', string>>

const INITIAL_FORM: HealthProfileForm = {
  medicalHistory: [],
  medicalHistoryOther: '',
  surgeriesStatus: '',
  surgeries: [],
  allergies: [],
  allergyDetails: {},
  currentMedicationsMode: '',
  medications: [],
  familyHistory: [],
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function createSurgeryEntry(): SurgeryEntry {
  return { id: makeId(), procedureName: '', hospital: '', year: '' }
}

function createMedicationEntry(): MedicationEntry {
  return { id: makeId(), medicationName: '', dosage: '', frequency: '', purpose: '' }
}

/** `text` returns the active language's message for a validation key. */
function validateForm(form: HealthProfileForm, text: (key: string) => string): HealthProfileErrors {
  const nextErrors: HealthProfileErrors = {}

  if (form.medicalHistory.length === 0) {
    nextErrors.medicalHistory = text('errMedicalHistory')
  }

  if (form.medicalHistory.includes('Other') && form.medicalHistoryOther.trim().length < 4) {
    nextErrors.medicalHistoryOther = text('errMedicalHistoryOther')
  }

  if (!form.surgeriesStatus) {
    nextErrors.surgeries = text('errSurgeriesStatus')
  } else if (form.surgeriesStatus === 'yes') {
    if (form.surgeries.length === 0) {
      nextErrors.surgeries = text('errSurgeriesEmpty')
    } else if (form.surgeries.some((entry) => !entry.procedureName.trim() || !entry.hospital.trim() || !entry.year.trim())) {
      nextErrors.surgeries = text('errSurgeriesIncomplete')
    }
  }

  if (form.allergies.length === 0) {
    nextErrors.allergies = text('errAllergies')
  } else if (form.allergies.includes('Other') && (form.allergyDetails.Other?.trim().length || 0) < 4) {
    nextErrors.allergies = text('errAllergyOther')
  }

  if (!form.currentMedicationsMode) {
    nextErrors.medications = text('errMedicationsMode')
  } else if (form.currentMedicationsMode === 'taking') {
    if (form.medications.length === 0) {
      nextErrors.medications = text('errMedicationsEmpty')
    } else if (form.medications.some((entry) => !entry.medicationName.trim() || !entry.dosage.trim() || !entry.frequency.trim())) {
      nextErrors.medications = text('errMedicationsIncomplete')
    }
  }

  if (form.familyHistory.length === 0) {
    nextErrors.familyHistory = text('errFamilyHistory')
  }

  return nextErrors
}

function HealthVisual() {
  return (
    <div style={{ position: 'relative', width: '268px', height: '268px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 28, 58].map((inset, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            inset,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${0.06 + index * 0.04})`,
            animation: `floatRing 5s ease-in-out ${index * 0.18}s infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '84px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.34) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)',
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
      ].map(({ angle, icon, bg, border }, index) => {
        const radius = 102
        const radians = ((angle - 90) * Math.PI) / 180
        const x = 134 + radius * Math.cos(radians)
        const y = 134 + radius * Math.sin(radians)

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
              animation: `floatNode 4.6s ease-in-out ${index * 0.2}s infinite`,
            }}
          >
            <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
          </div>
        )
      })}

      <svg viewBox='0 0 268 28' style={{ position: 'absolute', bottom: '8px', left: 0, width: '100%', opacity: 0.42 }}>
        <polyline
          points='0,14 45,14 62,4 72,24 82,4 92,24 106,14 268,14'
          fill='none'
          stroke='rgba(52,140,234,0.85)'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <circle cx='82' cy='24' r='2.5' fill='rgba(52,140,234,0.9)' />
      </svg>
    </div>
  )
}

function LeftPanel() {
  const t = useTranslations('onboarding.medical')
  return (
    <div style={{ width: '380px', flexShrink: 0, background: LEFT_BG, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ProfileSetupLogo priority />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <HealthVisual />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            {t('yourHealthStoryOrganized')}<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>{t('builtToSupportSaferCare')}</span>
          </h2>
          <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            {t('yourProfileHelpsPhysiciansUnderstand')}
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.brain, label: t('panelInsights'), sub: t('panelInsightsSub') },
          { icon: ICONS.steth, label: t('panelReview'), sub: t('panelReviewSub') },
          { icon: ICONS.shield, label: t('panelPrivate'), sub: t('panelPrivateSub') },
        ].map(({ icon, label, sub }) => (
          <div key={label} style={{ display: 'flex', gap: '13px', alignItems: 'flex-start', padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
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

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ margin: '0 0 4px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>{title} (Required)</h2>
      <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>{body}</p>
    </div>
  )
}

function ChipButton({ label, active, onClick, tone = 'default' }: { label: string; active: boolean; onClick: () => void; tone?: 'default' | 'warning' }) {
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
      style={{ minHeight: '38px', padding: '8px 12px', borderRadius: '999px', border: `1px solid ${active ? activeBorder : hovered ? "var(--border)" : "var(--border)"}`, background: active ? activeBg : hovered ? "var(--surface-glass)" : "var(--surface-glass)", color: active ? activeColor : T.slate, fontSize: "13px", fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer', transition: 'all 0.16s ease', boxShadow: active ? '0 2px 10px rgba(32,181,223,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.88)' }}>
      {label}
    </button>
  )
}

function Field({ label, placeholder, value, onChange, error, success, type = 'text', autoComplete, optional }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; error?: string; success?: boolean; type?: string; autoComplete?: string; optional?: boolean }) {
  const t = useTranslations('onboarding.medical')
  const [focused, setFocused] = useState(false)
  const id = useId()

  const border = error ? 'rgba(220,38,38,0.55)' : success ? 'rgba(9,173,112,0.5)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'
  const background = error ? '#FFF5F5' : success ? '#F0FDF8' : focused ? '#fff' : 'rgba(255,255,255,0.78)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label} {optional ? <span style={{ color: T.slate2, fontWeight: 500 }}>{t('optional')}</span> : <span>{t('required')}</span>}
      </label>
      <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ width: '100%', minHeight: '44px', padding: '11px 12px', borderRadius: '11px', border: `1.5px solid ${border}`, background, color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s ease' }} />
      {(error || success) && <p style={{ margin: 0, fontSize: "13px", color: error ? T.red : T.green, lineHeight: 1.45 }}>{error || t('looksGood')}</p>}
    </div>
  )
}

function TextAreaField({ label, placeholder, value, onChange, error, optional }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; error?: string; optional?: boolean }) {
  const t = useTranslations('onboarding.medical')
  const [focused, setFocused] = useState(false)
  const id = useId()
  const border = error ? 'rgba(220,38,38,0.55)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label} {optional ? <span style={{ color: T.slate2, fontWeight: 500 }}>{t('optional')}</span> : <span>{t('required')}</span>}
      </label>
      <textarea id={id} required={!optional} aria-invalid={!!error} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={3} style={{ width: '100%', padding: '11px 12px', borderRadius: '11px', border: `1.5px solid ${border}`, background: focused ? "var(--surface)" : "var(--surface-glass)", color: T.navy, fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', transition: 'all 0.15s ease' }} />
      {error ? <p style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.45 }}>{error}</p> : null}
    </div>
  )
}

function SectionStatus({ title, description, status, error }: { title: string; description: string; status: string; error?: boolean }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '17px', fontWeight: 800, color: T.navy, letterSpacing: '-0.025em' }}>{title} (Required)</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: error ? 'rgba(220,38,38,0.08)' : 'rgba(9,173,112,0.09)', border: `1px solid ${error ? 'rgba(220,38,38,0.18)' : 'rgba(9,173,112,0.16)'}`, color: error ? T.red : T.green, fontSize: "13px", fontWeight: 700 }}>
          <Ico p={error ? ICONS.info : ICONS.check} size={11} sw={2.2} color={error ? T.red : T.green} />
          {status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.01em' }}>{description}</p>
    </div>
  )
}

function SurgeryCard({ entry, onChange, onRemove, canRemove }: { entry: SurgeryEntry; onChange: (next: SurgeryEntry) => void; onRemove: () => void; canRemove: boolean }) {
  const t = useTranslations('onboarding.medical')
  return (
    <div style={{ padding: '16px', borderRadius: '16px', background: "var(--surface-glass)", border: "1px solid var(--border)", boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr', gap: '12px' }}>
        <Field label={t('procedureName')} placeholder={t('appendectomy')} value={entry.procedureName} onChange={(value) => onChange({ ...entry, procedureName: value })} autoComplete='off' />
        <Field label={t('hospitalClinic')} placeholder={t('stMaryHospital')} value={entry.hospital} onChange={(value) => onChange({ ...entry, hospital: value })} autoComplete='organization' />
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em', display: 'block', marginBottom: '6px' }}>{t('year')}</label>
          <select value={entry.year} onChange={(event) => onChange({ ...entry, year: event.target.value })} style={{ width: '100%', minHeight: '44px', padding: '11px 12px', borderRadius: '11px', border: `1.5px solid ${entry.year ? 'rgba(9,173,112,0.5)' : "var(--border)"}`, background: entry.year ? "var(--success-soft)" : "var(--surface-glass)", color: entry.year ? T.navy : T.slate2, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}>
            <option value=''>{t('selectYear')}</option>
            {SURGERY_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: "13px", color: T.slate2, lineHeight: 1.5 }}>{t('addOnlyProceduresThatMatter')}</span>
        {canRemove ? (
          <button type='button' onClick={onRemove} style={{ background: 'none', border: 'none', padding: 0, color: T.red, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}>
            {t('remove')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function MedicationCard({ entry, onChange, onRemove, canRemove }: { entry: MedicationEntry; onChange: (next: MedicationEntry) => void; onRemove: () => void; canRemove: boolean }) {
  const t = useTranslations('onboarding.medical')
  return (
    <div style={{ padding: '16px', borderRadius: '16px', background: "var(--surface-glass)", border: "1px solid var(--border)", boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: '12px' }}>
        <Field label={t('medicationName')} placeholder={t('metformin')} value={entry.medicationName} onChange={(value) => onChange({ ...entry, medicationName: value })} autoComplete='off' />
        <Field label={t('dosage')} placeholder={t('t500Mg')} value={entry.dosage} onChange={(value) => onChange({ ...entry, dosage: value })} autoComplete='off' />
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em', display: 'block', marginBottom: '6px' }}>{t('frequency')}</label>
          <select value={entry.frequency} onChange={(event) => onChange({ ...entry, frequency: event.target.value })} style={{ width: '100%', minHeight: '44px', padding: '11px 12px', borderRadius: '11px', border: `1.5px solid ${entry.frequency ? 'rgba(9,173,112,0.5)' : "var(--border)"}`, background: entry.frequency ? "var(--success-soft)" : "var(--surface-glass)", color: entry.frequency ? T.navy : T.slate2, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}>
            <option value=''>{t('selectFrequency')}</option>
            {FREQUENCY_OPTIONS.map((frequency) => <option key={frequency} value={frequency}>{t('opt' + frequency.replace(/[^A-Za-z]/g, ''))}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
        <Field label={t('purpose')} placeholder={t('bloodSugarSupport')} value={entry.purpose} onChange={(value) => onChange({ ...entry, purpose: value })} optional />
        {canRemove ? (
          <button type='button' onClick={onRemove} style={{ background: 'none', border: 'none', padding: '0 0 10px', color: T.red, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}>
            {t('remove')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function MedicalHistoryAllergiesPage() {
  const t = useTranslations('onboarding.medical')
  // Stored values stay in English for the API; only the visible label is translated.
  const optionLabel = (option: string) => t('opt' + option.replace(/[^A-Za-z]/g, ''))
  const router = useRouter()
  const [draftStorage] = useState(createAccountDraftStorage)
  const [draftReady, setDraftReady] = useState(false)
  const [form, setForm] = useState<HealthProfileForm>(INITIAL_FORM)
  const [savedTick, setSavedTick] = useState(false)
  const [saveMessage, setSaveMessage] = useState(t('draftAutosaves'))
  const [submitting, setSubmitting] = useState(false)
  const [continueHover, setContinueHover] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<HealthProfileErrors>({})

  useEffect(() => hydrateAccountDraft<HealthProfileForm>(draftStorage, STORAGE_KEY, async () => {
    const saved = (await getOnboarding()).health
    return saved ? {
      medicalHistory: saved.medical_history, medicalHistoryOther: saved.other_condition,
      surgeriesStatus: saved.surgeries_status,
      surgeries: saved.surgeries.map(item => ({ id: item.id, procedureName: item.procedure_name, hospital: item.hospital, year: String(item.year) })),
      allergies: saved.allergies, allergyDetails: saved.allergy_details,
      currentMedicationsMode: saved.medications_status,
      medications: saved.medications.map(item => ({ id: item.id, medicationName: item.medication_name, dosage: item.dosage, frequency: item.frequency, purpose: item.purpose })),
      familyHistory: saved.family_history,
    } : {}
  }, data => setForm({ ...INITIAL_FORM, ...data }),
  error => setSubmitError(getApiErrorDetail(error) || t('loadFailed')),
  () => setDraftReady(true)), [draftStorage, t])

  useEffect(() => {
    if (!draftReady) return
    const timer = window.setTimeout(() => {
      try {
        draftStorage.setItem(STORAGE_KEY, JSON.stringify(form))
        setSavedTick(true)
        setSaveMessage(t('draftSaved'))
        window.setTimeout(() => {
          setSavedTick(false)
          setSaveMessage(t('draftAutosaves'))
        }, 1400)
      } catch {
        setSaveMessage(t('autosaveFailed'))
      }
    }, 320)

    return () => window.clearTimeout(timer)
  }, [form, draftStorage, draftReady, t])

  useEffect(() => {
    setErrors(validateForm(form, key => t(key)))
  }, [form, t])

  const canContinue = draftReady && !submitting
  const progress = 67

  const updateField = <K extends keyof HealthProfileForm>(key: K, value: HealthProfileForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const toggleSelection = (group: 'medicalHistory' | 'allergies' | 'familyHistory', value: string) => {
    setForm((previous) => {
      const current = previous[group]

      if (group === 'medicalHistory') {
        if (value === 'None') return { ...previous, medicalHistory: ['None'], medicalHistoryOther: '' }
        const next = current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== 'None'), value]
        return { ...previous, medicalHistory: next, medicalHistoryOther: next.includes('Other') ? previous.medicalHistoryOther : '' }
      }

      if (group === 'allergies') {
        if (value === 'No Known Allergies') {
          return { ...previous, allergies: ['No Known Allergies'], allergyDetails: {} }
        }
        const next = current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== 'No Known Allergies'), value]
        return {
          ...previous,
          allergies: next,
          allergyDetails: next.includes('Other') ? previous.allergyDetails : { ...previous.allergyDetails, Other: '' },
        }
      }

      if (value === 'None Known') {
        return { ...previous, familyHistory: ['None Known'] }
      }

      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== 'None Known'), value]
      return { ...previous, familyHistory: next }
    })
  }

  const addSurgery = () => {
    setForm((previous) => ({
      ...previous,
      surgeriesStatus: 'yes',
      surgeries: [...previous.surgeries, createSurgeryEntry()],
    }))
  }

  const addMedication = () => {
    setForm((previous) => ({
      ...previous,
      currentMedicationsMode: 'taking',
      medications: [...previous.medications, createMedicationEntry()],
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError('')
    const nextErrors = validateForm(form, key => t(key))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) { focusValidation(event.currentTarget); return }

    setSubmitting(true)
    try {
      await saveHealthHistory({
        medical_history: form.medicalHistory, other_condition: form.medicalHistoryOther,
        surgeries_status: form.surgeriesStatus as 'yes' | 'no',
        surgeries: form.surgeriesStatus === 'yes' ? form.surgeries.map(item => ({ id: item.id, procedure_name: item.procedureName, hospital: item.hospital, year: Number(item.year) })) : [],
        allergies: form.allergies,
        allergy_details: Object.fromEntries(Object.entries(form.allergyDetails).filter(([key, value]) => form.allergies.includes(key) && value.trim())),
        medications_status: form.currentMedicationsMode as 'taking' | 'none',
        medications: form.currentMedicationsMode === 'taking' ? form.medications.map(item => ({ id: item.id, medication_name: item.medicationName, dosage: item.dosage, frequency: item.frequency, purpose: item.purpose })) : [],
        family_history: form.familyHistory,
      })
      draftStorage.removeItem(STORAGE_KEY)
      setSubmitting(false)
      setOnboardingStage('insurance-consent')
      router.push(NEXT_ROUTE)
    } catch (error) {
      setSubmitError(getApiErrorDetail(error) || t('saveFailed'))
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: var(--text-muted); }
        select option { background: var(--surface); color: var(--text); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatRing { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes floatNode { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (max-width: 900px) {
          .hp-left { display: none !important; }
          .hp-wrap { padding: 24px 16px !important; }
          .hp-card { padding: 28px 22px 24px !important; border-radius: 20px !important; }
          .hp-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className='hp-left'>
        <LeftPanel />
      </div>

      <div className='hp-wrap' style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '860px' }}>
          <Link href='/auth/profile-setup/contact-information' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: T.slate2, textDecoration: 'none', marginBottom: '28px', letterSpacing: '-0.01em' }}>
            <Ico p={ICONS.arrowSm} size={14} sw={2} style={{ transform: 'rotate(180deg)' }} />
            {t('back')}
          </Link>

          <form className='hp-card' onSubmit={handleSubmit} noValidate style={{ background: "var(--surface-glass)", backdropFilter: 'blur(34px) saturate(200%)', WebkitBackdropFilter: 'blur(34px) saturate(200%)', borderRadius: '24px', border: "1px solid var(--border)", boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)', padding: '36px 32px', animation: 'fadeUp 0.3s ease' }}>
            <ValidationSummary errors={submitted ? errors : {}} />
            <fieldset disabled={!draftReady || submitting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)", display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('profileSetup')}</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>{t('step4Of6')}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{progress}% Complete</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>{t('about2Minutes')}</p>
              </div>
            </div>

            <header style={{ marginBottom: '16px' }}>
              <h1 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2 }}>{t('yourHealthProfile')}</h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>{t('thisInformationHelpsYourHealthcare')}</p>
            </header>

            <div style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '100px', background: savedTick ? T.greenLight : "var(--surface-hover)", border: `1px solid ${savedTick ? 'rgba(9,173,112,0.25)' : "var(--border)"}` }}>
              <Ico p={savedTick ? ICONS.check : ICONS.activity} size={11} sw={2} color={savedTick ? T.green : T.slate2} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: savedTick ? T.teal : T.slate2, letterSpacing: '-0.005em' }}>{saveMessage}</span>
            </div>

            {submitError ? (
              <div role='alert' style={{ padding: '11px 13px', borderRadius: '12px', background: 'rgba(254,242,242,0.88)', border: '1px solid rgba(220,38,38,0.22)', color: T.red, fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                {submitError}
              </div>
            ) : null}

            <div style={{ marginBottom: '18px' }}>
              <SectionHeader title={t('medicalHistory')} body={t('historyIntro')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {MEDICAL_HISTORY_OPTIONS.map((option) => (
                  <ChipButton key={option} label={optionLabel(option)} active={form.medicalHistory.includes(option)} onClick={() => toggleSelection('medicalHistory', option)} tone={option === 'None' ? 'warning' : 'default'} />
                ))}
              </div>
              {form.medicalHistory.includes('Other') ? (
                <TextAreaField label={t('otherCondition')} placeholder={t('tellUsAboutAnyOther')} value={form.medicalHistoryOther} onChange={(value) => updateField('medicalHistoryOther', value)} error={(submitted || !!form.medicalHistoryOther) && errors.medicalHistoryOther ? errors.medicalHistoryOther : undefined} />
              ) : null}
              {submitted && errors.medicalHistory ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.red }}>{errors.medicalHistory}</p> : null}
              {submitted && !errors.medicalHistory && !errors.medicalHistoryOther ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.green }}>{t('medicalHistoryCaptured')}</p> : null}
            </div>

            <div style={{ marginBottom: '18px', paddingTop: '4px', borderTop: "1px solid var(--border)" }}>
              <SectionStatus title={t('pastSurgeries')} description={t('haveYouHadAnyPrevious')} status={form.surgeriesStatus === 'yes' ? t('statusDetails') : form.surgeriesStatus === 'no' ? t('statusNoSurgeries') : t('statusChoose')} error={submitted && !!errors.surgeries} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <ChipButton label={t('no')} active={form.surgeriesStatus === 'no'} onClick={() => setForm((previous) => ({ ...previous, surgeriesStatus: 'no', surgeries: [] }))} />
                <ChipButton label={t('yes')} active={form.surgeriesStatus === 'yes'} onClick={() => setForm((previous) => ({ ...previous, surgeriesStatus: 'yes', surgeries: previous.surgeries.length ? previous.surgeries : [createSurgeryEntry()] }))} />
              </div>
              {form.surgeriesStatus === 'yes' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {form.surgeries.map((entry) => (
                    <SurgeryCard key={entry.id} entry={entry} onChange={(next) => setForm((previous) => ({ ...previous, surgeries: previous.surgeries.map((item) => (item.id === entry.id ? next : item)) }))} onRemove={() => setForm((previous) => ({ ...previous, surgeries: previous.surgeries.filter((item) => item.id !== entry.id) }))} canRemove={form.surgeries.length > 1} />
                  ))}
                  <HoverBtn base={{ width: 'fit-content', alignSelf: 'flex-start', padding: '9px 14px', borderRadius: '999px', border: '1px solid rgba(32,181,223,0.18)', background: 'rgba(234,241,255,0.78)', color: T.link, fontSize: "13px", fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer' }} on={{ background: 'rgba(234,241,255,0.96)', transform: 'translateY(-1px)' }} onClick={addSurgery}>{t('addAnotherSurgery')}</HoverBtn>
                </div>
              ) : null}
              {submitted && errors.surgeries ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.red }}>{errors.surgeries}</p> : null}
            </div>

            <div style={{ marginBottom: '18px', paddingTop: '4px', borderTop: "1px solid var(--border)" }}>
              <SectionStatus title={t('allergies')} description={t('tellUsAboutAnyAllergies')} status={form.allergies.includes('No Known Allergies') ? t('statusNoAllergies') : t('statusAllergies')} error={submitted && !!errors.allergies} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {ALLERGY_OPTIONS.map((option) => (
                  <ChipButton key={option} label={optionLabel(option)} active={form.allergies.includes(option)} onClick={() => toggleSelection('allergies', option)} tone={option === 'No Known Allergies' ? 'warning' : 'default'} />
                ))}
              </div>
              {form.allergies.filter((item) => item !== 'No Known Allergies').length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {form.allergies.filter((item) => item !== 'No Known Allergies').map((allergy) => (
                    <TextAreaField key={allergy} label={t('allergyDetails', { allergy: optionLabel(allergy) })} placeholder={t('describeTheReactionSeverityOr')} value={form.allergyDetails[allergy] || ''} onChange={(value) => setForm((previous) => ({ ...previous, allergyDetails: { ...previous.allergyDetails, [allergy]: value } }))} optional={allergy !== 'Other'} error={submitted && allergy === 'Other' && !form.allergyDetails.Other?.trim() ? t('allergyOtherError') : undefined} />
                  ))}
                </div>
              ) : null}
              {submitted && errors.allergies ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.red }}>{errors.allergies}</p> : null}
            </div>

            <div style={{ marginBottom: '18px', paddingTop: '4px', borderTop: "1px solid var(--border)" }}>
              <SectionStatus title={t('currentMedications')} description={t('addTheMedicinesYouAre')} status={form.currentMedicationsMode === 'taking' ? t('statusMedications') : form.currentMedicationsMode === 'none' ? t('statusNoMedication') : t('statusChoose')} error={submitted && !!errors.medications} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <ChipButton label={t('notTakingMedication')} active={form.currentMedicationsMode === 'none'} onClick={() => setForm((previous) => ({ ...previous, currentMedicationsMode: 'none', medications: [] }))} tone='warning' />
                <ChipButton label={t('iAmTakingMedication')} active={form.currentMedicationsMode === 'taking'} onClick={() => setForm((previous) => ({ ...previous, currentMedicationsMode: 'taking', medications: previous.medications.length ? previous.medications : [createMedicationEntry()] }))} />
              </div>
              {form.currentMedicationsMode === 'taking' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {form.medications.map((entry) => (
                    <MedicationCard key={entry.id} entry={entry} onChange={(next) => setForm((previous) => ({ ...previous, medications: previous.medications.map((item) => (item.id === entry.id ? next : item)) }))} onRemove={() => setForm((previous) => ({ ...previous, medications: previous.medications.filter((item) => item.id !== entry.id) }))} canRemove={form.medications.length > 1} />
                  ))}
                  <HoverBtn base={{ width: 'fit-content', alignSelf: 'flex-start', padding: '9px 14px', borderRadius: '999px', border: '1px solid rgba(32,181,223,0.18)', background: 'rgba(234,241,255,0.78)', color: T.link, fontSize: "13px", fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer' }} on={{ background: 'rgba(234,241,255,0.96)', transform: 'translateY(-1px)' }} onClick={addMedication}>{t('addAnotherMedication')}</HoverBtn>
                </div>
              ) : null}
              {submitted && errors.medications ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.red }}>{errors.medications}</p> : null}
            </div>

            <div style={{ marginBottom: '18px', paddingTop: '4px', borderTop: "1px solid var(--border)" }}>
              <SectionStatus title={t('familyMedicalHistory')} description={t('chooseConditionsThatRunIn')} status={form.familyHistory.includes('None Known') ? t('statusNoFamily') : t('statusFamily')} error={submitted && !!errors.familyHistory} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {FAMILY_HISTORY_OPTIONS.map((option) => (
                  <ChipButton key={option} label={optionLabel(option)} active={form.familyHistory.includes(option)} onClick={() => toggleSelection('familyHistory', option)} tone={option === 'None Known' ? 'warning' : 'default'} />
                ))}
              </div>
              {submitted && errors.familyHistory ? <p style={{ margin: '10px 0 0', fontSize: "13px", color: T.red }}>{errors.familyHistory}</p> : null}
            </div>

            <div style={{ marginBottom: '16px', padding: '12px 13px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)", display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.info} size={13} sw={1.75} color={T.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: "13px", fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>{t('whyIsThisImportant')}</p>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate2, lineHeight: 1.55, letterSpacing: '-0.005em' }}>{t('yourHealthInformationAllowsPhysicians')}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type='submit' disabled={!canContinue} onMouseEnter={() => setContinueHover(true)} onMouseLeave={() => setContinueHover(false)} style={{ width: '100%', minHeight: '48px', padding: '14px 20px', borderRadius: '13px', border: 'none', background: canContinue ? continueHover ? 'linear-gradient(135deg,var(--primary-end) 0%,#0F47B8 100%)' : `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)` : 'rgba(32,181,223,0.5)', color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', cursor: canContinue ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: canContinue ? '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)' : 'none', transition: 'all 0.15s ease', transform: canContinue && continueHover ? 'translateY(-1px)' : 'none', opacity: submitting ? 0.92 : 1 }}>
                <span>{submitting ? t('savingContinue') : t('continue')}</span>
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </button>

              <Link href='/auth/profile-setup/contact-information' style={{ textAlign: 'center', color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                {t('back')}
              </Link>
            </div>
          </fieldset></form>
        </div>
      </div>
    </main>
  )
}

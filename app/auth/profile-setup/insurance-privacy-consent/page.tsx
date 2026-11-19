'use client'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PAGE_BG, T } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'
import { ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ApiError, getApiErrorDetail } from '@/lib/api'
import { createAccountDraftStorage } from '@/lib/account-storage'
import { hydrateAccountDraft } from '@/lib/hydrate-account-draft'
import { getOnboarding, saveCoverageInformation, onboardingPath, type CoverageInformation, type OnboardingStatus } from '@/lib/patient-onboarding'
import { INSURANCE_VERIFICATION_NOTICE, SELF_PAY_NOTICE } from '@/lib/insurance-presentation'
const LEFT_BG = `radial-gradient(ellipse at top left, rgba(32,181,223,.3), transparent 60%), ${T.brandNavy}`
const STORAGE_KEY = 'qarevo.onboarding.insurance-privacy-consent.v2'
type FundingType = CoverageInformation['insurance_type']
type CoverageForm = Omit<CoverageInformation, 'insurance_type'> & { insurance_type: FundingType | '' }
const INITIAL_FORM: CoverageForm = { insurance_type: '', provider: '', insurance_number: '', consents: { terms: false, privacy: false, health: false, telemedicine: false, marketing: false } }
const FUNDING_OPTIONS: { value: FundingType; label: string; body: string }[] = [
  { value: 'GKV', label: 'Statutory insurance (GKV)', body: 'Gesetzliche Krankenversicherung, with your KVNR from the health card.' },
  { value: 'PKV', label: 'Private insurance (PKV)', body: 'Private health insurance, with the policy number from your insurer.' },
  { value: 'SELF_PAY', label: 'Self-pay', body: 'You pay the practice directly. You can add insurance later.' },
]
const TEST_ACKNOWLEDGEMENTS = [
  ['terms', 'I understand that the patient terms are still awaiting approval.'],
  ['privacy', 'I understand that the privacy notice is still awaiting approval.'],
  ['health', 'I am using synthetic test information only.'],
  ['telemedicine', 'I understand that this development flow does not authorise real medical care.'],
] as const
const STEP_LABELS: Record<NonNullable<OnboardingStatus['next_step']>, string> = {
  personal: 'personal information', contact: 'contact information', health: 'medical history', coverage: 'coverage',
}

/** Only the fields the API accepts, so a stale draft or saved record can never add unknown keys. */
function toForm(data: Partial<CoverageForm>): CoverageForm {
  const type = FUNDING_OPTIONS.some(option => option.value === data.insurance_type) ? data.insurance_type as FundingType : ''
  const consents = data.consents || INITIAL_FORM.consents
  return {
    insurance_type: type,
    provider: typeof data.provider === 'string' ? data.provider : '',
    insurance_number: typeof data.insurance_number === 'string' ? data.insurance_number : '',
    consents: {
      terms: consents.terms === true, privacy: consents.privacy === true, health: consents.health === true,
      telemedicine: consents.telemedicine === true, marketing: consents.marketing === true,
    },
  }
}

function validate(form: CoverageForm) {
  const errors: Record<string, string> = {}
  if (!form.insurance_type) errors.insurance_type = 'Select a funding type.'
  if (form.insurance_type && form.insurance_type !== 'SELF_PAY') {
    if (form.provider.trim().length < 2) errors.provider = 'Enter the insurer name.'
    if (form.insurance_type === 'GKV' && !/^[A-Z][0-9]{9}$/.test(form.insurance_number.trim())) errors.insurance_number = 'Use one capital letter and nine digits.'
    if (form.insurance_type === 'PKV' && !/^[A-Za-z0-9][A-Za-z0-9 /.-]{2,49}$/.test(form.insurance_number.trim())) errors.insurance_number = 'Enter the policy number as supplied by the insurer (3–50 characters).'
  }
  if (TEST_ACKNOWLEDGEMENTS.some(([key]) => !form.consents[key])) errors.consents = 'Confirm each required test acknowledgement.'
  return errors
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
          <h2 style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Coverage, handled carefully.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Privacy stays in focus.</span>
          </h2>
          <p style={{ fontSize: '14px', color: "rgba(255,255,255,0.78)", lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Record your intended funding route and review the privacy information before continuing.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Saved Preferences', sub: 'Your choices are saved to your account' },
          { icon: ICONS.shield, label: 'Trusted Access', sub: 'Only authorized care teams can review it' },
          { icon: ICONS.check, label: 'Funding preferences', sub: 'Record statutory, private or self-pay details' },
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
  return <div className='cv-section-head'><h2>{title}</h2><p>{body}</p></div>
}

function TextField({ label, value, onChange, placeholder, error, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <div className='cv-field'>
      <label htmlFor={id}>{label} <span className='cv-required'>(Required)</span></label>
      <input id={id} required aria-invalid={!!error} autoComplete='off' value={value} placeholder={placeholder}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined}
        onChange={event => onChange(event.target.value)} />
      {hint && <p id={`${id}-hint`} className='field-hint'>{hint}</p>}
      {error && <p id={`${id}-error`} role='alert' className='field-error'>{error}</p>}
    </div>
  )
}

export default function InsurancePrivacyConsentPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [draftStorage] = useState(createAccountDraftStorage)
  const [form, setForm] = useState<CoverageForm>(INITIAL_FORM)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [ready, setReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')
  const [saveMessage, setSaveMessage] = useState('Draft autosaves in this tab')
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(form)
  const shown = submitted ? errors : {}
  // A completed profile already holds every mandatory acknowledgement, so leaving without changes bypasses nothing.
  const returning = !!status?.complete
  const earlierStep = status?.next_step && status.next_step !== 'coverage' ? status.next_step : null

  useEffect(() => {
    setReady(false); setLoadError('')
    let live = true
    const request = getOnboarding()
    request.then(value => { if (live) setStatus(value) }).catch(() => { /* reported by the hydration below */ })
    const stop = hydrateAccountDraft<CoverageForm>(draftStorage, STORAGE_KEY, async () => (await request).coverage || {},
      data => setForm(toForm(data)),
      error => setLoadError(getApiErrorDetail(error) || 'Your saved coverage could not be loaded.'),
      () => setReady(true))
    return () => { live = false; stop() }
  }, [draftStorage, reloadKey])

  useEffect(() => {
    if (!ready) return
    setSaveMessage('Saving draft in this tab…')
    const persist = () => {
      try { draftStorage.setItem(STORAGE_KEY, JSON.stringify(form)); setSaveMessage('Draft saved in this tab') }
      catch { setSaveMessage('Could not autosave right now') }
    }
    const timer = window.setTimeout(persist, 320)
    // Refresh/navigation must not discard the last keystrokes before the debounce.
    window.addEventListener('pagehide', persist)
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', persist) }
  }, [form, draftStorage, ready])

  const update = <K extends keyof CoverageForm>(key: K, value: CoverageForm[K]) => { setSavedNotice(''); setForm(previous => ({ ...previous, [key]: value })) }
  const reloadSaved = () => {
    try { draftStorage.removeItem(STORAGE_KEY) } catch { /* the server copy is reloaded either way */ }
    setSubmitted(false); setSubmitError(''); setConflict(false); setSavedNotice('')
    setReloadKey(n => n + 1)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true); setSavedNotice('')
    if (Object.keys(errors).length) { if (formRef.current) focusValidation(formRef.current); return }
    setSubmitError(''); setConflict(false); setSubmitting(true)
    try {
      const saved = await saveCoverageInformation({ ...form, insurance_type: form.insurance_type as FundingType })
      setStatus(saved)
      try { draftStorage.removeItem(STORAGE_KEY) } catch { /* nothing left to clear */ }
      if (!saved.complete) { setSubmitError('Your coverage is saved. An earlier profile step still needs to be completed before you can continue.'); return }
      if (returning) { setSubmitted(false); setSavedNotice('Your coverage and acknowledgements are up to date.'); return }
      setOnboardingStage('profile-completed')
      router.push('/auth/profile-setup/profile-completed')
    } catch (error) {
      const isConflict = error instanceof ApiError && error.status === 409
      setConflict(isConflict)
      setSubmitError(isConflict
        ? 'Your saved details changed since this page was opened, for example in another tab. Reload them, check your choices and save again.'
        : getApiErrorDetail(error) || 'Could not save your coverage information. Please try again.')
    } finally { setSubmitting(false) }
  }

  const pill = !ready ? 'Loading your saved coverage…' : savedNotice ? 'Saved to your account' : saveMessage
  return <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
    <style>{`
      .cv-left { display: block; }
      .cv-wrap { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 44px 24px; min-height: 100vh; }
      .cv-card { background: var(--surface-glass); backdrop-filter: blur(34px) saturate(200%); -webkit-backdrop-filter: blur(34px) saturate(200%); border: 1px solid var(--border); border-radius: 24px; box-shadow: 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1); padding: 36px 32px; animation: cvFade .3s ease; }
      @keyframes cvFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .cv-card fieldset.cv-root { border: 0; padding: 0; margin: 0; min-width: 0; }
      .cv-progress { padding: 12px 14px; border-radius: 12px; background: var(--surface-hover); border: 1px solid var(--border); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .cv-progress p { margin: 0; font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -.01em; }
      .cv-progress p.cv-eyebrow { margin: 0 0 3px; color: var(--text-muted); letter-spacing: .06em; text-transform: uppercase; }
      .cv-card h1 { margin: 0 0 8px; font-family: var(--font-inter), Inter, system-ui, sans-serif; font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -.035em; line-height: 1.2; }
      .cv-lede { margin: 0 0 14px; font-size: 14px; color: var(--text-secondary); line-height: 1.65; }
      .cv-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 100px; background: var(--surface-hover); border: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 14px; }
      .cv-pill.saved { background: var(--success-soft, var(--surface-hover)); color: var(--success, var(--text)); }
      .cv-note { padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-subtle); margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: var(--text); }
      .cv-note.warn { border-color: var(--warning, var(--border)); }
      .cv-note.danger { border-color: var(--danger); background: var(--danger-soft); }
      .cv-note p { margin: 0 0 8px; } .cv-note p:last-child { margin: 0; }
      .cv-note a, .cv-link { color: var(--link); font-weight: 700; }
      .cv-inline-button { min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
      .cv-section { margin: 22px 0 0; }
      .cv-section-head h2 { margin: 0 0 4px; font-family: var(--font-inter), Inter, system-ui, sans-serif; font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -.025em; }
      .cv-section-head p { margin: 0 0 12px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
      .cv-options { border: 0; padding: 0; margin: 0; min-width: 0; }
      .cv-options legend { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 8px; padding: 0; }
      .cv-option-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .cv-option { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 14px 14px 14px 44px; min-height: 92px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface); cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
      .cv-option input { position: absolute; left: 14px; top: 16px; width: 18px; height: 18px; margin: 0; accent-color: var(--action-primary); }
      .cv-option strong { font-size: 14px; color: var(--text); letter-spacing: -.01em; }
      .cv-option span { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
      .cv-option.chosen { border-color: var(--action-primary); box-shadow: 0 0 0 1px var(--action-primary); }
      .cv-options[aria-invalid="true"] .cv-option { border-color: var(--danger); }
      .cv-option:has(input:focus-visible) { outline: 3px solid var(--action-primary); outline-offset: 2px; }
      .cv-notice { margin: 12px 0 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
      .cv-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
      .cv-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .cv-field label { font-size: 13px; font-weight: 600; color: var(--text); }
      .cv-required { font-weight: 500; color: var(--text-muted); }
      .cv-field input { width: 100%; min-height: 46px; padding: 11px 12px; border-radius: 11px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; }
      .cv-field input:focus-visible { outline: none; border-color: var(--link); box-shadow: 0 0 0 3px var(--focus-ring, rgba(52,140,234,.25)); }
      .cv-field input[aria-invalid="true"] { border-color: var(--danger); background: var(--danger-soft); }
      .cv-acks { padding: 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-subtle); }
      .cv-acks > p { margin: 0 0 6px; font-size: 13px; color: var(--text-secondary); line-height: 1.65; }
      .cv-check { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border-subtle, var(--border)); color: var(--text); font-size: 14px; line-height: 1.55; cursor: pointer; }
      .cv-check:first-of-type { border-top: 0; }
      .cv-check input { flex: none; width: 20px; height: 20px; margin: 1px 0 0; accent-color: var(--action-primary); }
      .cv-check .field-error { display: block; margin-top: 4px; }
      .cv-optional { margin-top: 14px; }
      .cv-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; }
      .cv-actions .cv-secondary-links { display: flex; gap: 16px; flex-wrap: wrap; }
      .cv-submit { min-height: 50px; padding: 0 28px; border: 0; border-radius: 12px; background: var(--action-primary); color: var(--surface); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
      .cv-submit:disabled { opacity: .6; cursor: progress; }
      .cv-card :focus-visible { outline: 3px solid var(--action-primary); outline-offset: 2px; }
      @media (max-width: 1000px) { .cv-left { display: none; } }
      @media (max-width: 720px) {
        .cv-wrap { padding: 20px 16px; align-items: flex-start; }
        .cv-card { padding: 24px 18px; border-radius: 20px; }
        .cv-option-grid, .cv-fields { grid-template-columns: 1fr; }
        .cv-option { min-height: 0; }
        .cv-actions { flex-direction: column-reverse; align-items: stretch; }
        .cv-submit { width: 100%; }
      }
    `}</style>
    <div className='cv-left'><LeftPanel /></div>
    <div className='cv-wrap'>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <form ref={formRef} className='cv-card' onSubmit={submit} noValidate aria-busy={submitting || !ready}>
          <fieldset className='cv-root' disabled={!ready || submitting}>
            <div className='cv-progress'>
              <div><p className='cv-eyebrow'>Profile Setup</p><p>{returning ? 'Profile complete' : 'Step 5 of 6'}</p></div>
              <div><p className='cv-eyebrow'>{returning ? 'Up to date' : '83% Complete'}</p><p>{returning ? 'Review or correct at any time' : 'Approximately 1 Minute'}</p></div>
            </div>
            <header>
              <h1>Coverage & Privacy</h1>
              <p className='cv-lede'>Tell us how you intend to fund care and confirm the required acknowledgements. You can correct these details later.</p>
            </header>
            <div role='status' className={`cv-pill${savedNotice ? ' saved' : ''}`}>
              <Ico p={savedNotice ? ICONS.check : ICONS.activity} size={11} sw={2} color='currentColor' />{pill}
            </div>

            {loadError && <div role='alert' className='cv-note danger'>
              <p>{loadError}</p>
              <button type='button' className='cv-inline-button' onClick={() => setReloadKey(n => n + 1)}>Try again</button>
            </div>}
            {returning && !savedNotice && <div className='cv-note'>
              <p><strong>Your profile is complete.</strong> Update your coverage or acknowledgements below and save. The required acknowledgements stay required.</p>
              <p><Link href='/patient/dashboard'>Continue to your dashboard</Link> without changes.</p>
            </div>}
            {savedNotice && <div role='status' className='cv-note'><p><strong>{savedNotice}</strong></p><p><Link href='/patient/dashboard'>Continue to your dashboard</Link></p></div>}
            {earlierStep && <div role='note' className='cv-note warn'>
              <p>Your {STEP_LABELS[earlierStep]} is not saved yet. You can fill in this step now, but your profile completes only after every step is saved.</p>
              <p><Link href={onboardingPath(earlierStep)}>Continue with {STEP_LABELS[earlierStep]}</Link></p>
            </div>}

            <ValidationSummary errors={shown} />
            {submitError && <div role='alert' className='cv-note danger'>
              <p>{submitError}</p>
              {conflict && <button type='button' className='cv-inline-button' onClick={reloadSaved}>Reload saved details</button>}
            </div>}

            <section className='cv-section' aria-labelledby='cv-funding-title'>
              <SectionHeader title='Funding' body='Choose how you intend to fund consultations. This records your preference; it is not an eligibility check.' />
              <fieldset className='cv-options' aria-invalid={!!shown.insurance_type || undefined} aria-describedby={shown.insurance_type ? 'coverage-type-error' : undefined}>
                <legend id='cv-funding-title'>Funding type (Required)</legend>
                <div className='cv-option-grid'>
                  {FUNDING_OPTIONS.map(option => <label key={option.value} className={`cv-option${form.insurance_type === option.value ? ' chosen' : ''}`}>
                    <input type='radio' name='funding-type' value={option.value} checked={form.insurance_type === option.value} onChange={() => update('insurance_type', option.value)} />
                    <strong>{option.label}</strong><span>{option.body}</span>
                  </label>)}
                </div>
                {shown.insurance_type && <p id='coverage-type-error' className='field-error' role='alert'>{shown.insurance_type}</p>}
              </fieldset>
              {form.insurance_type && <p className='cv-notice'>{form.insurance_type === 'SELF_PAY' ? SELF_PAY_NOTICE : INSURANCE_VERIFICATION_NOTICE}</p>}
              {form.insurance_type && form.insurance_type !== 'SELF_PAY' && <div className='cv-fields'>
                <TextField label='Insurance provider' value={form.provider} onChange={value => update('provider', value)} placeholder='Insurer name' hint='The full insurer name, at least 2 characters.' error={shown.provider} />
                <TextField label={form.insurance_type === 'GKV' ? 'Insurance number (KVNR)' : 'Private policy number'} value={form.insurance_number} onChange={value => update('insurance_number', value)}
                  hint={form.insurance_type === 'GKV' ? 'One capital letter followed by 9 digits. Only the format is checked, not your coverage.' : '3–50 characters: letters, numbers, spaces, slash, full stop or hyphen.'}
                  placeholder={form.insurance_type === 'GKV' ? 'A123456789' : 'As shown on your policy'} error={shown.insurance_number} />
              </div>}
            </section>

            <section className='cv-section' aria-labelledby='cv-acks-title'>
              <SectionHeader title='Acknowledgements' body='Required before you can use the platform, and kept on record with the date you gave them.' />
              <fieldset className='cv-acks' style={{ margin: 0, minWidth: 0 }}>
                <legend id='cv-acks-title' style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '0 4px' }}>Development test acknowledgements</legend>
                <p>The legal documents are drafts awaiting company details, technical alignment and legal approval. These acknowledgements are not consent to process real patient information. Do not enter real medical or insurance details.</p>
                {TEST_ACKNOWLEDGEMENTS.map(([key, label]) => {
                  const missing = submitted && !form.consents[key]
                  return <label key={key} className='cv-check'>
                    <input type='checkbox' required aria-invalid={missing} aria-describedby={missing ? `ack-${key}-error` : undefined} checked={form.consents[key]}
                      onChange={event => update('consents', { ...form.consents, [key]: event.target.checked })} />
                    <span>{label} <strong>(Required)</strong>{missing && <span id={`ack-${key}-error`} role='alert' className='field-error'>Confirm this acknowledgement to continue.</span>}</span>
                  </label>
                })}
              </fieldset>
              <label className='cv-check cv-optional'>
                <input type='checkbox' checked={form.consents.marketing} onChange={event => update('consents', { ...form.consents, marketing: event.target.checked })} />
                <span>Test the optional marketing preference. This stores a preference for this test account. (Optional)</span>
              </label>
            </section>

            <div className='cv-actions'>
              <div className='cv-secondary-links'>
                <Link className='cv-link' href='/auth/profile-setup/medical-history-allergies'>Back</Link>
                {ready && !loadError && <button type='button' className='cv-link' style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer', minHeight: 44 }} onClick={reloadSaved}>Discard changes</button>}
              </div>
              <button type='submit' className='cv-submit' disabled={submitting || !ready}>{submitting ? 'Saving…' : returning ? 'Save changes' : 'Complete Profile'}</button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  </main>
}

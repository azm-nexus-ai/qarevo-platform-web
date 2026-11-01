'use client'
import { useEffect, useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PAGE_BG, T } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'
import { getApiErrorDetail } from '@/lib/api'
import { createAccountDraftStorage } from '@/lib/account-storage'
import { hydrateAccountDraft } from '@/lib/hydrate-account-draft'
import { getOnboarding, saveCoverageInformation, onboardingPath, type CoverageInformation } from '@/lib/patient-onboarding'
const LEFT_BG = `radial-gradient(ellipse at top left, rgba(32,181,223,.3), transparent 60%), ${T.navy}`
const STORAGE_KEY = 'qarevo.onboarding.insurance-privacy-consent.v2'
type CoverageForm = Omit<CoverageInformation, 'insurance_type'> & { insurance_type: CoverageInformation['insurance_type'] | '' }
const INITIAL_FORM: CoverageForm = { insurance_type: '', provider: '', insurance_number: '', consents: { terms: false, privacy: false, health: false, telemedicine: false, marketing: false } }
const TEST_ACKNOWLEDGEMENTS = [
  ['terms', 'I understand that the patient terms are still awaiting approval.'],
  ['privacy', 'I understand that the privacy notice is still awaiting approval.'],
  ['health', 'I am using synthetic test information only.'],
  ['telemedicine', 'I understand that this development flow does not authorise real medical care.'],
] as const
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
            We only ask for the information needed to verify coverage, protect your records, and deliver safe digital healthcare.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Saved Preferences', sub: 'Your choices are saved to your account' },
          { icon: ICONS.shield, label: 'Trusted Access', sub: 'Only authorized care teams can review it' },
          { icon: ICONS.check, label: 'Coverage Flexibility', sub: 'Add insurance now or later from your profile' },
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

function TextField({ label, value, onChange, placeholder, error, optional }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; error?: string; optional?: boolean }) {
  const id = useId()
  const [focused, setFocused] = useState(false)

  const border = error ? 'rgba(220,38,38,0.55)' : focused ? 'rgba(32,181,223,0.45)' : 'rgba(4,53,77,0.1)'
  const background = error ? '#FFF5F5' : focused ? '#fff' : 'rgba(255,255,255,0.78)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
        {label} {optional ? <span style={{ color: T.slate2, fontWeight: 500 }}>(Optional)</span> : <span>(Required)</span>}
      </label>
      <input
        id={id}
        required={!optional}
        aria-invalid={!!error}
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
      {error ? <p style={{ margin: 0, fontSize: "13px", color: T.red, lineHeight: 1.45 }}>{error}</p> : null}
    </div>
  )
}


export default function InsurancePrivacyConsentPage() {
  const router = useRouter()
  const [draftStorage] = useState(createAccountDraftStorage)
  const [form, setForm] = useState<CoverageForm>(INITIAL_FORM)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [saveMessage, setSaveMessage] = useState('Draft autosaves in this tab')
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(form)
  useEffect(() => hydrateAccountDraft<CoverageForm>(draftStorage, STORAGE_KEY, async () => (await getOnboarding()).coverage || {},
    data => setForm({ ...INITIAL_FORM, ...data, consents: { ...INITIAL_FORM.consents, ...data.consents } }),
    error => setSubmitError(getApiErrorDetail(error) || 'Could not load your coverage information. Reload to try again.'),
    () => setReady(true)), [draftStorage])
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      try { draftStorage.setItem(STORAGE_KEY, JSON.stringify(form)); setSaveMessage('Draft saved in this tab') }
      catch { setSaveMessage('Could not autosave right now') }
    }, 320)
    return () => window.clearTimeout(timer)
  }, [form, draftStorage, ready])
  const update = <K extends keyof CoverageForm>(key: K, value: CoverageForm[K]) => setForm(previous => ({ ...previous, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const saved = await saveCoverageInformation({ ...form, insurance_type: form.insurance_type as CoverageInformation['insurance_type'] })
      if (!saved.complete) {
        setSubmitError('An earlier profile step still needs to be saved. Use “Continue profile” below to return to it.')
        setMissingStep(saved.next_step)
        return
      }
      setOnboardingStage('profile-completed')
      router.push('/auth/profile-setup/profile-completed')
    } catch (error) { setSubmitError(getApiErrorDetail(error) || 'Could not save your coverage information. Please try again.') }
    finally { setSubmitting(false) }
  }
  const [missingStep, setMissingStep] = useState<Parameters<typeof onboardingPath>[0]>(null)
  return <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
    <style>{`.coverage-left { display: block; } .coverage-main { padding: 36px; flex: 1; min-width: 0; } .coverage-field:focus-visible { outline: 3px solid #348CEA; outline-offset: 3px; } @media(max-width:1000px){.coverage-left{display:none}.coverage-main{padding:20px}}`}</style>
    <div className='coverage-left'><LeftPanel /></div>
    <section className='coverage-main'>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <ProfileSetupLogo />
        <p style={{ color: T.slate, margin: '24px 0 8px' }}>Profile setup · Coverage & privacy</p>
        <h1 style={{ color: T.navy, fontSize: 30, margin: '0 0 12px' }}>Your coverage, clearly recorded</h1>
        <p style={{ color: T.slate, lineHeight: 1.7 }}>Choose how you intend to fund care. Saving insurance information does not verify eligibility, arrange payment, or confirm reimbursement.</p>
        <form onSubmit={submit} noValidate style={{ background: 'rgba(255,255,255,.92)', borderRadius: 24, padding: 28, boxShadow: '0 18px 48px rgba(4,53,77,.08)' }}>
          <p role='status' style={{ color: T.slate2, fontSize: 13 }}>{ready ? saveMessage : 'Loading your saved coverage…'}</p>
          {submitError && <p role='alert' style={{ color: T.red }}>{submitError}</p>}
          {missingStep && <Link href={onboardingPath(missingStep)}>Continue profile</Link>}
          <fieldset disabled={!ready || submitting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <label htmlFor='coverage-type' style={{ display: 'block', color: T.navy, fontWeight: 700, marginBottom: 8 }}>Funding type (Required)</label>
            <select id='coverage-type' className='coverage-field' required value={form.insurance_type} onChange={event => update('insurance_type', event.target.value as CoverageForm['insurance_type'])} style={{ width: '100%', minHeight: 48, padding: 12, border: '1px solid #B8CBD5', borderRadius: 12, color: T.navy, background: "var(--surface)" }}>
              <option value=''>Select a funding type</option><option value='SELF_PAY'>Self-pay</option><option value='GKV'>Statutory insurance (GKV)</option><option value='PKV'>Private insurance (PKV)</option>
            </select>
            {submitted && errors.insurance_type && <p role='alert'>{errors.insurance_type}</p>}
            {form.insurance_type && form.insurance_type !== 'SELF_PAY' && <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <TextField label='Insurance provider' value={form.provider} onChange={value => update('provider', value)} placeholder='Insurer name' error={submitted ? errors.provider : undefined} />
              <TextField label={form.insurance_type === 'GKV' ? 'Insurance number (KVNR)' : 'Private policy number'} value={form.insurance_number} onChange={value => update('insurance_number', value)} placeholder={form.insurance_type === 'GKV' ? 'One capital letter and nine digits' : 'As shown on your policy'} error={submitted ? errors.insurance_number : undefined} />
              <p style={{ color: T.slate, fontSize: 13, lineHeight: 1.6 }}>We check the format of your entry. Coverage, provider participation, and reimbursement still require confirmation before treatment.</p>
            </div>}
            <section style={{ marginTop: 24, padding: 18, background: '#FFF8EB', border: '1px solid #E7CE99', borderRadius: 14 }}>
              <h2 style={{ fontSize: 18, marginTop: 0, color: T.navy }}>Development test acknowledgements</h2>
              <p style={{ color: T.slate, lineHeight: 1.7 }}>The supplied legal documents are drafts awaiting company details, technical alignment, and legal approval. These test acknowledgements are not consent for processing real patient information. Do not enter real medical or insurance details.</p>
              {TEST_ACKNOWLEDGEMENTS.map(([key, label]) => <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, color: T.navy, lineHeight: 1.6 }}><input type='checkbox' required checked={form.consents[key]} onChange={event => update('consents', { ...form.consents, [key]: event.target.checked })} style={{ marginTop: 6 }} /><span>{label} <strong>(Required)</strong></span></label>)}
              {submitted && errors.consents && <p role='alert' style={{ color: T.red }}>{errors.consents}</p>}
            </section>
            <label style={{ display: 'flex', gap: 10, margin: '20px 0', color: T.slate, lineHeight: 1.6 }}><input type='checkbox' checked={form.consents.marketing} onChange={event => update('consents', { ...form.consents, marketing: event.target.checked })} /><span>Test the optional marketing preference. This stores a preference for this test account. (Optional)</span></label>
            <button type='submit' disabled={submitting || !ready} style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 12, background: T.blue, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{submitting ? 'Saving profile…' : 'Complete Profile'}</button>
            <Link href='/auth/profile-setup/medical-history-allergies' style={{ display: 'block', textAlign: 'center', marginTop: 18, color: T.slate }}>Back</Link>
          </fieldset>
        </form>
      </div>
    </section>
  </main>
}

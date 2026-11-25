'use client'

import { useLocale, useTranslations } from 'next-intl'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import { readAccountScope } from '@/lib/account-storage'
import {
  clearPortalSession,
  getDoctorProfile,
  isAuthError,
  readSessionMarker,
  updateDoctorProfile,
  getDoctorConsultationServices,
  createDoctorConsultationService,
  updateDoctorConsultationService,
  deleteDoctorConsultationService,
  type DoctorProfileUpdate,
  type DoctorProfileResponse,
  type ConsultationService,
  type ConsultationServiceCreate,
  type ConsultationServiceUpdate,
} from '@/lib/api'

type ProfileDraft = {
  phone: string
  specialty: string
  experience_years: string
  license_number: string
  is_independent: boolean
  address: string
  address_line2: string
  city: string
  state: string
  country: string
  zip: string
  hospital: string
  languages: string
  about: string
  education: string
  certifications: string
  insurance: string
  avatar_url: string
  avatar_file: File | null
  working_hours_start: string
  working_hours_end: string
  available_days: string
  timezone: string
  appointment_duration: string
}

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
]

function createProfileDraft(profile: DoctorProfileResponse): ProfileDraft {
  return {
    phone: profile.phone || '',
    specialty: profile.specialty || '',
    experience_years: profile.experience_years == null ? '' : String(profile.experience_years),
    license_number: profile.license_number || '',
    is_independent: Boolean(profile.is_independent),
    address: profile.address || '',
    address_line2: profile.address_line2 || '',
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || '',
    zip: profile.zip || '',
    hospital: profile.hospital || '',
    languages: profile.languages || '',
    about: profile.about || '',
    education: profile.education || '',
    certifications: profile.certifications || '',
    insurance: profile.insurance || '',
    avatar_url: profile.avatar_url || '',
    avatar_file: null,
    working_hours_start: profile.working_hours_start || '09:00',
    working_hours_end: profile.working_hours_end || '17:00',
    available_days: profile.available_days || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
    timezone: profile.timezone || 'UTC',
    appointment_duration: profile.appointment_duration == null ? '30' : String(profile.appointment_duration),
  }
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toOptionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

interface ConsultationServiceFormProps {
  service: ConsultationService | null
  onSave: (data: ConsultationServiceCreate | ConsultationServiceUpdate) => void
  onCancel: () => void
}

function ConsultationServiceForm({ service, onSave, onCancel }: ConsultationServiceFormProps) {
  const t = useTranslations('doctorProfile');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [serviceType, setServiceType] = useState(service?.service_type || 'video')
  const [name, setName] = useState(service?.name || '')
  const [price, setPrice] = useState(service?.price?.toString() || '')
  const [duration, setDuration] = useState(service?.duration?.toString() || '30')
  const [availability, setAvailability] = useState(service?.availability || '')
  const [description, setDescription] = useState(service?.description || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 200) errors.name = t('extra.serviceNameError')
    if (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price))) errors.price = t('priceWholeEuros')
    if (!/^\d+$/.test(duration) || !Number.isSafeInteger(Number(duration)) || Number(duration) < 5) errors.duration = t('extra.minutesError')
    setFormErrors(errors)
    if (Object.keys(errors).length) { focusValidation(e.currentTarget); return }
    const data: ConsultationServiceCreate | ConsultationServiceUpdate = {
      service_type: serviceType,
      name,
      price: parseInt(price, 10),
      duration: parseInt(duration, 10),
      availability: availability || undefined,
      description: description || undefined,
    }
    onSave(data)
  }

  const inputStyle = {
    width: '100%',
    minHeight: '42px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: "1px solid var(--border)",
    background: "var(--surface-glass)",
    color: T.navy,
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: "13px",
    fontWeight: 700,
    color: T.slate2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <form noValidate onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
      <ValidationSummary errors={formErrors} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div>
          <label style={labelStyle}>{t('serviceType')}</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            style={inputStyle}
          >
            <option value="video">{t('videoConsultation')}</option>
            <option value="physical">{t('inPersonConsultation')}</option>
            <option value="phone">{t('phoneConsultation')}</option>
            <option value="chat">{t('chatConsultation')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="service-name" style={labelStyle}>{t('serviceNameRequired')}</label>
          <input
            type="text"
            id="service-name" aria-invalid={!!formErrors.name} aria-describedby={formErrors.name ? "service-name-error" : undefined}
            value={name}
            onChange={(e) => { setName(e.target.value); setFormErrors(previous => ({ ...previous, name: "" })) } }
            placeholder={t('eGGeneralVideoConsultation')}
            style={inputStyle}
            required
          />
          <FieldFeedback name="service-name" error={formErrors.name} />
        </div>
        <div>
          <label htmlFor="service-price" style={labelStyle}>{t('priceRequired')}</label>
          <input
            type="number"
            min="0"
            id="service-price" aria-invalid={!!formErrors.price} aria-describedby={formErrors.price ? "service-price-error" : undefined}
            value={price}
            onChange={(e) => { setPrice(e.target.value); setFormErrors(previous => ({ ...previous, price: "" })) } }
            placeholder="140"
            style={inputStyle}
            required
          />
          <FieldFeedback name="service-price" error={formErrors.price} />
        </div>
        <div>
          <label htmlFor="service-duration" style={labelStyle}>{t('durationMinRequired')}</label>
          <input
            type="number"
            min="5"
            id="service-duration" aria-invalid={!!formErrors.duration} aria-describedby={formErrors.duration ? "service-duration-error" : undefined}
            value={duration}
            onChange={(e) => { setDuration(e.target.value); setFormErrors(previous => ({ ...previous, duration: "" })) } }
            placeholder="30"
            style={inputStyle}
            required
          />
          <FieldFeedback name="service-duration" error={formErrors.duration} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('availability')}</label>
        <input
          type="text"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          placeholder={t('eGTodayTomorrowMon')}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t('description')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('briefDescriptionOfThisService')}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
        >
          {service ? t('extra.updateService') : t('extra.addService')}
        </button>
      </div>
    </form>
  )
}

export default function DoctorProfilePage() {
  const t = useTranslations('doctorProfile');
  const euro = new Intl.NumberFormat(useLocale() === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR" })
  const router = useRouter()
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null)
  const [profileOwner, setProfileOwner] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [consultationServices, setConsultationServices] = useState<ConsultationService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [editingService, setEditingService] = useState<ConsultationService | null>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false
    const scope = readAccountScope('doctor')

    const fetchProfile = async () => {
      try {
        const [profile, services] = await Promise.all([
          getDoctorProfile(),
          getDoctorConsultationServices(),
        ])
        if (!cancelled && scope === readAccountScope('doctor')) {
          setProfileData(profile)
          setProfileOwner(scope)
          setDraft(createProfileDraft(profile))
          setConsultationServices(services)
          setError(null)
        }
      } catch (err) {
        if (cancelled || scope !== readAccountScope('doctor')) return
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        console.error(t('extra.loadFailedTech'), err)
        if (!cancelled) setError(t('extra.loadFailed'))
      } finally {
        if (!cancelled && scope === readAccountScope('doctor')) setLoading(false)
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [router, t])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>{t('loadingProfile')}</p>
      </div>
    )
  }

  if (error) {
    return <div style={{ background: "var(--surface-glass)", border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>{error}</div>
  }

  if (!profileData) return null
  if (!draft) return null

  const profileName = profileData.full_name || t('extra.doctor')
  const displayName = profileName.toLowerCase().startsWith('dr.') ? profileName : `Dr. ${profileName}`

  const updateDraft = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setSaveMessage(null)
    setSaveError(null)
    setHasUnsavedChanges(true)
  }

  const saveProfile = async () => {
    if (!profileOwner || profileOwner !== readAccountScope('doctor')) {
      setSaveError(t('extra.sessionChanged'))
      return
    }
    setSaving(true)
    setSaveMessage(null)
    setSaveError(null)

    let avatarUrl = draft.avatar_url

    // Handle file upload by converting to base64
    if (draft.avatar_file) {
      try {
        const reader = new FileReader()
        avatarUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            resolve(result)
          }
          reader.onerror = reject
          reader.readAsDataURL(draft.avatar_file!)
        })
      } catch (err) {
        console.error(t('extra.avatarReadFailed'), err)
        setSaveError(t('extra.avatarFailed'))
        setSaving(false)
        return
      }
    }

    const payload: DoctorProfileUpdate = {
      phone: toOptionalString(draft.phone),
      specialty: toOptionalString(draft.specialty),
      experience_years: toOptionalNumber(draft.experience_years),
      license_number: toOptionalString(draft.license_number),
      is_independent: draft.is_independent,
      address: toOptionalString(draft.address),
      address_line2: toOptionalString(draft.address_line2),
      city: toOptionalString(draft.city),
      state: toOptionalString(draft.state),
      country: toOptionalString(draft.country),
      zip: toOptionalString(draft.zip),
      hospital: toOptionalString(draft.hospital),
      languages: toOptionalString(draft.languages),
      about: toOptionalString(draft.about),
      education: toOptionalString(draft.education),
      certifications: toOptionalString(draft.certifications),
      insurance: toOptionalString(draft.insurance),
      avatar_url: toOptionalString(avatarUrl),
      working_hours_start: toOptionalString(draft.working_hours_start),
      working_hours_end: toOptionalString(draft.working_hours_end),
      available_days: toOptionalString(draft.available_days),
      timezone: toOptionalString(draft.timezone),
      appointment_duration: toOptionalNumber(draft.appointment_duration),
    }

    try {
      if (profileOwner !== readAccountScope('doctor')) return
      const saved = await updateDoctorProfile(payload)
      if (profileOwner !== readAccountScope('doctor')) return
      setProfileData(saved)
      setDraft(createProfileDraft(saved))
      setSaveMessage(t('extra.updated'))
      setHasUnsavedChanges(false)
      // Auto-dismiss success message after 4 seconds
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err) {
      if (profileOwner !== readAccountScope('doctor')) return
      if (isAuthError(err)) {
        clearPortalSession()
        router.replace('/auth/doctor/login')
        return
      }
      console.error(t('extra.saveFailedTech'), err)
      setSaveError(t('extra.saveFailed'))
      // Auto-dismiss error message after 6 seconds
      setTimeout(() => setSaveError(null), 6000)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    minHeight: '42px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: "1px solid var(--border)",
    background: "var(--surface-glass)",
    color: T.navy,
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: "13px",
    fontWeight: 700,
    color: T.slate2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, overflowWrap: 'anywhere' }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{t('profile')}</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>{t('manageYourDoctorProfileInformation')}</p>
      </div>

      {/* Profile Card */}
      <div style={{
        background: "var(--surface-glass)",
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: "1px solid var(--border)",
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '32px', paddingBottom: '32px', borderBottom: "1px solid var(--border)", flexWrap: 'wrap' }}>
          <ProfileAvatar name={displayName} src={profileData.avatar_url} size={100} kind='doctor' />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{displayName}</h2>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: T.slate2 }}>{profileData.specialty || t('extra.generalPractice')} · {profileData.hospital || t('extra.virtualClinic')}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,158,119,0.12)', color: T.green, fontSize: "13px", fontWeight: 700 }}>
                {profileData.license_verified ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: T.link, fontSize: "13px", fontWeight: 700 }}>
                {profileData.experience_years ?? 0} YEARS EXPERIENCE
              </span>
            </div>
          </div>
          <button onClick={() => document.getElementById('doctor-profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: '12px 20px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {t('editProfile')}
          </button>
        </div>

        {/* Profile Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('specialty')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.specialty || t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('licenseNumber')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.license_number || t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('email')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.email}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('phone')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.phone || t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('location')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.city && profileData.state ? `${profileData.city}, ${profileData.state}` : t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('languages')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.languages || t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('certifications')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.certifications || t('extra.notProvided')}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('insuranceAccepted')}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.insurance || t('extra.notProvided')}</p>
          </div>
        </div>
      </div>

      <div id="doctor-profile-editor" style={{
        background: "var(--surface-glass)",
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: "1px solid var(--border)",
        boxShadow: Sh.card,
        padding: '28px',
        scrollMarginTop: '96px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{t('professionalProfile')}</h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate2, lineHeight: 1.6 }}>{t('completeTheClinicalProfilePatients')}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={saveProfile}
            style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.72 : 1, whiteSpace: 'nowrap' }}
          >
            {saving ? t('extra.saving') : t('extra.saveProfile')}
          </button>
        </div>

        {saveMessage && <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: T.green }}>{saveMessage}</p>}
        {saveError && <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: T.red }}>{saveError}</p>}

        {hasUnsavedChanges && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            maxWidth: 'calc(100vw - 48px)',
            flexWrap: 'wrap',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: "var(--surface-glass)",
            backdropFilter: 'blur(10px)',
            border: "1px solid var(--border)",
            boxShadow: '0 8px 32px rgba(4,53,77,0.15)',
            animation: 'slideIn 0.3s ease'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: T.navy }}>{t('youHaveUnsavedChanges')}</span>
            <button
              type="button"
              disabled={saving}
              onClick={saveProfile}
              style={{ minHeight: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: "13px", fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.72 : 1, whiteSpace: 'nowrap' }}
            >
              {saving ? t('extra.saving') : t('extra.saveNow')}
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('specialty')}</label>
            <input value={draft.specialty} onChange={(event) => updateDraft('specialty', event.target.value)} placeholder={t('cardiology')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('licenseNumber')}</label>
            <input value={draft.license_number} onChange={(event) => updateDraft('license_number', event.target.value)} placeholder={t('medicalLicenseNumber')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('yearsOfExperience')}</label>
            <input type="number" min="0" value={draft.experience_years} onChange={(event) => updateDraft('experience_years', event.target.value)} placeholder="5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('hospitalOrPractice')}</label>
            <input value={draft.hospital} onChange={(event) => updateDraft('hospital', event.target.value)} placeholder={t('qarevoVirtualClinic')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('languages')}</label>
            <input value={draft.languages} onChange={(event) => updateDraft('languages', event.target.value)} placeholder={t('englishGerman')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('phone')}</label>
            <input type="tel" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} placeholder="+49..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('practiceType')}</label>
            <button
              type="button"
              onClick={() => updateDraft('is_independent', !draft.is_independent)}
              style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
            >
              <span>{draft.is_independent ? t('extra.independent') : t('extra.affiliated')}</span>
              <span style={{ width: '36px', height: '20px', borderRadius: '999px', background: draft.is_independent ? T.green : "var(--surface-hover)", position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: "var(--surface)", position: 'absolute', top: '2px', left: draft.is_independent ? '18px' : '2px', transition: 'left 0.15s ease' }} />
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>{t('address')}</label>
            <input value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} placeholder={t('streetAddress')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('addressLine2')}</label>
            <input value={draft.address_line2} onChange={(event) => updateDraft('address_line2', event.target.value)} placeholder={t('suiteOrFloor')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('city')}</label>
            <input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} placeholder="Berlin" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('stateOrRegion')}</label>
            <input value={draft.state} onChange={(event) => updateDraft('state', event.target.value)} placeholder="Berlin" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('country')}</label>
            <input value={draft.country} onChange={(event) => updateDraft('country', event.target.value)} placeholder={t('germany')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('postalCode')}</label>
            <input value={draft.zip} onChange={(event) => updateDraft('zip', event.target.value)} placeholder="10115" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>{t('bio')}</label>
            <textarea value={draft.about} onChange={(event) => updateDraft('about', event.target.value)} placeholder={t('briefClinicalBackgroundAndCare')} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>{t('education')}</label>
            <textarea value={draft.education} onChange={(event) => updateDraft('education', event.target.value)} placeholder={t('medicalSchoolResidencyFellowships')} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>{t('certifications')}</label>
            <textarea value={draft.certifications} onChange={(event) => updateDraft('certifications', event.target.value)} placeholder={t('boardCertificationsAndCredentials')} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>{t('insuranceAccepted')}</label>
            <textarea value={draft.insurance} onChange={(event) => updateDraft('insurance', event.target.value)} placeholder={t('axaBupaCignaEtc')} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>{t('profilePicture')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={saving}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setAvatarError('')
                  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) {
                    setAvatarError(t('extra.imageHint'))
                    setDraft(current => current ? { ...current, avatar_file: null } : current)
                    event.target.value = ''
                    return
                  }
                  setDraft((current) => current ? { ...current, avatar_file: file } : current)
                  if (file) setHasUnsavedChanges(true)
                  setSaveMessage(null)
                  setSaveError(null)
                }}
                aria-describedby='doctor-avatar-help doctor-avatar-error'
                style={{ display: 'none' }}
                id="avatar-upload"
              />
              <button
                type='button'
                disabled={saving}
                onClick={() => document.getElementById('avatar-upload')?.click()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: "1px solid var(--border)",
                  background: "var(--surface-glass)",
                  color: T.navy,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {draft.avatar_file ? t('extra.changePicture') : t('extra.uploadPicture')}
              </button>
              {draft.avatar_file && (
                <span style={{ fontSize: "13px", color: T.slate2 }}>{draft.avatar_file.name}</span>
              )}
            </div>
            <p id='doctor-avatar-help' className='field-hint'>{t('jpegPngOrWebpUp')}</p>
            <p id='doctor-avatar-error' className='field-error' role={avatarError ? 'alert' : undefined}>{avatarError}</p>
          </div>
        </div>
      </div>

      <div style={{
        background: "var(--surface-glass)",
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: "1px solid var(--border)",
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>{t('availabilitySettings')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('workingHoursStart')}</label>
            <input value={draft.working_hours_start} onChange={(event) => updateDraft('working_hours_start', event.target.value)} placeholder="09:00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('workingHoursEnd')}</label>
            <input value={draft.working_hours_end} onChange={(event) => updateDraft('working_hours_end', event.target.value)} placeholder="17:00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('availableDays')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginTop: '8px' }}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = draft.available_days.split(',').includes(day.value)
                return (
                  <label
                    key={day.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isSelected ? `2px solid ${T.blue}` : "1px solid var(--border)",
                      background: isSelected ? 'rgba(32,181,223,0.08)' : "var(--surface-glass)",
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      color: T.navy,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const currentDays = draft.available_days.split(',').filter(d => d)
                        if (e.target.checked) {
                          updateDraft('available_days', [...currentDays, day.value].join(','))
                        } else {
                          updateDraft('available_days', currentDays.filter(d => d !== day.value).join(','))
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    {t(`extra.day.${day.value}`)}
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('timezone')}</label>
            <input value={draft.timezone} onChange={(event) => updateDraft('timezone', event.target.value)} placeholder="UTC" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('appointmentDurationMin')}</label>
            <input value={draft.appointment_duration} onChange={(event) => updateDraft('appointment_duration', event.target.value)} placeholder="30" style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={{
        background: "var(--surface-glass)",
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: "1px solid var(--border)",
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>{t('consultationServices')}</h3>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate2 }}>{t('manageIndividualPricingDurationAnd')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingService(null)
              setShowServiceForm(true)
            }}
            style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
          >
            {t('addService')}
          </button>
        </div>

        {showServiceForm && (
          <div style={{ background: "var(--surface-glass)", borderRadius: '14px', border: "1px solid var(--border)", padding: '20px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: T.navy }}>
              {editingService ? t('extra.editService') : t('extra.addNewService')}
            </h4>
            <ConsultationServiceForm
              service={editingService}
              onSave={async (data) => {
                try {
                  if (editingService) {
                    const updated = await updateDoctorConsultationService(editingService.id, data)
                    setConsultationServices(services => services.map(s => s.id === updated.id ? updated : s))
                  } else {
                    const created = await createDoctorConsultationService(data as ConsultationServiceCreate)
                    setConsultationServices(services => [...services, created])
                  }
                  setShowServiceForm(false)
                  setEditingService(null)
                  setSaveMessage(editingService ? t('extra.serviceUpdated') : t('extra.serviceAdded'))
                } catch (err) {
                  console.error(t('extra.serviceSaveFailedTech'), err)
                  setSaveError(t('extra.serviceSaveFailed'))
                }
              }}
              onCancel={() => {
                setShowServiceForm(false)
                setEditingService(null)
              }}
            />
          </div>
        )}

        {consultationServices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: T.slate2, fontSize: '14px' }}>
            No consultation services configured yet. Click &quot;Add Service&quot; to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {consultationServices.map((service) => (
              <div
                key={service.id}
                style={{
                  background: "var(--surface-glass)",
                  borderRadius: '12px',
                  border: "1px solid var(--border)",
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: T.navy }}>{service.name}</p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                    {t('type')} <span style={{ fontWeight: 600 }}>{service.service_type}</span>
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                    {t('price')} <span style={{ fontWeight: 600 }}>{euro.format(service.price)}</span> {t('duration')} <span style={{ fontWeight: 600 }}>{service.duration} min</span>
                  </p>
                  {service.availability && (
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                      {t('availability2')} <span style={{ fontWeight: 600 }}>{service.availability}</span>
                    </p>
                  )}
                  {service.description && (
                    <p style={{ margin: '0', fontSize: "13px", color: T.slate2 }}>{service.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingService(service)
                      setShowServiceForm(true)
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: "13px", fontWeight: 600, cursor: 'pointer' }}
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(t('extra.deleteConfirm'))) {
                        try {
                          await deleteDoctorConsultationService(service.id)
                          setConsultationServices(services => services.filter(s => s.id !== service.id))
                          setSaveMessage(t('extra.serviceDeleted'))
                        } catch (err) {
                          console.error(t('extra.serviceDeleteFailedTech'), err)
                          setSaveError(t('extra.serviceDeleteFailed'))
                        }
                      }
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)', background: "var(--surface-glass)", color: T.red, fontSize: "13px", fontWeight: 600, cursor: 'pointer' }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('totalConsultations')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{profileData.total_consultations}</p>
        </div>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('patientRating')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.green }}>{profileData.patient_rating}</p>
        </div>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('yearsActive')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.link }}>{profileData.years_active}</p>
        </div>
      </div>
    </div>
  )
}

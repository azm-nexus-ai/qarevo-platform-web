'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  clearAuthTokens,
  getDoctorProfile,
  isAuthError,
  readAccessToken,
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
  const [serviceType, setServiceType] = useState(service?.service_type || 'video')
  const [name, setName] = useState(service?.name || '')
  const [price, setPrice] = useState(service?.price?.toString() || '')
  const [duration, setDuration] = useState(service?.duration?.toString() || '30')
  const [availability, setAvailability] = useState(service?.availability || '')
  const [description, setDescription] = useState(service?.description || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
    border: '1px solid rgba(4,53,77,0.12)',
    background: 'rgba(255,255,255,0.92)',
    color: T.navy,
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: T.slate2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Service Type</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            style={inputStyle}
          >
            <option value="video">Video Consultation</option>
            <option value="physical">In-Person Consultation</option>
            <option value="phone">Phone Consultation</option>
            <option value="chat">Chat Consultation</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Service Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., General Video Consultation"
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Price ($)</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="140"
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Duration (min)</label>
          <input
            type="number"
            min="5"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            style={inputStyle}
            required
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Availability</label>
        <input
          type="text"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          placeholder="e.g., Today, Tomorrow, Mon-Fri"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this service"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
        >
          {service ? 'Update Service' : 'Add Service'}
        </button>
      </div>
    </form>
  )
}

export default function DoctorProfilePage() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [consultationServices, setConsultationServices] = useState<ConsultationService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingService, setEditingService] = useState<ConsultationService | null>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false

    const fetchProfile = async () => {
      try {
        const [profile, services] = await Promise.all([
          getDoctorProfile(),
          getDoctorConsultationServices(),
        ])
        if (!cancelled) {
          setProfileData(profile)
          setDraft(createProfileDraft(profile))
          setConsultationServices(services)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor profile', err)
        if (!cancelled) setError('Unable to load profile right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading profile...</p>
      </div>
    )
  }

  if (error) {
    return <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>{error}</div>
  }

  if (!profileData) return null
  if (!draft) return null

  const profileName = profileData.full_name || 'Doctor'
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'DR'
  const displayName = profileName.toLowerCase().startsWith('dr.') ? profileName : `Dr. ${profileName}`

  const updateDraft = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setSaveMessage(null)
    setSaveError(null)
    setHasUnsavedChanges(true)
  }

  const saveProfile = async () => {
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
        console.error('Failed to read avatar file', err)
        setSaveError('Unable to process profile picture.')
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
      const saved = await updateDoctorProfile(payload)
      setProfileData(saved)
      setDraft(createProfileDraft(saved))
      setSaveMessage('Professional profile updated.')
      setHasUnsavedChanges(false)
      // Auto-dismiss success message after 4 seconds
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      console.error('Failed to save doctor profile', err)
      setSaveError('Unable to save professional profile right now.')
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
    border: '1px solid rgba(4,53,77,0.12)',
    background: 'rgba(255,255,255,0.92)',
    color: T.navy,
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: T.slate2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Profile</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage your doctor profile information</p>
      </div>

      {/* Profile Card */}
      <div style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid rgba(4,53,77,0.06)' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '16px', overflow: 'hidden', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px', fontWeight: 800, boxShadow: '0 8px 24px rgba(32,181,223,0.3)' }}>
            {profileData.avatar_url ? (
              <img src={profileData.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              profileInitials
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{displayName}</h2>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: T.slate2 }}>{profileData.specialty || 'General Practice'} · {profileData.hospital || 'Qarevo Virtual Clinic'}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,158,119,0.12)', color: T.green, fontSize: '12px', fontWeight: 700 }}>
                {profileData.license_verified ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: T.blue, fontSize: '12px', fontWeight: 700 }}>
                {profileData.experience_years ?? 0} YEARS EXPERIENCE
              </span>
            </div>
          </div>
          <button onClick={() => document.getElementById('doctor-profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Edit Profile
          </button>
        </div>

        {/* Profile Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Specialty</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.specialty || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>License Number</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.license_number || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.email}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Phone</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.phone || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Location</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.city && profileData.state ? `${profileData.city}, ${profileData.state}` : 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Languages</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.languages || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Certifications</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.certifications || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Accepted</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.insurance || 'Not provided'}</p>
          </div>
        </div>
      </div>

      <div id="doctor-profile-editor" style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        padding: '28px',
        scrollMarginTop: '96px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Professional Profile</h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate2, lineHeight: 1.6 }}>Complete the clinical profile patients and care operations use for discovery, booking, and assignment.</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={saveProfile}
            style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.72 : 1, whiteSpace: 'nowrap' }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {saveMessage && <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: T.green }}>{saveMessage}</p>}
        {saveError && <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: T.red }}>{saveError}</p>}

        {hasUnsavedChanges && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(4,53,77,0.12)',
            boxShadow: '0 8px 32px rgba(4,53,77,0.15)',
            animation: 'slideIn 0.3s ease'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: T.navy }}>You have unsaved changes</span>
            <button
              type="button"
              disabled={saving}
              onClick={saveProfile}
              style={{ minHeight: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.72 : 1, whiteSpace: 'nowrap' }}
            >
              {saving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Specialty</label>
            <input value={draft.specialty} onChange={(event) => updateDraft('specialty', event.target.value)} placeholder="Cardiology" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>License Number</label>
            <input value={draft.license_number} onChange={(event) => updateDraft('license_number', event.target.value)} placeholder="Medical license number" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Years of Experience</label>
            <input type="number" min="0" value={draft.experience_years} onChange={(event) => updateDraft('experience_years', event.target.value)} placeholder="5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Hospital or Practice</label>
            <input value={draft.hospital} onChange={(event) => updateDraft('hospital', event.target.value)} placeholder="Qarevo Virtual Clinic" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Languages</label>
            <input value={draft.languages} onChange={(event) => updateDraft('languages', event.target.value)} placeholder="English, German" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input type="tel" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} placeholder="+49..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Practice Type</label>
            <button
              type="button"
              onClick={() => updateDraft('is_independent', !draft.is_independent)}
              style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
            >
              <span>{draft.is_independent ? 'Independent practitioner' : 'Clinic or hospital affiliated'}</span>
              <span style={{ width: '36px', height: '20px', borderRadius: '999px', background: draft.is_independent ? T.green : 'rgba(4,53,77,0.16)', position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: draft.is_independent ? '18px' : '2px', transition: 'left 0.15s ease' }} />
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Address</label>
            <input value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} placeholder="Street address" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Address Line 2</label>
            <input value={draft.address_line2} onChange={(event) => updateDraft('address_line2', event.target.value)} placeholder="Suite or floor" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} placeholder="Berlin" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>State or Region</label>
            <input value={draft.state} onChange={(event) => updateDraft('state', event.target.value)} placeholder="Berlin" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input value={draft.country} onChange={(event) => updateDraft('country', event.target.value)} placeholder="Germany" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Postal Code</label>
            <input value={draft.zip} onChange={(event) => updateDraft('zip', event.target.value)} placeholder="10115" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea value={draft.about} onChange={(event) => updateDraft('about', event.target.value)} placeholder="Brief clinical background and care philosophy" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>Education</label>
            <textarea value={draft.education} onChange={(event) => updateDraft('education', event.target.value)} placeholder="Medical school, residency, fellowships" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>Certifications</label>
            <textarea value={draft.certifications} onChange={(event) => updateDraft('certifications', event.target.value)} placeholder="Board certifications and credentials" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>Insurance Accepted</label>
            <textarea value={draft.insurance} onChange={(event) => updateDraft('insurance', event.target.value)} placeholder="Axa, Bupa, Cigna, etc." rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={labelStyle}>Profile Picture</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setDraft((current) => current ? { ...current, avatar_file: file } : current)
                  setSaveMessage(null)
                  setSaveError(null)
                }}
                style={{ display: 'none' }}
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(4,53,77,0.12)',
                  background: 'rgba(255,255,255,0.9)',
                  color: T.navy,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {draft.avatar_file ? 'Change Profile Picture' : 'Upload Profile Picture'}
              </label>
              {draft.avatar_file && (
                <span style={{ fontSize: '12px', color: T.slate2 }}>{draft.avatar_file.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>Availability Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Working Hours Start</label>
            <input value={draft.working_hours_start} onChange={(event) => updateDraft('working_hours_start', event.target.value)} placeholder="09:00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Working Hours End</label>
            <input value={draft.working_hours_end} onChange={(event) => updateDraft('working_hours_end', event.target.value)} placeholder="17:00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Available Days</label>
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
                      border: isSelected ? `2px solid ${T.blue}` : '1px solid rgba(4,53,77,0.12)',
                      background: isSelected ? 'rgba(32,181,223,0.08)' : 'rgba(255,255,255,0.9)',
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
                    {day.label}
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <input value={draft.timezone} onChange={(event) => updateDraft('timezone', event.target.value)} placeholder="UTC" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Appointment Duration (min)</label>
            <input value={draft.appointment_duration} onChange={(event) => updateDraft('appointment_duration', event.target.value)} placeholder="30" style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        padding: '32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: T.navy }}>Consultation Services</h3>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: T.slate2 }}>Manage individual pricing, duration, and availability for each consultation type.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingService(null)
              setShowServiceForm(true)
            }}
            style={{ minHeight: '42px', padding: '0 18px', borderRadius: '11px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
          >
            Add Service
          </button>
        </div>

        {showServiceForm && (
          <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', padding: '20px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: T.navy }}>
              {editingService ? 'Edit Service' : 'Add New Service'}
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
                  setSaveMessage(editingService ? 'Service updated.' : 'Service added.')
                } catch (err) {
                  console.error('Failed to save service', err)
                  setSaveError('Unable to save service.')
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
            No consultation services configured yet. Click "Add Service" to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {consultationServices.map((service) => (
              <div
                key={service.id}
                style={{
                  background: 'rgba(255,255,255,0.86)',
                  borderRadius: '12px',
                  border: '1px solid rgba(4,53,77,0.1)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: T.navy }}>{service.name}</p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                    Type: <span style={{ fontWeight: 600 }}>{service.service_type}</span>
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                    Price: <span style={{ fontWeight: 600 }}>${service.price}</span> · Duration: <span style={{ fontWeight: 600 }}>{service.duration} min</span>
                  </p>
                  {service.availability && (
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: T.slate }}>
                      Availability: <span style={{ fontWeight: 600 }}>{service.availability}</span>
                    </p>
                  )}
                  {service.description && (
                    <p style={{ margin: '0', fontSize: '12px', color: T.slate2 }}>{service.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingService(service)
                      setShowServiceForm(true)
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this service?')) {
                        try {
                          await deleteDoctorConsultationService(service.id)
                          setConsultationServices(services => services.filter(s => s.id !== service.id))
                          setSaveMessage('Service deleted.')
                        } catch (err) {
                          console.error('Failed to delete service', err)
                          setSaveError('Unable to delete service.')
                        }
                      }
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(255,255,255,0.9)', color: T.red, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete
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
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total Consultations</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{profileData.total_consultations}</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient Rating</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.green }}>{profileData.patient_rating}</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Years Active</p>
          <p style={{ margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.blue }}>{profileData.years_active}</p>
        </div>
      </div>
    </div>
  )
}

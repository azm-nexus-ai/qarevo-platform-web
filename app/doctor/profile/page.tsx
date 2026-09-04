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
  type DoctorProfileUpdate,
  type DoctorProfileResponse,
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
  consultation_fee: string
  hospital: string
  languages: string
  about: string
  education: string
  certifications: string
}

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
    consultation_fee: profile.consultation_fee == null ? '' : String(profile.consultation_fee),
    hospital: profile.hospital || '',
    languages: profile.languages || '',
    about: profile.about || '',
    education: profile.education || '',
    certifications: profile.certifications || '',
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

export default function DoctorProfilePage() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false

    const fetchProfile = async () => {
      try {
        const data = await getDoctorProfile()
        if (!cancelled) {
          setProfileData(data)
          setDraft(createProfileDraft(data))
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
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaveMessage(null)
    setSaveError(null)

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
      consultation_fee: toOptionalNumber(draft.consultation_fee),
      hospital: toOptionalString(draft.hospital),
      languages: toOptionalString(draft.languages),
      about: toOptionalString(draft.about),
      education: toOptionalString(draft.education),
      certifications: toOptionalString(draft.certifications),
    }

    try {
      const saved = await updateDoctorProfile(payload)
      setProfileData(saved)
      setDraft(createProfileDraft(saved))
      setSaveMessage('Professional profile updated.')
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      console.error('Failed to save doctor profile', err)
      setSaveError('Unable to save professional profile right now.')
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
          <div style={{ width: '100px', height: '100px', borderRadius: '16px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px', fontWeight: 800, boxShadow: '0 8px 24px rgba(32,181,223,0.3)' }}>
            {profileInitials}
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
            <label style={labelStyle}>Consultation Fee</label>
            <input type="number" min="0" value={draft.consultation_fee} onChange={(event) => updateDraft('consultation_fee', event.target.value)} placeholder="140" style={inputStyle} />
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
        </div>
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

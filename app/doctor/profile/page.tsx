'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  clearAuthTokens,
  getDoctorProfile,
  isAuthError,
  readAccessToken,
  type DoctorProfileResponse,
} from '@/lib/api'

export default function DoctorProfilePage() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    const fetchProfile = async () => {
      try {
        const data = await getDoctorProfile()
        if (!cancelled) {
          setProfileData(data)
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

  const profileName = profileData.full_name || 'Doctor'
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'DR'
  const displayName = profileName.toLowerCase().startsWith('dr.') ? profileName : `Dr. ${profileName}`

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
          <button onClick={() => router.push('/doctor/settings')} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
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

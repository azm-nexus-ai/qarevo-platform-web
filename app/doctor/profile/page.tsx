'use client'

import { useEffect, useState } from 'react'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

interface DoctorProfileData {
  user_id: string
  username: string
  email: string
  phone: string | null
  specialty: string
  experience_years: number
  license_number: string
  license_verified: boolean
  is_independent: boolean
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  total_consultations: number
  patient_rating: number
  years_active: number
}

const dummyProfileData: DoctorProfileData = {
  user_id: 'mock-doctor-id',
  username: 'david.smith',
  email: 'david.smith@qarevo.com',
  phone: '+1 555-0199',
  specialty: 'Cardiology',
  experience_years: 15,
  license_number: 'MD-12345-67890',
  license_verified: true,
  is_independent: true,
  address: '123 Medical Center Dr',
  city: 'New York',
  state: 'NY',
  country: 'USA',
  total_consultations: 1247,
  patient_rating: 4.9,
  years_active: 15
}

export default function DoctorProfilePage() {
  const [profileData, setProfileData] = useState<DoctorProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // TODO: Replace with actual provider ID from auth
        const providerId = 'mock-provider-id'
        const response = await fetch(`/api/v1/doctor/profile?provider_id=${providerId}`)
        if (response.ok) {
          const data = await response.json()
          setProfileData(data)
        } else {
          // Fall back to dummy data if API fails
          setProfileData(dummyProfileData)
        }
      } catch (error) {
        // Fall back to dummy data on error
        setProfileData(dummyProfileData)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading profile...</p>
      </div>
    )
  }

  if (!profileData) return null
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
            {profileData.username.split('.').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Dr. {profileData.username.split('.').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}</h2>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: T.slate2 }}>{profileData.specialty} · Qarevo Virtual Clinic</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,158,119,0.12)', color: T.green, fontSize: '12px', fontWeight: 700 }}>
                {profileData.license_verified ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
              <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: T.blue, fontSize: '12px', fontWeight: 700 }}>
                {profileData.experience_years} YEARS EXPERIENCE
              </span>
            </div>
          </div>
          <button style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Edit Profile
          </button>
        </div>

        {/* Profile Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Specialty</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.specialty}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>License Number</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{profileData.license_number}</p>
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
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>English, Spanish</p>
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

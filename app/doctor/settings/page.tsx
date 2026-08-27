'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { readDoctorAuthSession } from '@/lib/doctor-auth-session'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

interface DoctorSettingsData {
  user_id: string
  provider_id: string
  email: string | null
  phone: string | null
  email_notifications: boolean
  sms_notifications: boolean
  push_notifications: boolean
  weekly_reports: boolean
  working_hours_start: string
  working_hours_end: string
  available_days: string[]
  two_factor_enabled: boolean
}

export default function DoctorSettingsPage() {
  const router = useRouter()
  const [settingsData, setSettingsData] = useState<DoctorSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const session = readDoctorAuthSession()
        if (!session) {
          router.replace('/auth/doctor/login')
          return
        }
        const data = await apiGet<DoctorSettingsData>('/api/v1/doctor/settings/', {
          authToken: session.access_token,
        })
        setSettingsData(data)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading settings...</p>
      </div>
    )
  }

  if (error) {
    return <p style={{ color: T.red, fontSize: '14px' }}>{error}</p>
  }

  if (!settingsData) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage your account and preferences</p>
      </div>

      {/* Settings Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Account Settings */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico p={ICONS.user} size={20} sw={1.5} color={T.blue} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Account Settings</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Email Address</label>
              <input
                type="email"
                defaultValue={settingsData.email || ''}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Phone Number</label>
              <input
                type="tel"
                defaultValue={settingsData.phone || ''}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
              />
            </div>
            <button style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}>
              Update Account
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico p={ICONS.info} size={20} sw={1.5} color={T.amber} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Notifications</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Email notifications for new appointments', checked: settingsData.email_notifications },
              { label: 'SMS reminders for scheduled consultations', checked: settingsData.sms_notifications },
              { label: 'Push notifications for urgent messages', checked: settingsData.push_notifications },
              { label: 'Weekly summary reports', checked: settingsData.weekly_reports },
            ].map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: T.navy }}>{item.label}</span>
                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: item.checked ? T.green : 'rgba(4,53,77,0.12)', position: 'relative', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: item.checked ? '22px' : '2px', transition: 'all 0.15s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Settings */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico p={ICONS.lock} size={20} sw={1.5} color={T.red} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Security</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Change Password
            </button>
            <button style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Enable Two-Factor Authentication
            </button>
            <button style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.05)', color: T.red, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Sign Out All Devices
            </button>
          </div>
        </div>

        {/* Availability Settings */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: Sh.card,
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(15,158,119,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico p={ICONS.calendar} size={20} sw={1.5} color={T.green} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Availability</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Working Hours</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="time"
                  defaultValue={settingsData.working_hours_start}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', color: T.slate2 }}>to</span>
                <input
                  type="time"
                  defaultValue={settingsData.working_hours_end}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Available Days</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {settingsData.available_days.map((day) => (
                  <button key={day} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid T.blue', background: 'rgba(32,181,223,0.12)', color: T.blue, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {day}
                  </button>
                ))}
                {['Sat', 'Sun'].filter(day => !settingsData.available_days.includes(day)).map((day) => (
                  <button key={day} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.slate2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <button style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}>
              Update Availability
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

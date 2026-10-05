'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getDoctorSettings,
  isAuthError,
  logoutCurrentUser,
  readAccessToken,
  updateDoctorSettings,
  type DoctorSettingsResponse,
  type DoctorSettingsUpdate,
} from '@/lib/api'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DoctorSettingsPage() {
  const router = useRouter()
  const [settingsData, setSettingsData] = useState<DoctorSettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false

    const fetchSettings = async () => {
      try {
        const data = await getDoctorSettings()
        if (!cancelled) {
          setSettingsData(data)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor settings', err)
        if (!cancelled) setError('Unable to load settings right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSettings()

    return () => {
      cancelled = true
    }
  }, [router])

  const updateDraft = <K extends keyof DoctorSettingsResponse>(key: K, value: DoctorSettingsResponse[K]) => {
    setSettingsData((current) => current ? { ...current, [key]: value } : current)
    setMessage(null)
    setError(null)
  }

  const saveSettings = async (payload: DoctorSettingsUpdate, successMessage: string) => {
    setSaving(true)
    try {
      const saved = await updateDoctorSettings(payload)
      setSettingsData(saved)
      setMessage(successMessage)
      setError(null)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      console.error('Failed to save doctor settings', err)
      setError('Unable to save settings right now.')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) => {
    if (!settingsData) return
    const selected = settingsData.available_days.includes(day)
    const nextDays = selected
      ? settingsData.available_days.filter((item) => item !== day)
      : [...settingsData.available_days, day]
    updateDraft('available_days', WEEK_DAYS.filter((item) => nextDays.includes(item)))
  }

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
  }

  const handleConfirmLogout = async () => {
    setSaving(true)
    try {
      await logoutCurrentUser()
    } catch (err) {
      console.error('Logout failed before local cleanup', err)
    } finally {
      setShowLogoutConfirm(false)
      router.replace('/auth/sign-in')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>Loading settings...</p>
      </div>
    )
  }

  if (error && !settingsData) {
    return <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>{error}</div>
  }

  if (!settingsData) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage your account and preferences</p>
        {message && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 600, color: T.green }}>{message}</p>}
        {error && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 600, color: T.red }}>{error}</p>}
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
                value={settingsData.email || ''}
                onChange={(event) => updateDraft('email', event.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Phone Number</label>
              <input
                type="tel"
                value={settingsData.phone || ''}
                onChange={(event) => updateDraft('phone', event.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
              />
            </div>
            <button
              disabled={saving}
              onClick={() => saveSettings({ email: settingsData.email || '', phone: settingsData.phone || '' }, 'Account settings updated.')}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', marginTop: '8px', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Update Account'}
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
                { key: 'email_notifications' as const, label: 'Email notifications for new appointments', checked: settingsData.email_notifications },
                { key: 'sms_notifications' as const, label: 'SMS reminders for scheduled consultations', checked: settingsData.sms_notifications },
                { key: 'push_notifications' as const, label: 'Push notifications for urgent messages', checked: settingsData.push_notifications },
                { key: 'weekly_reports' as const, label: 'Weekly summary reports', checked: settingsData.weekly_reports },
              ].map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: T.navy }}>{item.label}</span>
                <button
                  type="button"
                  onClick={() => updateDraft(item.key, !item.checked)}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: item.checked ? T.green : 'rgba(4,53,77,0.12)', position: 'relative', cursor: 'pointer', transition: 'all 0.15s' }}
                  aria-label={item.label}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: item.checked ? '22px' : '2px', transition: 'all 0.15s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </button>
              </div>
            ))}
            <button
              disabled={saving}
              onClick={() => saveSettings({
                email_notifications: settingsData.email_notifications,
                sms_notifications: settingsData.sms_notifications,
                push_notifications: settingsData.push_notifications,
                weekly_reports: settingsData.weekly_reports,
              }, 'Notification preferences updated.')}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', marginTop: '8px', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Notifications'}
            </button>
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
            <button onClick={() => router.push('/auth/forgot-password')} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Change Password
            </button>
            <button onClick={() => setMessage('Two-factor authentication is enforced during secure doctor login.')} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              {settingsData.two_factor_enabled ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication'}
            </button>
            <button disabled={saving} onClick={handleLogoutClick} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.05)', color: T.red, fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', textAlign: 'left', opacity: saving ? 0.7 : 1 }}>
              Sign Out Current Device
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
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="time"
                  value={settingsData.working_hours_start}
                  onChange={(event) => updateDraft('working_hours_start', event.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', color: T.slate2 }}>to</span>
                <input
                  type="time"
                  value={settingsData.working_hours_end}
                  onChange={(event) => updateDraft('working_hours_end', event.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', fontSize: '13px', color: T.navy, outline: 'none' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: T.slate2, marginBottom: '6px' }}>Available Days</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {WEEK_DAYS.map((day) => {
                  const selected = settingsData.available_days.includes(day)
                  return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: selected ? `1px solid ${T.blue}` : '1px solid rgba(4,53,77,0.12)', background: selected ? 'rgba(32,181,223,0.12)' : 'rgba(255,255,255,0.9)', color: selected ? T.blue : T.slate2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {day}
                  </button>
                  )
                })}
              </div>
            </div>
            <button
              disabled={saving}
              onClick={() => saveSettings({
                working_hours_start: settingsData.working_hours_start,
                working_hours_end: settingsData.working_hours_end,
                available_days: settingsData.available_days,
              }, 'Availability updated.')}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', marginTop: '8px', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Update Availability'}
            </button>
          </div>
        </div>
      </div>
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-logout-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(4,53,77,0.32)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '380px',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.88)',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 24px 64px rgba(4,53,77,0.2)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.logout} size={20} sw={1.8} color={T.red} />
              </div>
              <div>
                <h2 id="settings-logout-title" style={{ margin: '0 0 6px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Sign out?</h2>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: T.slate }}>
                  You will need to sign in again to access the doctor portal.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={saving}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}
              >
                No, stay
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={saving}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: 'none', background: T.red, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Signing out...' : 'Yes, sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

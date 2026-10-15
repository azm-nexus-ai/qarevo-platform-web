'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  isAuthError,
  readAccessToken,
  isAdmin,
} from '@/lib/api'

function SettingCard({ title, description, children }: { 
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: T.navy }}>{title}</h3>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>{description}</p>
      </div>
      {children}
    </div>
  )
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
  })
  const [theme, setTheme] = useState('light')
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    if (!isAdmin()) {
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        // Load settings from localStorage or API
        const savedSettings = localStorage.getItem('qarevo_admin_settings')
        if (savedSettings && !cancelled) {
          const settings = JSON.parse(savedSettings)
          setNotifications(settings.notifications || notifications)
          setTheme(settings.theme || theme)
          setLanguage(settings.language || language)
        }
        setError(null)
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load settings', err)
        if (!cancelled) setError('Unable to load settings right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleSaveSettings = () => {
    const settings = {
      notifications,
      theme,
      language,
    }
    localStorage.setItem('qarevo_admin_settings', JSON.stringify(settings))
    alert('Settings saved successfully')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading settings...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
          Admin Settings
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
          Configure your admin portal preferences
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        <SettingCard
          title="Notifications"
          description="Manage how you receive notifications"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: T.navy }}>Email Notifications</span>
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: T.navy }}>Push Notifications</span>
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: T.navy }}>SMS Notifications</span>
              <input
                type="checkbox"
                checked={notifications.sms}
                onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Appearance"
          description="Customize the look and feel"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(4,53,77,0.12)',
                  background: 'rgba(255,255,255,0.9)',
                  fontSize: '14px',
                  color: T.navy,
                  cursor: 'pointer',
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(4,53,77,0.12)',
                  background: 'rgba(255,255,255,0.9)',
                  fontSize: '14px',
                  color: T.navy,
                  cursor: 'pointer',
                }}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Security"
          description="Manage your security preferences"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(4,53,77,0.12)',
                background: '#fff',
                color: T.navy,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              Change Password
            </button>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(4,53,77,0.12)',
                background: '#fff',
                color: T.navy,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              Enable Two-Factor Authentication
            </button>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(4,53,77,0.12)',
                background: '#fff',
                color: T.navy,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              View Login History
            </button>
          </div>
        </SettingCard>

        <SettingCard
          title="Data & Privacy"
          description="Manage your data and privacy settings"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(4,53,77,0.12)',
                background: '#fff',
                color: T.navy,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              Download My Data
            </button>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(220,38,38,0.12)',
                background: 'rgba(220,38,38,0.06)',
                color: T.red,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              Clear Activity Data
            </button>
          </div>
        </SettingCard>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSaveSettings}
          style={{
            padding: '12px 24px',
            borderRadius: '10px',
            border: 'none',
            background: T.blue,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}

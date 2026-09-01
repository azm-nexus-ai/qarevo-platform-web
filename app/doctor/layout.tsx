'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { DOCTOR_SIDEBAR_ITEMS, DOCTOR_ROUTES, isDoctorNavActive } from '@/constants/doctor-navigation'
import { ICONS } from '@/constants/icons'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import {
  clearAuthTokens,
  getDoctorProfile,
  isAuthError,
  logoutCurrentUser,
  readAccessToken,
  type DoctorProfileResponse,
} from '@/lib/api'

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileResponse | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(mountedTimer)
    }

    let cancelled = false

    async function fetchProfile() {
      try {
        const profile = await getDoctorProfile()
        if (!cancelled) setDoctorProfile(profile)
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor profile', error)
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
      window.clearTimeout(mountedTimer)
    }
  }, [router])

  const handleProfileClick = () => {
    router.push('/doctor/profile')
  }

  const handleSettingsClick = () => {
    router.push('/doctor/settings')
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutCurrentUser()
    } catch (error) {
      console.error('Doctor logout failed before local cleanup', error)
    } finally {
      router.replace('/auth/sign-in')
    }
  }

  const fullName = doctorProfile?.full_name?.trim() || 'Doctor'
  const displayName = fullName.toLowerCase().startsWith('dr.') ? fullName : `Dr. ${fullName}`
  const specialty = doctorProfile?.specialty || 'Doctor'
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DR'

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <aside style={{
          width: '260px',
          background: 'rgba(247,250,252,0.82)',
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRight: '1px solid rgba(4,53,77,0.08)',
          minHeight: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 10,
          boxShadow: Sh.nav,
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(4,53,77,0.06)' }}>
            <AuthenticatedLogo width={140} />
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: T.slate2, fontWeight: 500 }}>Doctor Portal</p>
          </div>
          
          <nav style={{ padding: '16px 12px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {DOCTOR_SIDEBAR_ITEMS.map((item) => {
                const isActive = isDoctorNavActive(pathname, item.href)
                const isLogout = item.href === DOCTOR_ROUTES.logout
                return (
                  <li key={item.href}>
                    {isLogout ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          color: T.red,
                          background: 'transparent',
                          cursor: loggingOut ? 'wait' : 'pointer',
                          opacity: loggingOut ? 0.65 : 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(220,38,38,0.06)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span style={{ marginRight: '12px' }}><Ico p={item.icon} size={16} sw={1.6} color={T.red} /></span>
                        {loggingOut ? 'Signing out...' : item.label}
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          ...(isActive
                            ? { background: 'rgba(32,181,223,0.12)', color: T.blue, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)' }
                            : { color: T.slate, background: 'transparent' }
                          ),
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(4,53,77,0.04)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <span style={{ marginRight: '12px' }}><Ico p={item.icon} size={16} sw={1.6} color={isActive ? T.blue : T.slate2} /></span>
                        {item.label}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, marginLeft: '260px' }}>
          {/* Header */}
          <header style={{
            background: 'rgba(255,255,255,0.86)',
            backdropFilter: 'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            borderBottom: '1px solid rgba(4,53,77,0.08)',
            padding: '16px 32px',
            position: 'sticky',
            top: 0,
            zIndex: 5,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.94)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Welcome, {fullName}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: T.slate2 }}>Manage your consultations and patients</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={handleSettingsClick}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'rgba(247,250,252,0.8)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  title="Settings"
                >
                  <Ico p={ICONS.info} size={18} sw={1.8} color={T.slate2} />
                </button>
                <button 
                  onClick={handleProfileClick}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(4,53,77,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
                  title="View Profile"
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(32,181,223,0.25)' }}>
                    {initials}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: T.navy, lineHeight: 1.2 }}>{displayName}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate2, lineHeight: 1 }}>{specialty}</p>
                  </div>
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div style={{ padding: '28px 32px' }}>
            {mounted ? children : null}
          </div>
        </main>
      </div>
    </div>
  )
}

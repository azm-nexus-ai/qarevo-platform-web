'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import LogoutModal from '@/components/ui/LogoutModal'
import { T, Glass } from '@/lib/tokens'
import { DOCTOR_SIDEBAR_ITEMS, DOCTOR_ROUTES, isDoctorNavActive } from '@/constants/doctor-navigation'
import {
  clearAuthTokens,
  getDoctorProfile,
  isAuthError,
  logoutCurrentUser,
  readAccessToken,
  type DoctorProfileResponse,
} from '@/lib/api'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'DR'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export default function DoctorMobileNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileResponse | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  const fullName = doctorProfile?.full_name?.trim() || 'Doctor'
  const displayName = fullName.toLowerCase().startsWith('dr.') ? fullName : `Dr. ${fullName}`
  const specialty = doctorProfile?.specialty || 'Doctor'
  const doctorInitials = getInitials(fullName)

  // Body scroll lock
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      const first = drawerRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      first?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobileOpen])

  const closeDrawer = useCallback(() => {
    setMobileOpen(false)
    hamburgerRef.current?.focus()
  }, [])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutCurrentUser()
    } catch (error) {
      console.error('Doctor logout failed before local cleanup', error)
    } finally {
      setShowLogoutModal(false)
      closeDrawer()
      router.replace('/auth/sign-in')
    }
  }

  useEffect(() => {
    const token = readAccessToken()
    if (!token) return

    const fetchProfile = async () => {
      try {
        const profile = await getDoctorProfile()
        setDoctorProfile(profile)
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor profile:', error)
      }
    }

    fetchProfile()
  }, [router])

  return (
    <div>
      <style>{`
        .dmn-topbar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 900;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 16px;
          height: 56px;
          background: rgba(247,250,252,0.97);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(4,53,77,0.08);
          box-shadow: 0 2px 12px rgba(4,53,77,0.06);
        }
        .dmn-hamburger {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(4,53,77,0.12);
          background: transparent;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 0;
          flex-shrink: 0;
        }
        .dmn-hamburger span {
          display: block;
          width: 18px;
          height: 2px;
          background: ${T.navy};
          border-radius: 2px;
        }
        .dmn-drawer-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(4,53,77,0.38);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: opacity 0.28s ease;
        }
        .dmn-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 320px;
          max-width: min(88vw, 360px);
          z-index: 1001;
          background: #f8fbfd;
          border-right: 1px solid rgba(255,255,255,0.8);
          box-shadow: 14px 0 44px rgba(4,53,77,0.2);
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          transform: translateX(-100%);
        }
        .dmn-drawer--open {
          transform: translateX(0);
        }
        .dmn-drawer-close {
          position: absolute;
          top: 16px;
          right: 14px;
          z-index: 1;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(4,53,77,0.12);
          background: transparent;
          color: ${T.slate};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          line-height: 1;
        }

        @media (max-width: 920px) {
          .dmn-topbar { display: flex; }
          .dmn-drawer-backdrop { display: block; }
        }
      `}</style>

      {/* Mobile Top Bar */}
      <div className="dmn-topbar" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button
            ref={hamburgerRef}
            className="dmn-hamburger"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="dmn-drawer"
            onClick={() => setMobileOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link
            href="/doctor/dashboard"
            aria-label="Qarevo Health Doctor Dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <AuthenticatedLogo width={120} />
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Profile"
            onClick={() => router.push('/doctor/profile')}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '1px solid rgba(4,53,77,0.11)',
              background: 'linear-gradient(135deg, rgba(32,181,223,0.2), rgba(52,140,234,0.3))',
              color: T.navy,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            {doctorInitials}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      <div
        className="dmn-drawer-backdrop"
        aria-hidden={!mobileOpen}
        onClick={closeDrawer}
        style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'all' : 'none' }}
      />

      {/* Mobile Drawer */}
      <div
        id="dmn-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`dmn-drawer${mobileOpen ? ' dmn-drawer--open' : ''}`}
      >
        <button className="dmn-drawer-close" aria-label="Close navigation menu" onClick={closeDrawer}>
          ✕
        </button>

        <div style={{ marginBottom: '18px', paddingTop: '8px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <AuthenticatedLogo />
          </Link>
        </div>

        <section
          aria-label="Doctor summary"
          style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))',
                border: '1px solid rgba(4,53,77,0.11)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: T.navy,
                fontWeight: 700,
              }}
            >
              {doctorInitials}
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{displayName}</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2 }}>{specialty}</p>
            </div>
          </div>
        </section>

        <nav aria-label="Doctor navigation" style={{ flex: 1 }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            {DOCTOR_SIDEBAR_ITEMS.map((item) => {
              const isActive = isDoctorNavActive(pathname, item.href)
              const isLogout = item.href === DOCTOR_ROUTES.logout
              return (
                isLogout ? (
                  <button
                    key={item.href}
                    onClick={() => {
                      closeDrawer()
                      setShowLogoutModal(true)
                    }}
                    disabled={loggingOut}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'transparent',
                      color: T.red,
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: loggingOut ? 'wait' : 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      opacity: loggingOut ? 0.65 : 1,
                    }}
                  >
                    <Ico p={item.icon} size={15} sw={1.7} color={T.red} />
                    {loggingOut ? 'Signing out...' : item.label}
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: isActive ? 'rgba(32,181,223,0.14)' : 'transparent',
                      color: isActive ? T.blue : T.slate,
                      fontSize: '13.5px',
                      fontWeight: isActive ? 700 : 500,
                      transition: 'all 0.15s',
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Ico p={item.icon} size={15} sw={1.7} color={isActive ? T.blue : T.slate2} />
                    {item.label}
                  </Link>
                )
              )
            })}
          </div>
        </nav>
      </div>

      {showLogoutModal && (
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  )
}

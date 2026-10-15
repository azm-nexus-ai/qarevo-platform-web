'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ADMIN_SIDEBAR_ITEMS, ADMIN_ROUTES, isAdminNavActive } from '@/constants/admin-navigation'
import { ICONS } from '@/constants/icons'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import {
  clearAuthTokens,
  isAuthError,
  isAdmin,
  logoutCurrentUser,
  readAccessToken,
} from '@/lib/api'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(mountedTimer)
    }

    if (!isAdmin()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(mountedTimer)
    }

    return () => {
      window.clearTimeout(mountedTimer)
    }
  }, [router])

  const handleLogoutClick = () => {
    if (loggingOut) return
    setShowLogoutConfirm(true)
  }

  const handleConfirmLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutCurrentUser()
    } catch (error) {
      console.error('Admin logout failed before local cleanup', error)
    } finally {
      setShowLogoutConfirm(false)
      router.replace('/auth/sign-in')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG }}>
      <style>{`
        @media (max-width: 920px) {
          aside {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
          }
          header {
            display: none !important;
          }
          div[style*="padding: 28px 32px"] {
            padding: 16px !important;
          }
        }
      `}</style>
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
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(4,53,77,0.06)', flexShrink: 0 }}>
            <AuthenticatedLogo width={140} />
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: T.slate2, fontWeight: 500 }}>Admin Portal</p>
          </div>
          
          <nav style={{ padding: '16px 12px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ADMIN_SIDEBAR_ITEMS.map((item) => {
                const isActive = isAdminNavActive(pathname, item.href)
                const isLogout = item.href === ADMIN_ROUTES.logout
                return (
                  <li key={item.href}>
                    {isLogout ? (
                      <button
                        type="button"
                        onClick={handleLogoutClick}
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
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Admin Portal</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: T.slate2 }}>Platform administration and monitoring</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={handleLogoutClick}
                  disabled={loggingOut}
                  style={{
                    minHeight: '40px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(220,38,38,0.16)',
                    background: 'rgba(220,38,38,0.06)',
                    color: T.red,
                    cursor: loggingOut ? 'wait' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    transition: 'all 0.15s',
                    opacity: loggingOut ? 0.65 : 1,
                  }}
                  title="Sign out"
                >
                  {loggingOut ? 'Signing out...' : 'Sign out'}
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
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-logout-title"
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
                <h2 id="admin-logout-title" style={{ margin: '0 0 6px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Sign out?</h2>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: T.slate }}>
                  You will need to sign in again to access the admin portal.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: loggingOut ? 'wait' : 'pointer' }}
              >
                No, stay
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={loggingOut}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: 'none', background: T.red, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loggingOut ? 'wait' : 'pointer', opacity: loggingOut ? 0.7 : 1 }}
              >
                {loggingOut ? 'Signing out...' : 'Yes, sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

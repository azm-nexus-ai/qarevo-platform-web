'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProfileImage from '@/components/patient/ProfileImage'
import { usePathname, useRouter } from 'next/navigation'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import { getPatientSettings, isAuthError, clearPortalSession, logoutCurrentUser, type PatientSettings } from '@/lib/api'

type PatientPortalShellProps = {
  eyebrow?: string
  title: string
  description: string
  children: ReactNode
  headerActions?: ReactNode
  rightRail?: ReactNode
  appearance?: {
    darkMode?: boolean
    highContrast?: boolean
    fontSize?: string
  }
}

// ─── Shared Sidebar Content ──────────────────────────────────────────────────
// Extracted so we can render it both inside the desktop aside and the mobile drawer.

function SidebarContent({ pathname, onNavigate, userSettings }: { pathname: string; onNavigate?: () => void; userSettings: PatientSettings | null }) {
  const router = useRouter()
  const signOut = async () => {
    try { await logoutCurrentUser() }
    catch { console.warn('Server logout could not be confirmed.') }
    finally { onNavigate?.(); router.replace('/auth/sign-in') }
  }
  const fullName = userSettings ? [userSettings.first_name, userSettings.last_name].filter(Boolean).join(' ') : 'Loading...'

  return (
    <>
      {/* Patient card */}
      <section
        aria-label='Patient summary'
        style={{ ...Glass.aiCard, borderRadius: '16px', padding: '13px', marginBottom: '14px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ProfileImage name={fullName} size={42} />
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{fullName}</p>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>Patient account</p>
          </div>
        </div>
      </section>

      {/* Nav */}
      <nav aria-label='Patient navigation' style={{ flex: 1 }}>
        <div style={{ display: 'grid', gap: '4px' }}>
          {PATIENT_SIDEBAR_ITEMS.map((item) => {
            const isActive = isPatientNavActive(pathname, item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: isActive ? 'rgba(32,181,223,0.14)' : 'transparent',
                  color: isActive ? T.link : T.slate,
                  fontSize: '13.5px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <Ico p={item.icon} size={16} sw={1.7} color={isActive ? T.blue : T.slate2} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Logout */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
        <button
          type="button"
          onClick={signOut}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            textDecoration: 'none',
            color: "var(--link)",
            fontSize: '13.5px',
            fontWeight: 600,
          }}
        >
          <Ico p={ICONS.arrowSm} size={15} sw={1.7} color='#348CEA' />
          Logout
        </button>
      </div>
    </>
  )
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export default function PatientPortalShell({
  eyebrow = 'Patient Platform',
  title,
  description,
  children,
  headerActions,
  rightRail,
  appearance,
}: PatientPortalShellProps) {
  const pathname = usePathname()
  const [userSettings, setUserSettings] = useState<PatientSettings | null>(null)
  const highContrast = appearance?.highContrast ?? userSettings?.high_contrast ?? false
  const fontSize = (appearance?.fontSize ?? userSettings?.font_size ?? 'Medium').toLowerCase()

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const data = await getPatientSettings()
        setUserSettings(data)
      } catch (error) {
        if (isAuthError(error)) {
          clearPortalSession()
          window.location.href = '/auth/sign-in'
          return
        }
        console.error('Failed to load user settings:', error)
      }
    }
    loadUserSettings()
  }, [])

  return (
    <main
      className={`min-h-screen relative patient-portal-shell ${highContrast ? 'pps-theme-contrast' : ''} pps-font-${fontSize}`}
      style={{ background: PAGE_BG }}
    >
      <style>{`
        /* ── Grid ── */
        .pps-shell {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 18px;
          max-width: 1460px;
          margin: 0 auto;
          padding: 18px;
        }
        .pps-shell-has-rail {
          grid-template-columns: 260px minmax(0, 1fr) 320px;
        }
        .pps-left, .pps-main, .pps-right { min-width: 0; }

        .patient-portal-shell.pps-font-small { font-size: 14px; }
        .patient-portal-shell.pps-font-large { font-size: 16.5px; }
        .patient-portal-shell.pps-theme-contrast .pps-main,
        .patient-portal-shell.pps-theme-contrast .pps-sidebar {
          filter: contrast(1.08) saturate(1.08);
        }
        /* ── Responsive ── */
        @media (max-width: 1280px) {
          .pps-shell,
          .pps-shell-has-rail { grid-template-columns: 240px minmax(0, 1fr); }
          .pps-right { display: none; }
        }
        @media (max-width: 920px) {
          .pps-shell { grid-template-columns: 1fr; padding: 0 12px 14px; padding-top: 14px; gap: 12px; }
          .pps-left { display: none; }
          .pps-head-row { flex-direction: column; align-items: stretch !important; }
          .pps-main > header { padding: 16px !important; border-radius: 20px !important; }
          .pps-main > header h1 { font-size: 26px !important; letter-spacing: 0 !important; }
        }
        @media (max-width: 560px) {
          .pps-shell { padding-left: 10px; padding-right: 10px; }
          .pps-head-row > div:last-child,
          .pps-head-row > div:last-child button { width: 100%; }
        }
      `}</style>

      {/* Dot-grid background */}
      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.1) 1px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 92% 80% at 50% 36%, black 44%, transparent 100%)',
        }}
      />

      <div className={`pps-shell ${rightRail ? 'pps-shell-has-rail' : ''}`}>
        {/* Desktop Sidebar */}
        <aside id='patient-primary-sidebar' className='pps-left'>
          <div
            className='pps-sidebar portal-sidebar-content'
            style={{
              background: "var(--surface-glass)",
              backdropFilter: 'blur(22px) saturate(180%)',
              WebkitBackdropFilter: 'blur(22px) saturate(180%)',
              borderRadius: '22px',
              border: "1px solid var(--border)",
              boxShadow: Sh.float,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SidebarContent pathname={pathname} userSettings={userSettings} />
          </div>
        </aside>

        {/* Main content */}
        <section className='pps-main'>
          <header
            style={{
              ...Glass.nav,
              borderRadius: '22px',
              border: "1px solid var(--border)",
              padding: '18px 18px 16px',
              marginBottom: '14px',
            }}
          >
            <div
              className='pps-head-row'
              style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}
            >
              <div>
                <p style={{ margin: '0 0 6px', fontSize: "13px", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: "var(--link)" }}>{eyebrow}</p>
                <h1 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{title}</h1>
                <p style={{ margin: 0, maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>{description}</p>
              </div>
              {headerActions ? (
                <div className='pps-header-actions' style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{headerActions}</div>
              ) : null}
            </div>
          </header>

          <div>{children}</div>
        </section>

        {/* Right rail */}
        {rightRail ? (
          <aside id='patient-secondary-sidebar' className='pps-right'>
            <div className='pps-right-rail portal-sidebar-content portal-sidebar-stack'>{rightRail}</div>
          </aside>
        ) : null}
      </div>
    </main>
  )
}

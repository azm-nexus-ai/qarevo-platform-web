'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { ICONS } from '@/constants/icons'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import { getPatientSettings, isAuthError, clearAuthTokens, type PatientSettings } from '@/lib/api'

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
  const fullName = userSettings ? [userSettings.first_name, userSettings.last_name].filter(Boolean).join(' ') : 'Loading...'
  const initials = fullName ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'P'
  
  return (
    <>
      {/* Logo */}
      <div style={{ marginBottom: '18px' }}>
        <Link
          href='/'
          aria-label='Qarevo Health home'
          onClick={onNavigate}
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <AuthenticatedLogo priority />
        </Link>
      </div>

      {/* Patient card */}
      <section
        aria-label='Patient summary'
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
              fontSize: '16px',
            }}
          >
            {initials}
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{fullName}</p>
            <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2 }}>Care Plan: Active</p>
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
                  color: isActive ? T.blue : T.slate,
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
        <Link
          href={PATIENT_ROUTES.logout}
          onClick={onNavigate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            textDecoration: 'none',
            color: '#348CEA',
            fontSize: '13.5px',
            fontWeight: 600,
          }}
        >
          <Ico p={ICONS.arrowSm} size={15} sw={1.7} color='#348CEA' />
          Logout
        </Link>
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
  const darkMode = appearance?.darkMode ?? userSettings?.dark_mode ?? false
  const highContrast = appearance?.highContrast ?? userSettings?.high_contrast ?? false
  const fontSize = (appearance?.fontSize ?? userSettings?.font_size ?? 'Medium').toLowerCase()

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const data = await getPatientSettings()
        setUserSettings(data)
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
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
      className={`min-h-screen relative patient-portal-shell ${darkMode ? 'pps-theme-dark' : ''} ${highContrast ? 'pps-theme-contrast' : ''} pps-font-${fontSize}`}
      style={{ background: darkMode ? '#071723' : PAGE_BG }}
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
        .pps-sidebar, .pps-right-rail { position: sticky; top: 18px; }
        .patient-portal-shell.pps-font-small { font-size: 14px; }
        .patient-portal-shell.pps-font-large { font-size: 16.5px; }
        .patient-portal-shell.pps-theme-dark {
          color-scheme: dark;
        }
        .patient-portal-shell.pps-theme-dark .pps-sidebar,
        .patient-portal-shell.pps-theme-dark .pps-main > header,
        .patient-portal-shell.pps-theme-dark .pps-right-rail > *,
        .patient-portal-shell.pps-theme-dark .portal-card,
        .patient-portal-shell.pps-theme-dark .portal-empty-state {
          background: rgba(11, 32, 48, 0.94) !important;
          border-color: rgba(125, 211, 252, 0.2) !important;
          color: #E6F6FF !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 54px rgba(0,0,0,0.28) !important;
        }
        .patient-portal-shell.pps-theme-dark .pps-main > header h1,
        .patient-portal-shell.pps-theme-dark .pps-main > header p,
        .patient-portal-shell.pps-theme-dark .pps-right-rail h2,
        .patient-portal-shell.pps-theme-dark .pps-right-rail p,
        .patient-portal-shell.pps-theme-dark .pps-right-rail span,
        .patient-portal-shell.pps-theme-dark .pps-right-rail strong,
        .patient-portal-shell.pps-theme-dark .portal-card h1,
        .patient-portal-shell.pps-theme-dark .portal-card h2,
        .patient-portal-shell.pps-theme-dark .portal-card h3,
        .patient-portal-shell.pps-theme-dark .portal-card p,
        .patient-portal-shell.pps-theme-dark .portal-card span,
        .patient-portal-shell.pps-theme-dark .portal-card strong,
        .patient-portal-shell.pps-theme-dark .portal-card label,
        .patient-portal-shell.pps-theme-dark .portal-empty-state p {
          color: #E6F6FF !important;
        }
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]),
        .patient-portal-shell.pps-theme-dark .pps-main > div > section,
        .patient-portal-shell.pps-theme-dark .pps-main article {
          background: rgba(11, 32, 48, 0.88) !important;
          border-color: rgba(125, 211, 252, 0.18) !important;
        }
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) h1,
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) h2,
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) h3,
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) p,
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) span,
        .patient-portal-shell.pps-theme-dark .pps-main > div > div:not([role="dialog"]) label,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section h1,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section h2,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section h3,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section p,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section span,
        .patient-portal-shell.pps-theme-dark .pps-main > div > section label {
          color: #E6F6FF !important;
        }
        .patient-portal-shell.pps-theme-dark .pps-main input,
        .patient-portal-shell.pps-theme-dark .pps-main select,
        .patient-portal-shell.pps-theme-dark .pps-main textarea,
        .patient-portal-shell.pps-theme-dark .portal-card input,
        .patient-portal-shell.pps-theme-dark .portal-card select,
        .patient-portal-shell.pps-theme-dark .portal-card textarea {
          background: rgba(7, 23, 35, 0.92) !important;
          border-color: rgba(125, 211, 252, 0.22) !important;
          color: #E6F6FF !important;
        }
        .patient-portal-shell.pps-theme-dark .pps-main input::placeholder,
        .patient-portal-shell.pps-theme-dark .pps-main textarea::placeholder {
          color: rgba(230,246,255,0.56) !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-button-secondary,
        .patient-portal-shell.pps-theme-dark .portal-card button:not(.portal-button-primary):not([style*="linear-gradient"]) {
          background: rgba(7, 23, 35, 0.88) !important;
          border-color: rgba(125, 211, 252, 0.22) !important;
          color: #E6F6FF !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-button-danger {
          background: rgba(127, 29, 29, 0.34) !important;
          border-color: rgba(248, 113, 113, 0.34) !important;
          color: #FCA5A5 !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-badge-neutral {
          background: rgba(125, 211, 252, 0.12) !important;
          color: #BAE6FD !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-badge-info {
          background: rgba(32,181,223,0.18) !important;
          color: #67E8F9 !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-badge-success {
          background: rgba(15,158,119,0.22) !important;
          color: #86EFAC !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-badge-warning {
          background: rgba(217,119,6,0.22) !important;
          color: #FDBA74 !important;
        }
        .patient-portal-shell.pps-theme-dark .portal-badge-danger {
          background: rgba(220,38,38,0.2) !important;
          color: #FCA5A5 !important;
        }
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
        <aside className='pps-left'>
          <div
            className='pps-sidebar'
            style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(22px) saturate(180%)',
              WebkitBackdropFilter: 'blur(22px) saturate(180%)',
              borderRadius: '22px',
              border: '1px solid rgba(255,255,255,0.9)',
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
              border: '1px solid rgba(255,255,255,0.82)',
              padding: '18px 18px 16px',
              marginBottom: '14px',
            }}
          >
            <div
              className='pps-head-row'
              style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}
            >
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#348CEA' }}>{eyebrow}</p>
                <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{title}</h1>
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
          <aside className='pps-right'>
            <div className='pps-right-rail'>{rightRail}</div>
          </aside>
        ) : null}
      </div>
    </main>
  )
}

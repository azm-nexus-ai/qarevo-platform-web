'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { ICONS } from '@/constants/icons'
import { T, Glass } from '@/lib/tokens'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'

export default function PatientMobileNavigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

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

  return (
    <>
      <style>{`
        .pmn-topbar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 60;
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
        .pmn-hamburger {
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
        .pmn-hamburger span {
          display: block;
          width: 18px;
          height: 2px;
          background: ${T.navy};
          border-radius: 2px;
        }
        .pmn-drawer-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(4,53,77,0.25);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: opacity 0.28s ease;
        }
        .pmn-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 86vw;
          z-index: 90;
          background: rgba(247,250,252,0.97);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid rgba(255,255,255,0.8);
          box-shadow: 8px 0 40px rgba(4,53,77,0.15);
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          transform: translateX(-100%);
        }
        .pmn-drawer--open {
          transform: translateX(0);
        }
        .pmn-drawer-close {
          position: absolute;
          top: 16px;
          right: 14px;
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
          .pmn-topbar { display: flex; }
          .pmn-drawer-backdrop { display: block; }
        }
      `}</style>

      {/* Mobile Top Bar */}
      <div className="pmn-topbar" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button
            ref={hamburgerRef}
            className="pmn-hamburger"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="pmn-drawer"
            onClick={() => setMobileOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link
            href="/patient/dashboard"
            aria-label="Qarevo Health Patient Dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <AuthenticatedLogo width={120} />
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Notifications"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.12)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.slate,
              position: 'relative',
            }}
          >
            <Ico p={ICONS.ema} size={18} sw={1.8} />
            <span
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: T.blue,
                border: '1.5px solid #fff',
              }}
            />
          </button>
          <button
            type="button"
            aria-label="Profile"
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
            J
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      <div
        className="pmn-drawer-backdrop"
        aria-hidden={!mobileOpen}
        onClick={closeDrawer}
        style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'all' : 'none' }}
      />

      {/* Mobile Drawer */}
      <div
        id="pmn-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`pmn-drawer${mobileOpen ? ' pmn-drawer--open' : ''}`}
      >
        <button className="pmn-drawer-close" aria-label="Close navigation menu" onClick={closeDrawer}>
          ✕
        </button>

        <div style={{ marginBottom: '18px', paddingTop: '8px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <AuthenticatedLogo />
          </Link>
        </div>

        <section
          aria-label="Patient summary"
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
              J
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>John Adewale</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: T.slate2 }}>Care Plan: Active</p>
            </div>
          </div>
        </section>

        <nav aria-label="Patient navigation" style={{ flex: 1 }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            {PATIENT_SIDEBAR_ITEMS.map((item) => {
              const isActive = isPatientNavActive(pathname, item.href)
              return (
                <Link
                  key={item.label}
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
            })}
          </div>
        </nav>

        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
          <Link
            href={PATIENT_ROUTES.logout}
            onClick={closeDrawer}
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
            <Ico p={ICONS.arrowSm} size={15} sw={1.8} color="#348CEA" />
            Logout
          </Link>
        </div>
      </div>
    </>
  )
}

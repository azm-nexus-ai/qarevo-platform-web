'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, Glass } from '@/lib/tokens'
import { NAV_LINKS, NAV_ANCHORS } from '@/constants/navigation'
import HoverBtn from '@/components/buttons/HoverBtn'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'

export default function NavigationBar() {
  const [activeSection, setActiveSection] = useState<string>('Platform Overview')
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hoverNav, setHoverNav] = useState<string | null>(null)
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  // Sticky shrink + glassmorphism intensify on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // IntersectionObserver for active section highlighting
  useEffect(() => {
    const anchors = Object.values(NAV_ANCHORS).map(a => a.replace('#', ''))
    const els = anchors.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        )
        const label = Object.entries(NAV_ANCHORS).find(
          ([, anchor]) => anchor.replace('#', '') === top.target.id
        )?.[0]
        if (label) setActiveSection(label)
      },
      { threshold: 0.2, rootMargin: '-60px 0px -40% 0px' }
    )

    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Body scroll lock when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      // Focus first focusable item in drawer
      const first = drawerRef.current?.querySelector<HTMLElement>('a, button')
      first?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Keyboard trap inside mobile drawer
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!mobileOpen) return
    if (e.key === 'Escape') {
      setMobileOpen(false)
      hamburgerRef.current?.focus()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [mobileOpen])

  const handleNavClick = (label: string) => {
    const anchor = NAV_ANCHORS[label]
    if (anchor) {
      const el = document.querySelector(anchor)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMobileOpen(false)
  }

  const navHeight = scrolled ? '52px' : '60px'
  const navBg = scrolled
    ? { ...Glass.nav, background: 'rgba(247,250,252,0.92)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.94), 0 1px 0 rgba(4,53,77,0.10), 0 8px 30px rgba(4,53,77,0.10)' }
    : Glass.nav

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'height 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
          ...navBg,
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            padding: '0 24px',
            height: navHeight,
            display: 'flex',
            alignItems: 'center',
            transition: 'height 0.2s ease',
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            aria-label="Qarevo Health home"
            onClick={() => handleNavClick('Platform Overview')}
            style={{ marginRight: '28px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <AuthenticatedLogo priority width={136} />
          </Link>

          {/* Desktop nav links */}
          <div
            style={{ display: 'flex', gap: '2px', flex: 1 }}
            className="hide-mobile"
          >
            {NAV_LINKS.map((label) => {
              const isActive = activeSection === label
              return (
                <button
                  key={label}
                  aria-current={isActive ? 'true' : undefined}
                  onMouseEnter={() => setHoverNav(label)}
                  onMouseLeave={() => setHoverNav(null)}
                  onClick={() => handleNavClick(label)}
                  style={{
                    background: isActive
                      ? 'rgba(32,181,223,0.12)'
                      : hoverNav === label
                      ? 'rgba(52,140,234,0.08)'
                      : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 13px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? T.blue : hoverNav === label ? '#348CEA' : T.slate,
                    letterSpacing: '-0.01em',
                    transition: 'color 0.12s, background 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Desktop auth buttons */}
          <div
            style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}
            className="hide-mobile"
          >
            <Link
              href="/auth/doctor/login"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 500,
                color: T.slate2,
                letterSpacing: '-0.01em',
                textDecoration: 'none',
              }}
            >
              Physician Portal
            </Link>
            <Link
              href="/auth/sign-in"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '7px 16px',
                borderRadius: '9px',
                fontSize: '13.5px',
                fontWeight: 500,
                color: T.slate,
                letterSpacing: '-0.01em',
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
            <HoverBtn
              onClick={() => router.push('/auth')}
              base={{
                background: T.blue,
                border: 'none',
                cursor: 'pointer',
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.01em',
                boxShadow: '0 2px 8px rgba(32,181,223,0.26), 0 8px 22px rgba(32,181,223,0.2)',
              }}
              on={{
                background: '#348CEA',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 14px rgba(52,140,234,0.3), 0 10px 28px rgba(52,140,234,0.2)',
              }}
            >
              Access Platform
            </HoverBtn>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            className="show-mobile"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-drawer"
            onClick={() => setMobileOpen(prev => !prev)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid rgba(4,53,77,0.12)',
              borderRadius: '8px',
              cursor: 'pointer',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                display: 'block',
                width: '18px',
                height: '2px',
                background: T.navy,
                borderRadius: '2px',
                transition: 'transform 0.2s ease, opacity 0.2s ease',
                transform: mobileOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
              }}
            />
            <span
              style={{
                display: 'block',
                width: '18px',
                height: '2px',
                background: T.navy,
                borderRadius: '2px',
                transition: 'opacity 0.2s ease',
                opacity: mobileOpen ? 0 : 1,
              }}
            />
            <span
              style={{
                display: 'block',
                width: '18px',
                height: '2px',
                background: T.navy,
                borderRadius: '2px',
                transition: 'transform 0.2s ease, opacity 0.2s ease',
                transform: mobileOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none',
              }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      <div
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 48,
          background: 'rgba(4,53,77,0.18)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onKeyDown={handleDrawerKeyDown}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '85vw',
          zIndex: 49,
          background: 'rgba(247,250,252,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderLeft: '1px solid rgba(255,255,255,0.76)',
          boxShadow: '-8px 0 40px rgba(4,53,77,0.15)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px',
          overflowY: 'auto',
        }}
      >
        {/* Drawer logo + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AuthenticatedLogo width={120} />
          <button
            aria-label="Close navigation menu"
            onClick={() => { setMobileOpen(false); hamburgerRef.current?.focus() }}
            style={{
              background: 'none',
              border: '1px solid rgba(4,53,77,0.12)',
              borderRadius: '8px',
              cursor: 'pointer',
              padding: '6px 8px',
              color: T.slate,
              fontSize: '18px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer nav items */}
        <nav aria-label="Mobile navigation" style={{ flex: 1 }}>
          {NAV_LINKS.map((label) => {
            const isActive = activeSection === label
            return (
              <button
                key={label}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleNavClick(label)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: isActive ? 'rgba(32,181,223,0.1)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? T.blue : T.slate,
                  letterSpacing: '-0.01em',
                  marginBottom: '4px',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>

        {/* Drawer auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(4,53,77,0.08)' }}>
          <Link
            href="/auth/doctor/login"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.08)',
              fontSize: '13px',
              fontWeight: 500,
              color: T.slate2,
              textDecoration: 'none',
              transition: 'background 0.12s',
            }}
          >
            Physician Portal
          </Link>
          <Link
            href="/auth/sign-in"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.12)',
              fontSize: '14px',
              fontWeight: 500,
              color: T.slate,
              textDecoration: 'none',
              transition: 'background 0.12s',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/auth"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 20px',
              borderRadius: '10px',
              background: T.blue,
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(32,181,223,0.26)',
              transition: 'background 0.12s, box-shadow 0.12s',
            }}
          >
            Access Platform
          </Link>
        </div>
      </div>
    </>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import PortalMobileNavigation from '@/components/layout/PortalMobileNavigation'
import { PortalSidebar } from '@/components/layout/PortalNav'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import SignOutDialog from '@/components/layout/SignOutDialog'
import { ADMIN_NAV_GROUPS } from '@/constants/portal-navigation'
import PortalAccessLinks from '@/components/layout/PortalAccessLinks'
import SidebarToggle from '@/components/layout/SidebarToggle'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'

import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ADMIN_ROUTES, isAdminNavActive } from '@/constants/admin-navigation'
import { PAGE_BG } from '@/lib/tokens'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import Link from 'next/link'
import {
  apiGet,
  clearPortalSession,
  isAdmin,
  logoutCurrentUser,
  readSessionMarker,
} from '@/lib/api'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/admin/login')
      return () => window.clearTimeout(mountedTimer)
    }

    if (!isAdmin()) {
      clearPortalSession()
      router.replace('/auth/admin/login')
      return () => window.clearTimeout(mountedTimer)
    }

    return () => {
      window.clearTimeout(mountedTimer)
    }
  }, [router])

  // Enforced two-factor: until an authenticator is set up, every admin page leads to set-up.
  const pathname = usePathname()
  useEffect(() => {
    if (!mounted || pathname?.startsWith('/admin/security')) return
    let current = true
    apiGet<{ setup_required?: boolean }>('/api/v1/admin/security/two-factor')
      .then(status => { if (current && status?.setup_required) router.replace('/admin/security?setup=required') })
      .catch(() => undefined)
    return () => { current = false }
  }, [mounted, pathname, router])

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
      router.replace('/auth/admin/login')
    }
  }

  const t = useTranslations('shell')
  const name = t('adminFallback')
  return (
    <div className='admin-portal-shell portal-shell' style={{ minHeight: '100vh', background: PAGE_BG }}>
      <PortalMobileNavigation portal='admin' className='admin-mobile-navigation' homeHref={ADMIN_ROUTES.dashboard} homeLabel='Admin dashboard'
        groups={ADMIN_NAV_GROUPS} isActive={isAdminNavActive} navLabel={t('adminNavigation')} summaryLabel={name}
        identity={{ name, description: t('adminSubtitle') }} onLogout={handleLogoutClick} loggingOut={loggingOut} />
      <header className='portal-desktop-navbar portal-header' aria-label={t('adminMainNavigation')}>
        <div className='portal-navbar-row'>
          <Link href='/admin/dashboard' className='portal-navbar-brand' aria-label={t('qarevoHealthAdminDashboard')}><AuthenticatedLogo width={156} /></Link>
          <SidebarToggle role='admin' />
          <div className='portal-navbar-title'>
            <h2 className='portal-header-title'>{t('adminPortal')}</h2>
            <p className='portal-header-subtitle'>{t('adminSubtitle')}</p>
          </div>
          <div className='portal-header-actions'>
            <NotificationBell portal='admin' />
            <span className='portal-header-divider' aria-hidden='true' />
            <PortalAccessLinks /><ThemeToggle /><LanguageSwitch />
            <button type='button' className='portal-signout-button' onClick={handleLogoutClick} disabled={loggingOut}>
              {loggingOut ? t('signingOut') : t('signOut')}
            </button>
          </div>
        </div>
      </header>
      <PortalSidebar portal='admin' groups={ADMIN_NAV_GROUPS} isActive={isAdminNavActive} label={t('adminNavigation')}
        onLogout={handleLogoutClick} loggingOut={loggingOut} />
      <main data-portal-main='admin' className='portal-main'>
        <div className='portal-page-content'>
          {mounted ? children : null}
        </div>
      </main>
      <SignOutDialog open={showLogoutConfirm} busy={loggingOut} onCancel={() => setShowLogoutConfirm(false)} onConfirm={handleConfirmLogout}
        description={t('signOutWarning')} />
    </div>
  )
}

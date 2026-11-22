'use client'

import { useTranslations } from 'next-intl'
import { Settings } from 'lucide-react'
import { PortalSidebar } from '@/components/layout/PortalNav'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import SignOutDialog from '@/components/layout/SignOutDialog'
import { DOCTOR_NAV_GROUPS } from '@/constants/portal-navigation'
import SidebarToggle from '@/components/layout/SidebarToggle'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isDoctorNavActive } from '@/constants/doctor-navigation'
import { PAGE_BG } from '@/lib/tokens'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import Link from 'next/link'
import DoctorMobileNavigation from '@/components/doctor/DoctorMobileNavigation'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import PortalAccountMenu from '@/components/layout/PortalAccountMenu'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { isPortalIdentityEvent } from '@/lib/portal-scope'
import { subscribeProfileChanges } from '@/lib/profile-events'
import {
  clearPortalSession,
  getDoctorProfile,
  isAuthError,
  isProvider,
  logoutCurrentUser,
  readSessionMarker,
  type DoctorProfileResponse,
} from '@/lib/api'

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileResponse | null>(null)
  const [identityRevision, setIdentityRevision] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/doctor/login')
      return () => window.clearTimeout(mountedTimer)
    }

    if (!isProvider()) {
      clearPortalSession()
      router.replace('/auth/doctor/login')
      return () => window.clearTimeout(mountedTimer)
    }

    let cancelled = false
    let generation = 0
    const scope = readAccountScope('doctor')

    async function fetchProfile() {
      const ticket = ++generation
      try {
        const profile = await getDoctorProfile()
        if (!cancelled && ticket === generation && scope === readAccountScope('doctor')) setDoctorProfile(profile)
      } catch (error) {
        if (cancelled || ticket !== generation || scope !== readAccountScope('doctor')) return
        if (isAuthError(error)) {
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        console.error('Failed to load doctor profile', error)
      }
    }

    void fetchProfile()
    const unsubscribe = subscribeProfileChanges('doctor', () => { void fetchProfile() })
    const reset = (event: Event) => { if (!isPortalIdentityEvent(event, 'doctor')) return; setDoctorProfile(null); setIdentityRevision(value => value + 1) }
    window.addEventListener(ACCOUNT_CHANGED, reset)
    window.addEventListener('storage', reset)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener(ACCOUNT_CHANGED, reset); window.removeEventListener('storage', reset)
      window.clearTimeout(mountedTimer)
    }
  }, [router, identityRevision])

  const handleSettingsClick = () => {
    router.push('/doctor/settings')
  }

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
      console.error('Doctor logout failed before local cleanup', error)
    } finally {
      setShowLogoutConfirm(false)
      router.replace('/auth/doctor/login')
    }
  }

  const t = useTranslations('shell')
  const fullName = doctorProfile?.full_name?.trim() || t('doctorFallback')
  const displayName = fullName.toLowerCase().startsWith('dr.') ? fullName : `Dr. ${fullName}`
  const specialty = doctorProfile?.specialty || t('doctorFallback')
  return (
    <div className='doctor-portal-shell portal-shell' style={{ minHeight: '100vh', background: PAGE_BG }}>
      <DoctorMobileNavigation />
      <style>{`
        @media (max-width: 920px) {
          [data-portal-main=doctor] { margin-left: 0 !important; }
          [data-portal-main=doctor] > header { display: none !important; }
          .doctor-portal-shell .portal-page-content { padding: 16px !important; }
        }
      `}</style>
      <header className='portal-desktop-navbar portal-header' aria-label='Doctor main navigation'>
        <div className='portal-navbar-row'>
          <Link href='/doctor/dashboard' className='portal-navbar-brand' aria-label='Qarevo Health doctor dashboard'><AuthenticatedLogo width={156} /></Link>
          <SidebarToggle role='doctor' />
          <div className='portal-navbar-title'>
            <h2 className='portal-header-title'>{t('welcome', { name: fullName })}</h2>
            <p className='portal-header-subtitle'>{t('doctorSubtitle')}</p>
          </div>
          <div className='portal-header-actions'>
            <NotificationBell portal='doctor' />
            <span className='portal-header-divider' aria-hidden='true' />
            <ThemeToggle /><LanguageSwitch />
            <button type='button' className='portal-icon-button' onClick={handleSettingsClick} title={t('settings')} aria-label={t('settings')}>
              <Settings size={18} aria-hidden='true' />
            </button>
            <button type='button' className='portal-signout-button' onClick={handleLogoutClick} disabled={loggingOut}>
              {loggingOut ? t('signingOut') : t('signOut')}
            </button>
            <PortalAccountMenu portal='doctor' name={displayName} description={specialty} avatar={<ProfileAvatar name={displayName} src={doctorProfile?.avatar_url} kind='doctor' size={36} />} profileHref='/doctor/profile' settingsHref='/doctor/settings' />
          </div>
        </div>
      </header>
      <PortalSidebar portal='doctor' groups={DOCTOR_NAV_GROUPS} isActive={isDoctorNavActive} label={t('doctorNavigation')}
        onLogout={handleLogoutClick} loggingOut={loggingOut}
        identity={{ name: displayName, description: specialty, avatar: <ProfileAvatar name={displayName} src={doctorProfile?.avatar_url} kind='doctor' size={40} /> }} />
      <main data-portal-main='doctor' className='portal-main'>
        <div className='portal-page-content'>
          {mounted ? children : null}
        </div>
      </main>
      <SignOutDialog open={showLogoutConfirm} busy={loggingOut} onCancel={() => setShowLogoutConfirm(false)} onConfirm={handleConfirmLogout}
        description={t('doctorSignOutWarning')} />
    </div>
  )
}

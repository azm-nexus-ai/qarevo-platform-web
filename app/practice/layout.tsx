'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { logoutCurrentUser } from '@/lib/api'
import RoleHomeLink from '@/components/branding/RoleHomeLink'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import PortalAccountMenu from '@/components/layout/PortalAccountMenu'
import PortalMobileNavigation from '@/components/layout/PortalMobileNavigation'
import { PortalSidebar } from '@/components/layout/PortalNav'
import SidebarToggle from '@/components/layout/SidebarToggle'
import SignOutDialog from '@/components/layout/SignOutDialog'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { PRACTICE_NAV_GROUPS, PRACTICE_ROUTES, isPracticeNavActive } from '@/constants/portal-navigation'
import { PAGE_BG } from '@/lib/tokens'

/** Practice portal shell: the same header, sidebar, drawer and notifications as the other portals. */
export default function PracticeLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('shell'), router = useRouter()
  const [ending, setEnding] = useState(false), [confirming, setConfirming] = useState(false), [error, setError] = useState('')
  const name = t('practiceFallback')
  const signOut = async () => {
    if (ending) return
    setEnding(true); setError('')
    try { await logoutCurrentUser() } catch { setError(t('practiceSignOutUnconfirmed')) }
    finally { setConfirming(false); router.replace('/auth/practice/login') }
  }
  const avatar = (size: number) => <ProfileAvatar name={name} kind='practice' size={size} />
  return <div className='practice-portal-shell portal-shell' style={{ minHeight: '100vh', background: PAGE_BG }}>
    <PortalMobileNavigation portal='practice' className='practice-mobile-navigation' homeHref={PRACTICE_ROUTES.dashboard} homeLabel={t('practiceHome')}
      groups={PRACTICE_NAV_GROUPS} isActive={isPracticeNavActive} navLabel={t('practiceNavigation')} summaryLabel={name}
      identity={{ name, description: t('practiceSubtitle'), avatar: avatar(40) }} onLogout={() => setConfirming(true)} loggingOut={ending} />
    <header className='portal-desktop-navbar portal-header' aria-label={t('practiceMainNavigation')}>
      <div className='portal-navbar-row'>
        <RoleHomeLink aria-label={t('practiceHome')} className='portal-navbar-brand'><AuthenticatedLogo width={156} /></RoleHomeLink>
        <SidebarToggle role='practice' />
        <div className='portal-navbar-title'>
          <h2 className='portal-header-title'>{name}</h2>
          <p className='portal-header-subtitle'>{t('practiceSubtitle')}</p>
        </div>
        <div className='portal-header-actions'>
          <NotificationBell portal='practice' />
          <span className='portal-header-divider' aria-hidden='true' />
          <ThemeToggle /><LanguageSwitch />
          <button type='button' className='portal-signout-button' onClick={() => setConfirming(true)} disabled={ending}>{ending ? t('signingOut') : t('signOut')}</button>
          <PortalAccountMenu portal='practice' name={name} description={t('practiceAccess')} avatar={avatar(36)} profileHref={PRACTICE_ROUTES.dashboard} settingsHref={PRACTICE_ROUTES.settings} />
        </div>
      </div>
    </header>
    <PortalSidebar portal='practice' groups={PRACTICE_NAV_GROUPS} isActive={isPracticeNavActive} label={t('practiceNavigation')}
      onLogout={() => setConfirming(true)} loggingOut={ending} identity={{ name, description: t('practiceBoundary'), avatar: avatar(40) }} />
    <main data-portal-main='practice' className='portal-main'>
      <div className='portal-page-content'>
        {error && <p role='alert' className='mb-5 rounded-xl border border-theme p-4 text-sm'>{error}</p>}
        {children}
      </div>
    </main>
    <SignOutDialog open={confirming} busy={ending} onCancel={() => setConfirming(false)} onConfirm={() => void signOut()} description={t('signOutWarning')} />
  </div>
}

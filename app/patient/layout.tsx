'use client'

import Link from 'next/link'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import SidebarToggle from '@/components/layout/SidebarToggle'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import PatientMobileNavigation from '@/components/patient/PatientMobileNavigation'
import PatientAccountMenu from '@/components/patient/PatientAccountMenu'
import { useRouter } from 'next/navigation'
import { isPatient, readSessionMarker, clearPortalSession } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

function PatientPortalLabel() { return <>{useTranslations('patientShell')('portal')}</> }

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('patientShell')
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(mountedTimer)
    }

    if (!isPatient()) {
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(mountedTimer)
    }

    return () => window.clearTimeout(mountedTimer)
  }, [router])

  return (
    <>
      <PatientMobileNavigation />
      <nav aria-label={t('patientAppearance')} className="patient-appearance-navigation">
        <Link href='/patient/dashboard' aria-label={t('qarevoHealthPatientDashboard')} className='portal-navbar-brand'><AuthenticatedLogo width={156} /></Link><SidebarToggle role='patient' /><span className='patient-portal-label'><PatientPortalLabel /></span><NotificationBell portal='patient' /><span className='portal-header-divider' aria-hidden='true' /><ThemeToggle /><LanguageSwitch /><SidebarToggle role='patient' side='right' /><PatientAccountMenu />
      </nav>
      {mounted ? <div className='patient-application'>{children}</div> : null}
    </>
  )
}

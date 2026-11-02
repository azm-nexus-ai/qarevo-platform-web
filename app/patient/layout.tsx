'use client'

import Link from 'next/link'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import SidebarToggle from '@/components/layout/SidebarToggle'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import PatientMobileNavigation from '@/components/patient/PatientMobileNavigation'
import { useRouter } from 'next/navigation'
import { isPatient, readAccessToken, clearAuthTokens } from '@/lib/api'
import { useEffect, useState } from 'react'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0)

    if (!readAccessToken()) {
      clearAuthTokens()
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
      <nav aria-label="Patient appearance" className="patient-appearance-navigation">
        <SidebarToggle role='patient' /><span className='patient-portal-label'>Patient portal</span><ThemeToggle /><Link href='/patient/dashboard' aria-label='Qarevo Health patient dashboard' className='patient-top-right-logo'><AuthenticatedLogo width={156} /></Link>
      </nav>
      {mounted ? children : null}
    </>
  )
}

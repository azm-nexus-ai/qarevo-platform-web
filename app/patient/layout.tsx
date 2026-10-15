'use client'

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
      {mounted ? children : null}
    </>
  )
}

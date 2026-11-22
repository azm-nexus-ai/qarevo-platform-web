'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PortalMobileNavigation from '@/components/layout/PortalMobileNavigation'
import SignOutDialog from '@/components/layout/SignOutDialog'
import { DOCTOR_NAV_GROUPS } from '@/constants/portal-navigation'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import PortalAccountMenu from '@/components/layout/PortalAccountMenu'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { isPortalIdentityEvent } from '@/lib/portal-scope'
import { subscribeProfileChanges } from '@/lib/profile-events'
import { DOCTOR_ROUTES, isDoctorNavActive } from '@/constants/doctor-navigation'
import {
  clearPortalSession,
  getDoctorProfile,
  isAuthError,
  logoutCurrentUser,
  readSessionMarker,
  type DoctorProfileResponse,
} from '@/lib/api'

export default function DoctorMobileNavigation() {
  const router = useRouter()
  const t = useTranslations('shell')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileResponse | null>(null)
  const [identityRevision, setIdentityRevision] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

  const fullName = doctorProfile?.full_name?.trim() || t('doctorFallback')
  const displayName = fullName.toLowerCase().startsWith('dr.') ? fullName : `Dr. ${fullName}`
  const specialty = doctorProfile?.specialty || t('doctorFallback')

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutCurrentUser()
    } catch (error) {
      console.error('Doctor logout failed before local cleanup', error)
    } finally {
      setShowLogoutModal(false)
      router.replace('/auth/doctor/login')
    }
  }

  useEffect(() => {
    const token = readSessionMarker()
    if (!token) return
    let active = true
    let generation = 0
    const scope = readAccountScope('doctor')

    const fetchProfile = async () => {
      const ticket = ++generation
      try {
        const profile = await getDoctorProfile()
        if (active && ticket === generation && scope === readAccountScope('doctor')) setDoctorProfile(profile)
      } catch (error) {
        if (!active || ticket !== generation || scope !== readAccountScope('doctor')) return
        if (isAuthError(error)) {
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        console.error('Failed to load doctor profile:', error)
      }
    }

    void fetchProfile()
    const unsubscribe = subscribeProfileChanges('doctor', () => { void fetchProfile() })
    const reset = (event: Event) => { if (!isPortalIdentityEvent(event, 'doctor')) return; setDoctorProfile(null); setIdentityRevision(value => value + 1) }
    window.addEventListener(ACCOUNT_CHANGED, reset)
    window.addEventListener('storage', reset)
    return () => { active = false; unsubscribe(); window.removeEventListener(ACCOUNT_CHANGED, reset); window.removeEventListener('storage', reset) }
  }, [router, identityRevision])

  return (
    <>
      <PortalMobileNavigation portal='doctor' className='dmn-topbar' homeHref={DOCTOR_ROUTES.dashboard} homeLabel='Qarevo Health Doctor Dashboard'
        groups={DOCTOR_NAV_GROUPS} isActive={isDoctorNavActive} navLabel={t('doctorNavigation')} summaryLabel='Doctor summary'
        identity={{ name: displayName, description: specialty, avatar: <ProfileAvatar name={displayName} src={doctorProfile?.avatar_url} kind='doctor' size={42} /> }}
        accountMenu={<PortalAccountMenu portal='doctor' name={displayName} description={specialty} avatar={<ProfileAvatar name={displayName} src={doctorProfile?.avatar_url} kind='doctor' size={34} />} profileHref='/doctor/profile' settingsHref='/doctor/settings' />}
        onLogout={() => setShowLogoutModal(true)} loggingOut={loggingOut} />
      <SignOutDialog open={showLogoutModal} busy={loggingOut} onCancel={() => setShowLogoutModal(false)} onConfirm={() => void handleLogout()}
        description={t('doctorSignOutWarning')} />
    </>
  )
}

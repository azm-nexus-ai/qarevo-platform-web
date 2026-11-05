'use client'

import { useEffect, useState } from 'react'
import { getPatientSettings } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { isPortalEvent } from '@/lib/portal-scope'
import PortalAccountMenu from '@/components/layout/PortalAccountMenu'
import ProfileImage from './ProfileImage'

export default function PatientAccountMenu({ name }: { name?: string }) {
  const [identity, setIdentity] = useState<{ scope: string | null; name: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const scope = readAccountScope('patient')
  useEffect(() => {
    if (name) return
    let active = true
    const requestScope = readAccountScope('patient')
    if (requestScope) void getPatientSettings().then(settings => {
      if (active && requestScope === readAccountScope('patient')) setIdentity({ scope: requestScope, name: [settings.first_name, settings.last_name].filter(Boolean).join(' ') || 'Patient account' })
    }).catch(() => { if (active) setIdentity(null) })
    const reset = (event: Event) => { if (!isPortalEvent(event, 'patient')) return; setIdentity(null); setAttempt(value => value + 1) }
    window.addEventListener(ACCOUNT_CHANGED, reset)
    window.addEventListener('storage', reset)
    return () => { active = false; window.removeEventListener(ACCOUNT_CHANGED, reset); window.removeEventListener('storage', reset) }
  }, [name, attempt])
  const displayName = name || (identity?.scope === scope ? identity?.name : '') || 'Patient account'
  return <PortalAccountMenu portal='patient' name={displayName} description='Patient portal' avatar={<ProfileImage name={displayName} size={36} />} profileHref='/patient/settings' settingsHref='/patient/settings' />
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getPatientSafetyStatus } from '@/lib/safety-screen'

/**
 * Sends the patient to the safety questions before they choose a slot, unless a
 * recent passed screen on the current version is on record. The API enforces the
 * same rule at booking time; this only routes the patient there first. If the
 * status cannot be read, the page stays put and the server-side gate decides.
 */
export function useSafetyScreenGate() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  useEffect(() => {
    let cancelled = false
    getPatientSafetyStatus()
      .then(status => {
        if (cancelled || status.passed || !(status.available || status.required)) return
        const next = `${pathname}${query ? `?${query}` : ''}`
        router.replace(`/patient/consultation-booking/safety?next=${encodeURIComponent(next)}`)
      })
      .catch(() => { /* Server-side booking gate remains authoritative. */ })
    return () => { cancelled = true }
    // Only on entry: a passed screen does not need re-checking on every slot change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

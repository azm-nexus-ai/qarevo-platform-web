'use client'

import { useCallback, useEffect, useRef } from 'react'
import { readAccountScope } from './account-storage'
import { currentPortal, portalKey, readPortalIdentity } from './portal-scope'

/** Bind a UI continuation to the portal, session and page that initiated it. */
export function capturePortalAction(isMounted: () => boolean) {
  const portal = currentPortal()
  const scope = readAccountScope(portal)
  const sessionId = readPortalIdentity(portal)?.session_id
  const pathname = window.location.pathname
  return {
    portal,
    scope,
    pathname,
    isCurrent: ({ allowEndedSession = false }: { allowEndedSession?: boolean } = {}) => {
      if (!isMounted() || currentPortal() !== portal || window.location.pathname !== pathname) return false
      const current = readAccountScope(portal)
      return current === scope || (allowEndedSession && scope !== null && current === null &&
        window.localStorage.getItem(portalKey('signed-out', portal)) === sessionId)
    },
  }
}

export function usePortalAction() {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return useCallback(() => capturePortalAction(() => mounted.current), [])
}

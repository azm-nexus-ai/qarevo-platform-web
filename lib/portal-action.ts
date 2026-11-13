'use client'

import { useCallback, useEffect, useRef } from 'react'
import { readAccountScope } from './account-storage'
import { currentPortal, portalKey, readPortalIdentity, PORTAL_DEFINITIONS, type PortalIdentity } from './portal-scope'

type ContinuationOptions = { allowEndedSession?: boolean; completedSession?: PortalIdentity }

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
    isCurrent: ({ allowEndedSession = false, completedSession }: ContinuationOptions = {}) => {
      if (!isMounted() || currentPortal() !== portal || window.location.pathname !== pathname) return false
      const current = readAccountScope(portal)
      if (completedSession) {
        const expectedRole = PORTAL_DEFINITIONS[portal].role
        return completedSession.role === expectedRole && !!completedSession.user_id && !!completedSession.session_id &&
          current === JSON.stringify([portal, completedSession.user_id, completedSession.session_id])
      }
      return current === scope || (allowEndedSession && scope !== null && current === null &&
        window.localStorage.getItem(portalKey('signed-out', portal)) === sessionId)
    },
  }
}

export function usePortalAction() {
  const mounted = useRef(false)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    mounted.current = true
    const scheduled = timers.current
    return () => {
      mounted.current = false
      for (const timer of scheduled) clearTimeout(timer)
      scheduled.clear()
    }
  }, [])
  return useCallback(() => {
    const action = capturePortalAction(() => mounted.current)
    return { ...action, after(delay: number, continuation: () => void, options: ContinuationOptions = {}) {
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        if (action.isCurrent(options)) continuation()
      }, delay)
      timers.current.add(timer)
    } }
  }, [])
}

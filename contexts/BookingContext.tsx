'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { currentPortal, isPortalEvent, portalKey, protectedPortalPath, PORTAL_DEFINITIONS, type Portal } from '@/lib/portal-scope'
import {
  ACCOUNT_CHANGED, assertCurrentAccount, clearPrivateBrowserState,
  createAccountDraftStorage, readAccountScope,
} from '@/lib/account-storage'

export interface BookingState {
  physicianId?: string
  physicianName?: string
  service?: string
  date?: string
  slot?: string
  notes?: string
  agreed?: boolean
  step: 'discovery' | 'profile' | 'datetime' | 'review' | 'success'
}

export interface BookingContextType {
  bookingState: BookingState
  updateBookingState: (updates: Partial<BookingState>) => void
  resetBookingState: () => void
  setBookingStep: (step: BookingState['step']) => void
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)
const initialState: BookingState = { step: 'discovery' }
const STORAGE_KEY = 'qarevo_booking_state'

function returnToSignIn(portal: Portal) {
  const destination = PORTAL_DEFINITIONS[portal].signIn
  window.location.replace(destination)
}

export function BookingProvider({ children, portal: selectedPortal }: { children: ReactNode; portal?: Portal }) {
  // PortalSessionBoundary remounts this provider when the active portal changes.
  const [portal] = useState(() => selectedPortal ?? currentPortal())
  const [bookingState, setBookingState] = useState<BookingState>(initialState)
  const [draftStorage, setDraftStorage] = useState(() => createAccountDraftStorage(portal))
  const [blocked, setBlocked] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const logoutSeen = useRef(false)

  useEffect(() => {
    try {
      const saved = draftStorage.getItem(STORAGE_KEY)
      if (saved) setBookingState({ ...initialState, ...JSON.parse(saved) })
    } catch {
      setBookingState(initialState)
    } finally {
      setHydrated(true)
    }
  }, [draftStorage])

  useEffect(() => {
    const logoutPending = () => {
      try { return Boolean(window.localStorage.getItem(portalKey('logout-pending', portal))) } catch { return false }
    }
    const reset = (event: Event) => {
      if (!isPortalEvent(event, portal)) return
      if (logoutPending()) { logoutSeen.current = true; setSigningOut(true); setBlocked(true); return }
      if (logoutSeen.current && !readAccountScope(portal)) { returnToSignIn(portal); return }
      const path = window.location.pathname
      if (!readAccountScope(portal) && protectedPortalPath(path)) {
        setBlocked(true)
        returnToSignIn(portal)
        return
      }
      logoutSeen.current = false
      setSigningOut(false)
      setBlocked(false)
      setHydrated(false)
      setBookingState(initialState)
      setDraftStorage(createAccountDraftStorage(portal))
    }
    const check = (event?: Event) => {
      if (event && !isPortalEvent(event, portal)) return
      if (logoutPending()) { logoutSeen.current = true; setSigningOut(true); setBlocked(true); return }
      if (logoutSeen.current && !readAccountScope(portal)) { returnToSignIn(portal); return }
      try {
        assertCurrentAccount(portal)
      } catch {
        setBlocked(true)
        try { clearPrivateBrowserState(portal) } finally {
          returnToSignIn(portal)
        }
      }
    }
    window.addEventListener(ACCOUNT_CHANGED, reset)
    window.addEventListener('storage', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    check()
    return () => {
      window.removeEventListener(ACCOUNT_CHANGED, reset)
      window.removeEventListener('storage', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
    }
  }, [portal])

  const updateBookingState = useCallback((updates: Partial<BookingState>) => {
    assertCurrentAccount(portal)
    setBookingState(previous => ({ ...previous, ...updates }))
  }, [portal])

  useEffect(() => {
    if (!hydrated || !readAccountScope(portal)) return
    try {
      draftStorage.setItem(STORAGE_KEY, JSON.stringify(bookingState))
    } catch {
      // Keep the current in-memory draft; never fall back to shared storage.
    }
  }, [bookingState, draftStorage, hydrated, portal])

  const resetBookingState = useCallback(() => {
    setBookingState(initialState)
    draftStorage.removeItem(STORAGE_KEY)
  }, [draftStorage])

  const setBookingStep = useCallback((step: BookingState['step']) => {
    updateBookingState({ step })
  }, [updateBookingState])

  if (blocked) return <p role="status">{signingOut ? 'Signing out securely…' : 'Your session changed. Returning to sign in…'}</p>

  return (
    <BookingContext.Provider value={{ bookingState, updateBookingState, resetBookingState, setBookingStep }}>
      {children}
    </BookingContext.Provider>
  )
}

export function useBookingContext() {
  const context = useContext(BookingContext)
  if (context === undefined) throw new Error('useBookingContext must be used within a BookingProvider')
  return context
}

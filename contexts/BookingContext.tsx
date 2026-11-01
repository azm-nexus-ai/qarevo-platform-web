'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
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

function returnToSignIn() {
  const path = window.location.pathname
  const destination = path.startsWith('/doctor') || path.startsWith('/auth/doctor')
    ? '/auth/doctor/login'
    : path.startsWith('/admin') || path.startsWith('/auth/admin')
      ? '/auth/admin/login'
      : '/auth/sign-in'
  window.location.replace(destination)
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookingState, setBookingState] = useState<BookingState>(initialState)
  const [draftStorage, setDraftStorage] = useState(createAccountDraftStorage)
  const [blocked, setBlocked] = useState(false)
  const [hydrated, setHydrated] = useState(false)

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
    const reset = () => {
      const path = window.location.pathname
      if (!readAccountScope() && (
        path.startsWith('/patient') || path.startsWith('/doctor') ||
        path.startsWith('/admin') || path.startsWith('/auth/profile-setup')
      )) {
        setBlocked(true)
        returnToSignIn()
        return
      }
      setHydrated(false)
      setBookingState(initialState)
      setDraftStorage(createAccountDraftStorage())
    }
    const check = () => {
      try {
        assertCurrentAccount()
      } catch {
        setBlocked(true)
        try { clearPrivateBrowserState() } finally {
          returnToSignIn()
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
  }, [])

  const updateBookingState = useCallback((updates: Partial<BookingState>) => {
    assertCurrentAccount()
    setBookingState(previous => ({ ...previous, ...updates }))
  }, [])

  useEffect(() => {
    if (!hydrated || !readAccountScope()) return
    try {
      draftStorage.setItem(STORAGE_KEY, JSON.stringify(bookingState))
    } catch {
      // Keep the current in-memory draft; never fall back to shared storage.
    }
  }, [bookingState, draftStorage, hydrated])

  const resetBookingState = useCallback(() => {
    setBookingState(initialState)
    draftStorage.removeItem(STORAGE_KEY)
  }, [draftStorage])

  const setBookingStep = useCallback((step: BookingState['step']) => {
    updateBookingState({ step })
  }, [updateBookingState])

  if (blocked) return <p role="status">Your session changed. Returning to sign in...</p>

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

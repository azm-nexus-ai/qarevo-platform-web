'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

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

const initialState: BookingState = {
  step: 'discovery',
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookingState, setBookingState] = useState<BookingState>(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('qarevo_booking_state')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return initialState
        }
      }
    }
    return initialState
  })

  const updateBookingState = (updates: Partial<BookingState>) => {
    setBookingState((prev) => {
      const newState = { ...prev, ...updates }
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('qarevo_booking_state', JSON.stringify(newState))
      }
      return newState
    })
  }

  const resetBookingState = () => {
    setBookingState(initialState)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qarevo_booking_state')
    }
  }

  const setBookingStep = (step: BookingState['step']) => {
    updateBookingState({ step })
  }

  return (
    <BookingContext.Provider value={{ bookingState, updateBookingState, resetBookingState, setBookingStep }}>
      {children}
    </BookingContext.Provider>
  )
}

export function useBookingContext() {
  const context = useContext(BookingContext)
  if (context === undefined) {
    throw new Error('useBookingContext must be used within a BookingProvider')
  }
  return context
}

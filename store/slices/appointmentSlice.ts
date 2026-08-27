import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type AppointmentStatus =
  | 'Confirmed'
  | 'Today'
  | 'Starting Soon'
  | 'Waiting'
  | 'Rescheduled'
  | 'Completed'
  | 'Cancelled'

export type ConsultationType = 'Video Consultation' | 'In-Person' | 'Follow-Up' | 'Second Opinion'

export type Appointment = {
  id: string
  physician: string
  specialty: string
  hospital: string
  imageUrl: string
  consultationType: ConsultationType
  date: string
  time: string
  duration: string
  status: AppointmentStatus
  bookingRef: string
  reason: string
  paymentStatus: 'Paid' | 'Pending' | 'Refunded'
  cancellationDate?: string
  cancellationReason?: string
  hasSummary?: boolean
  hasPrescription?: boolean
  hasLabRequest?: boolean
}

export type AppointmentTab = 'upcoming' | 'past' | 'cancelled'

export type BookingDraft = {
  physicianId: string
  service: string
  date: string
  slot: string
  fee: number
  insurance: string
  notes: string
  duration: string
}

export interface AppointmentSlice {
  upcoming: Appointment[]
  past: Appointment[]
  cancelled: Appointment[]
  activeTab: AppointmentTab
  selectedAppointmentId: string | null
  bookingDraft: BookingDraft
  setUpcoming: (appointments: Appointment[]) => void
  setPast: (appointments: Appointment[]) => void
  setCancelled: (appointments: Appointment[]) => void
  setActiveTab: (activeTab: AppointmentTab) => void
  selectAppointment: (appointmentId: string | null) => void
  updateBookingDraft: (patch: Partial<BookingDraft>) => void
  resetBookingDraft: () => void
  resetAppointments: () => void
}

const DEFAULT_BOOKING_DRAFT: BookingDraft = {
  physicianId: '',
  service: '',
  date: '',
  slot: '',
  fee: 0,
  insurance: '',
  notes: '',
  duration: '',
}

export const createAppointmentSlice: StateCreator<StoreState, [], [], AppointmentSlice> = (set) => ({
  upcoming: [],
  past: [],
  cancelled: [],
  activeTab: 'upcoming',
  selectedAppointmentId: null,
  bookingDraft: DEFAULT_BOOKING_DRAFT,

  setUpcoming: (upcoming) => set({ upcoming }),

  setPast: (past) => set({ past }),

  setCancelled: (cancelled) => set({ cancelled }),

  setActiveTab: (activeTab) => set({ activeTab }),

  selectAppointment: (selectedAppointmentId) => set({ selectedAppointmentId }),

  updateBookingDraft: (patch) =>
    set((state) => ({
      bookingDraft: { ...state.bookingDraft, ...patch },
    })),

  resetBookingDraft: () => set({ bookingDraft: DEFAULT_BOOKING_DRAFT }),

  resetAppointments: () =>
    set({
      upcoming: [],
      past: [],
      cancelled: [],
      activeTab: 'upcoming',
      selectedAppointmentId: null,
      bookingDraft: DEFAULT_BOOKING_DRAFT,
    }),
})

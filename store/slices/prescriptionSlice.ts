import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type MedicationItem = {
  name: string
  brand: string
  strength: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  food: string
  times: string[]
  refill: string
  accent: string
}

export type CarePlanItem = {
  title: string
  body: string
  icon: string | readonly string[]
}

export type PrescriptionDocument = {
  title: string
  meta: string
}

export type ReminderPreference = 'push' | 'sms' | 'email' | 'calendar'

export interface PrescriptionSlice {
  medications: MedicationItem[]
  carePlan: CarePlanItem[]
  documents: PrescriptionDocument[]
  reminderPreferences: Record<ReminderPreference, boolean>
  setMedications: (medications: MedicationItem[]) => void
  setCarePlan: (carePlan: CarePlanItem[]) => void
  setDocuments: (documents: PrescriptionDocument[]) => void
  toggleReminder: (id: ReminderPreference) => void
  resetPrescription: () => void
}

const DEFAULT_REMINDER_PREFERENCES: Record<ReminderPreference, boolean> = {
  push: true,
  sms: false,
  email: true,
  calendar: false,
}

export const createPrescriptionSlice: StateCreator<StoreState, [], [], PrescriptionSlice> = (set) => ({
  medications: [],
  carePlan: [],
  documents: [],
  reminderPreferences: DEFAULT_REMINDER_PREFERENCES,

  setMedications: (medications) => set({ medications }),

  setCarePlan: (carePlan) => set({ carePlan }),

  setDocuments: (documents) => set({ documents }),

  toggleReminder: (id) =>
    set((state) => ({
      reminderPreferences: {
        ...state.reminderPreferences,
        [id]: !state.reminderPreferences[id],
      },
    })),

  resetPrescription: () =>
    set({
      medications: [],
      carePlan: [],
      documents: [],
      reminderPreferences: DEFAULT_REMINDER_PREFERENCES,
    }),
})

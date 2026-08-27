import type { StateCreator } from 'zustand'
import type { Physician } from '@/constants/physicians'
import type { StoreState } from '../types'

export type DoctorFilters = {
  q: string
  specialty: string
  availability: string
  gender: string
  language: string
  experience: string
  consultationType: string
  insurance: string
  rating: string
  price: string
  distance: string
  sort: string
}

export interface DoctorSlice {
  physicians: Physician[]
  selectedPhysicianId: string | null
  filters: DoctorFilters
  setPhysicians: (physicians: Physician[]) => void
  selectPhysician: (physicianId: string | null) => void
  setFilters: (patch: Partial<DoctorFilters>) => void
  resetFilters: () => void
  resetDoctors: () => void
}

const DEFAULT_FILTERS: DoctorFilters = {
  q: '',
  specialty: 'any',
  availability: 'any',
  gender: 'any',
  language: 'any',
  experience: 'any',
  consultationType: 'any',
  insurance: 'any',
  rating: 'any',
  price: 'any',
  distance: 'any',
  sort: 'recommended',
}

export const createDoctorSlice: StateCreator<StoreState, [], [], DoctorSlice> = (set) => ({
  physicians: [],
  selectedPhysicianId: null,
  filters: DEFAULT_FILTERS,

  setPhysicians: (physicians) => set({ physicians }),

  selectPhysician: (selectedPhysicianId) => set({ selectedPhysicianId }),

  setFilters: (patch) =>
    set((state) => ({
      filters: { ...state.filters, ...patch },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  resetDoctors: () =>
    set({
      physicians: [],
      selectedPhysicianId: null,
      filters: DEFAULT_FILTERS,
    }),
})

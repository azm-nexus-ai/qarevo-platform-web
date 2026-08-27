import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type TestRequestItem = {
  name: string
  category: string
  description: string
  reason: string
  priority: string
  completionDate: string
  processingTime: string
  status: string
  badgeTone: string
}

export type LabItem = {
  name: string
  distance: string
  rating: string
  hours: string
  tests: string[]
  insurance: string
  address: string
}

export type LabPreparationItem = {
  title: string
  body: string
}

export type LabUploadItem = {
  title: string
  meta: string
}

export interface LabRequestSlice {
  testRequests: TestRequestItem[]
  partnerLabs: LabItem[]
  preparation: LabPreparationItem[]
  uploads: LabUploadItem[]
  selectedLabId: string | null
  setTestRequests: (testRequests: TestRequestItem[]) => void
  setPartnerLabs: (partnerLabs: LabItem[]) => void
  setPreparation: (preparation: LabPreparationItem[]) => void
  setUploads: (uploads: LabUploadItem[]) => void
  selectLab: (labId: string | null) => void
  addUpload: (upload: LabUploadItem) => void
  resetLabRequests: () => void
}

export const createLabRequestSlice: StateCreator<StoreState, [], [], LabRequestSlice> = (set) => ({
  testRequests: [],
  partnerLabs: [],
  preparation: [],
  uploads: [],
  selectedLabId: null,

  setTestRequests: (testRequests) => set({ testRequests }),

  setPartnerLabs: (partnerLabs) => set({ partnerLabs }),

  setPreparation: (preparation) => set({ preparation }),

  setUploads: (uploads) => set({ uploads }),

  selectLab: (selectedLabId) => set({ selectedLabId }),

  addUpload: (upload) =>
    set((state) => ({
      uploads: [upload, ...state.uploads],
    })),

  resetLabRequests: () =>
    set({
      testRequests: [],
      partnerLabs: [],
      preparation: [],
      uploads: [],
      selectedLabId: null,
    }),
})

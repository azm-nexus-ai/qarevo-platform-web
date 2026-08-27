import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type RecordType =
  | 'Consultation'
  | 'Prescription'
  | 'Lab Result'
  | 'Diagnosis'
  | 'Referral'
  | 'Medical Document'

export type RecordStatus = 'Available' | 'Pending' | 'Archived'

export type MedicalRecord = {
  id: string
  type: RecordType
  title: string
  provider: string
  specialty: string
  date: string
  status: RecordStatus
  lastUpdated: string
  fileType?: string
  fileSize?: string
  summary?: string
  clinicalNotes?: string
  recommendations?: string
  canPreview: boolean
  canDownload: boolean
  canDelete: boolean
}

export type TimelineEvent = {
  id: string
  date: string
  event: string
  provider: string
  recordId?: string
}

export interface MedicalRecordSlice {
  records: MedicalRecord[]
  timeline: TimelineEvent[]
  categoryFilter: RecordType | 'All'
  searchQuery: string
  selectedRecordId: string | null
  previewRecordId: string | null
  setRecords: (records: MedicalRecord[]) => void
  setTimeline: (timeline: TimelineEvent[]) => void
  setCategoryFilter: (categoryFilter: RecordType | 'All') => void
  setSearchQuery: (searchQuery: string) => void
  selectRecord: (recordId: string | null) => void
  previewRecord: (recordId: string | null) => void
  addRecord: (record: MedicalRecord) => void
  removeRecord: (recordId: string) => void
  resetMedicalRecords: () => void
}

export const createMedicalRecordSlice: StateCreator<StoreState, [], [], MedicalRecordSlice> = (set) => ({
  records: [],
  timeline: [],
  categoryFilter: 'All',
  searchQuery: '',
  selectedRecordId: null,
  previewRecordId: null,

  setRecords: (records) => set({ records }),

  setTimeline: (timeline) => set({ timeline }),

  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  selectRecord: (selectedRecordId) => set({ selectedRecordId }),

  previewRecord: (previewRecordId) => set({ previewRecordId }),

  addRecord: (record) =>
    set((state: { records: MedicalRecord[] }) => ({
      records: [record, ...state.records],
    })),

  removeRecord: (recordId) =>
    set((state) => ({
      records: state.records.filter((record) => record.id !== recordId),
      selectedRecordId: state.selectedRecordId === recordId ? null : state.selectedRecordId,
      previewRecordId: state.previewRecordId === recordId ? null : state.previewRecordId,
    })),

  resetMedicalRecords: () =>
    set({
      records: [],
      timeline: [],
      categoryFilter: 'All',
      searchQuery: '',
      selectedRecordId: null,
      previewRecordId: null,
    }),
})

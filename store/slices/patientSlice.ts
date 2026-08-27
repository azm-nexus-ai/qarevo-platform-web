import type { StateCreator } from 'zustand'
import type { AuthFlowState } from '@/lib/auth-flow'
import type { StoreState } from '../types'

export interface PatientSlice {
  authFlow: AuthFlowState
  isLoading: boolean
  error: string | null
  setAuthFlow: (authFlow: AuthFlowState) => void
  updateAuthFlow: (patch: Partial<AuthFlowState>) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  resetPatient: () => void
}

const DEFAULT_AUTH_FLOW: AuthFlowState = {
  isAuthenticated: false,
  onboardingCompleted: false,
  currentStage: 'email-verification',
  updatedAt: '',
}

export const createPatientSlice: StateCreator<StoreState, [], [], PatientSlice> = (set) => ({
  authFlow: DEFAULT_AUTH_FLOW,
  isLoading: false,
  error: null,

  setAuthFlow: (authFlow) => set({ authFlow }),

  updateAuthFlow: (patch) =>
    set((state) => ({
      authFlow: {
        ...state.authFlow,
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  resetPatient: () =>
    set({
      authFlow: DEFAULT_AUTH_FLOW,
      isLoading: false,
      error: null,
    }),
})

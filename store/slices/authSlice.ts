import type { StateCreator } from 'zustand'

export interface User {
  id: string
  email: string
  role?: 'PATIENT' | 'PROVIDER'
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  setIsAuthenticated: (isAuthenticated: boolean) => void
  setUser: (user: User | null) => void
  resetAuth: () => void
}

export interface AuthSlice {
    isAuthenticated: boolean
    user: User | null
    isLoading: boolean
    error: string | null
    setIsAuthenticated: (isAuthenticated: boolean) => void
    setUser: (user: User | null) => void
    resetAuth: () => void
  }

export type StoreState = AuthSlice

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (set) => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null,
    setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setUser: (user) => set({ user }),
    resetAuth: () => set({ isAuthenticated: false, user: null }),
  })

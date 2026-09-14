import type { StateCreator } from 'zustand'
import { signupRequest } from '@/lib/auth-flow'

export interface User {
  id: string
  email: string
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
    signup: (email: string, password: string) => Promise<void>
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
    signup: async (email, password) => {
      set({ isLoading: true, error: null })
      try {
        const data = await signupRequest(email, password)
        set({ user: data.user, isAuthenticated: true, isLoading: false })
      } catch (err) {
        set({ error: (err as Error).message, isLoading: false })
      }
    },
    setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setUser: (user) => set({ user }),
    resetAuth: () => set({ isAuthenticated: false, user: null }),
  })

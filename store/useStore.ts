import { create } from 'zustand'
import { createAuthSlice, type StoreState } from '@/store/slices/authSlice'

  
export const useStore = create<StoreState>()((...a) => ({
  ...createAuthSlice(...a),
}))

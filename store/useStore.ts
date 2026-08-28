import { create } from 'zustand'
import { createAuthSlice } from '@/store/slices/authSlice'

  
export const useStore = create<any>()((...a) => ({
  ...createAuthSlice(...a),
}))

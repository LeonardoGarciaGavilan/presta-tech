import { create } from 'zustand';

import type { AuthState } from '@/types/auth.types';

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  needsPasswordChange: false,

  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  clearUser: () => set({ user: null, isAuthenticated: false, needsPasswordChange: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  setNeedsPasswordChange: (needs) => set({ needsPasswordChange: needs }),

  setHydrated: () => set({ isHydrated: true }),
}));

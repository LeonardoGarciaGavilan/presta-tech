import { create } from 'zustand';

import storage from '@/utils/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  isHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'theme_mode';

export const useThemeStore = create<ThemeState>()((set) => ({
  themeMode: 'system',
  isHydrated: false,

  setThemeMode: (themeMode) => {
    set({ themeMode });
    storage.setItem(STORAGE_KEY, themeMode).catch(() => {});
  },

  hydrate: async () => {
    try {
      const saved = await storage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        set({ themeMode: saved });
      }
    } catch {
      // ignore
    }
    set({ isHydrated: true });
  },
}));

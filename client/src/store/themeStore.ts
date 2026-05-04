import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_MODE_KEY = 'chatters_dark_mode';

interface ThemeState {
  isDark: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  toggleDarkMode: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(DARK_MODE_KEY);
      set({ isDark: stored === 'true', isInitialized: true });
    } catch {
      set({ isInitialized: true });
    }
  },

  toggleDarkMode: async () => {
    const next = !get().isDark;
    set({ isDark: next });
    try {
      await AsyncStorage.setItem(DARK_MODE_KEY, String(next));
    } catch {
      // non-fatal
    }
  },
}));

import React, { createContext, useContext, useMemo } from 'react';
import { lightColors, darkColors, Colors } from '../theme';
import { useThemeStore } from '../store/themeStore';

interface ThemeContextValue {
  colors: Colors;
  isDark: boolean;
  toggleDarkMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  toggleDarkMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark, toggleDarkMode } = useThemeStore();

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      toggleDarkMode,
    }),
    [isDark, toggleDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

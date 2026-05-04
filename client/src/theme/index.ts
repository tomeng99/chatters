import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightColors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  onPrimary: '#FFFFFF',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  messageBubbleSent: '#4F46E5',
  messageBubbleReceived: '#F3F4F6',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#111827',
  online: '#10B981',
  linkSent: '#C7D2FE',
};

export const darkColors = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  primaryLight: '#A5B4FC',
  onPrimary: '#FFFFFF',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#334155',
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  messageBubbleSent: '#6366F1',
  messageBubbleReceived: '#1E293B',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#F1F5F9',
  online: '#34D399',
  linkSent: '#C7D2FE',
};

export type Colors = typeof lightColors;

// Keep `colors` export pointing at light palette so legacy static imports compile.
// Components that need dynamic theming should use `useTheme()` from ThemeContext instead.
export const colors = lightColors;

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSizeXXL: 28,
  fontSizeInput: 16, // Minimum font size to prevent mobile browser auto-zoom on input focus
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  round: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightColors.primary,
    onPrimary: lightColors.onPrimary,
    primaryContainer: lightColors.primaryLight + '20',
    secondary: lightColors.textSecondary,
    background: lightColors.background,
    surface: lightColors.surface,
    error: lightColors.error,
    outline: lightColors.border,
  },
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary,
    onPrimary: darkColors.onPrimary,
    primaryContainer: darkColors.primaryLight + '20',
    secondary: darkColors.textSecondary,
    background: darkColors.background,
    surface: darkColors.surface,
    error: darkColors.error,
    outline: darkColors.border,
  },
};

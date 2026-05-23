import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightColors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  onPrimary: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  messageBubbleSent: '#4F46E5',
  messageBubbleReceived: '#F1F5F9',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#0F172A',
  online: '#10B981',
  linkSent: '#C7D2FE',
  // Gradient colors
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  // Focus and interaction states
  focusRing: '#818CF8',
  ripple: 'rgba(79, 70, 229, 0.12)',
  hover: 'rgba(79, 70, 229, 0.04)',
};

export const darkColors = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  primaryLight: '#A5B4FC',
  onPrimary: '#FFFFFF',
  background: '#0A0F1E',
  surface: '#151B2E',
  surfaceSecondary: '#1E293B',
  surfaceElevated: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#1E293B',
  borderLight: '#334155',
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  info: '#60A5FA',
  messageBubbleSent: '#6366F1',
  messageBubbleReceived: '#1E293B',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#F1F5F9',
  online: '#34D399',
  linkSent: '#C7D2FE',
  // Gradient colors
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  // Focus and interaction states
  focusRing: '#A5B4FC',
  ripple: 'rgba(129, 140, 248, 0.16)',
  hover: 'rgba(129, 140, 248, 0.08)',
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
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const animations = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
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

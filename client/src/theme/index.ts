import { MD3LightTheme } from 'react-native-paper';

export const colors = {
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

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSizeXXL: 28,
  fontSizeInput: 16, // Minimum font size to prevent iOS auto-zoom on input focus
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
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.primaryLight + '20',
    secondary: colors.textSecondary,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    outline: colors.border,
  },
};

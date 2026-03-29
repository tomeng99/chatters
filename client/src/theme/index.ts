export const colors = {
  primary: '#007AFF',
  primaryDark: '#0056CC',
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceSecondary: '#E5E5EA',
  text: '#000000',
  textSecondary: '#6C6C70',
  textTertiary: '#AEAEB2',
  border: '#C6C6C8',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  messageBubbleSent: '#007AFF',
  messageBubbleReceived: '#E5E5EA',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#000000',
  online: '#34C759',
};

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSizeXXL: 24,
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
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
};

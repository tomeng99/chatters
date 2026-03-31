import React from 'react';
import { Text, StyleSheet, TextStyle, TextProps } from 'react-native';
import { colors, typography } from '../theme';

type Variant = 'heading' | 'title' | 'body' | 'caption' | 'label';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  style?: TextStyle;
  children: React.ReactNode;
}

export default function AppText({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[styles[variant], color ? { color } : undefined, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
  },
  title: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
  },
  body: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightRegular,
    color: colors.text,
  },
  caption: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightRegular,
    color: colors.textSecondary,
  },
  label: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightRegular,
    color: colors.textTertiary,
  },
});

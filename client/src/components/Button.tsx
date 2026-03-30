import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';

type Variant = 'primary' | 'secondary' | 'text';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.textVariant,
        isDisabled && styles.disabled,
        pressed && !isDisabled && variant === 'primary' && styles.primaryPressed,
        pressed && !isDisabled && variant === 'secondary' && styles.secondaryPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.surface : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'text' && styles.textLabel,
            isDisabled && styles.disabledLabel,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryPressed: {
    backgroundColor: colors.primary + '08',
  },
  textVariant: {
    backgroundColor: 'transparent',
    height: 'auto' as any,
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
    letterSpacing: 0.3,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: colors.primary,
  },
  textLabel: {
    color: colors.primary,
  },
  disabledLabel: {
    opacity: 0.7,
  },
});

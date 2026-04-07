import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  containerStyle,
  rightIcon,
  secureTextEntry,
  ...rest
}: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isSecure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsSecure((prev) => !prev)}
            style={styles.eyeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
          >
            <MaterialCommunityIcons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
        {rightIcon && !secureTextEntry ? (
          <View style={styles.rightIcon}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: Platform.OS === 'ios' ? typography.fontSizeInput : typography.fontSizeMD,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  rightIcon: {
    marginLeft: spacing.xs,
  },
  error: {
    marginTop: spacing.xs,
    fontSize: typography.fontSizeXS,
    color: colors.error,
  },
});

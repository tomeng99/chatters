import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
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
          <TouchableOpacity
            onPress={() => setIsSecure((prev) => !prev)}
            style={styles.eyeButton}
          >
            <Text style={styles.eyeText}>{isSecure ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
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
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: typography.fontSizeMD,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  eyeText: {
    fontSize: 16,
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

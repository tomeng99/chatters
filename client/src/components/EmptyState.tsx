import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppText from './AppText';
import Button from './Button';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  subtitle?: string;
  // 'error' tints the icon with the error colour, to separate a state the user can
  // retry out of (a failed load) from a genuinely empty list.
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  tone = 'neutral',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons
        name={icon}
        size={64}
        color={tone === 'error' ? colors.error : colors.border}
      />
      <AppText variant="title" style={styles.title}>{title}</AppText>
      {subtitle ? <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>{subtitle}</AppText> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="secondary"
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});

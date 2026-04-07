import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing } from '../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export default function EmptyState({ icon, title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

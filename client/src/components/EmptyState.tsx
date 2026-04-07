import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppText from './AppText';
import { colors, spacing } from '../theme';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export default function EmptyState({ icon, title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name={icon} size={64} color={colors.border} />
      <AppText variant="title" style={styles.title}>{title}</AppText>
      {subtitle ? <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>{subtitle}</AppText> : null}
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
});

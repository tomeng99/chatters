import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

interface EncryptionBadgeProps {
  color?: string;
  size?: number;
}

export default function EncryptionBadge({
  color = colors.success,
  size = 12,
}: EncryptionBadgeProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { fontSize: size, color }]}>🔒</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    lineHeight: 14,
  },
});

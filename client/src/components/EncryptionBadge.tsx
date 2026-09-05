import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface EncryptionBadgeProps {
  color?: string;
  size?: number;
}

export default function EncryptionBadge({
  color,
  size = 12,
}: EncryptionBadgeProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.success;
  // Decorative: every place this badge is used already says "encrypted" in the
  // surrounding text or accessibility label, and the bare icon glyph is read out
  // as a stray character otherwise.
  return (
    <View style={styles.container} aria-hidden>
      <MaterialCommunityIcons name="lock" size={size} color={resolvedColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

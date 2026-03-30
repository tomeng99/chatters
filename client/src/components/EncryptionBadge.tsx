import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

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
      <MaterialCommunityIcons name="lock" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

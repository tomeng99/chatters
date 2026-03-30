import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { typography } from '../theme';

interface AvatarProps {
  username: string;
  size?: number;
  style?: ViewStyle;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function stringToColor(str: string): string {
  const palette = [
    '#4F46E5', '#7C3AED', '#2563EB', '#0891B2',
    '#059669', '#D97706', '#DC2626', '#DB2777',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

const INITIALS_SIZE_RATIO = 0.36;

export default function Avatar({ username, size = 40, style }: AvatarProps) {
  const bg = stringToColor(username);
  const fontSize = size * INITIALS_SIZE_RATIO;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{getInitials(username)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeightSemiBold,
    letterSpacing: 0.5,
  },
});

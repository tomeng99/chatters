import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, borderRadius } from '../theme';

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
    '#5E5CE6', '#32ADE6', '#30D158', '#FF9F0A',
    '#FF453A', '#FF6961', '#9B59B6', '#1ABC9C',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export default function Avatar({ username, size = 40, style }: AvatarProps) {
  const bg = stringToColor(username);
  const fontSize = size * 0.38;

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
  },
});

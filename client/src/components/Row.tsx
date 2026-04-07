import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface RowProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Row({ children, style }: RowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  centered?: boolean;
}

export default function ScreenContainer({ children, style, centered }: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.container, centered && styles.centered, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import AppText from './AppText';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({
  size = 'medium',
  showText = true,
}: LogoProps) {
  const { colors } = useTheme();

  const iconSize = size === 'small' ? 24 : size === 'medium' ? 40 : 56;
  const containerSize = size === 'small' ? 48 : size === 'medium' ? 72 : 96;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            width: containerSize,
            height: containerSize,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="chat-processing"
          size={iconSize}
          color="#FFFFFF"
        />
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <AppText
            variant={size === 'large' ? 'heading' : 'title'}
            style={{
              fontWeight: '700',
              letterSpacing: -0.5,
            }}
          >
            Chatters
          </AppText>
          <AppText
            variant="caption"
            style={{
              color: colors.textSecondary,
              marginTop: spacing.xs / 2,
            }}
          >
            Secure private messaging
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});

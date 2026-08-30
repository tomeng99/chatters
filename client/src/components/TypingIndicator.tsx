import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { typography, spacing, borderRadius } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface TypingIndicatorProps {
  /** Usernames currently typing, excluding the local user. */
  usernames: string[];
  /** Group chats name who is typing; 1:1 chats just show the dots. */
  showNames?: boolean;
}

const DOT_COUNT = 3;
const DOT_DURATION = 400;

function formatTypingLabel(usernames: string[]): string {
  if (usernames.length === 1) return `${usernames[0]} is typing`;
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]} are typing`;
  return `${usernames.length} people are typing`;
}

function AnimatedDot({ index, color }: { index: number; color: string }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(index * DOT_DURATION),
        Animated.timing(value, {
          toValue: 1,
          duration: DOT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: DOT_DURATION,
          useNativeDriver: true,
        }),
        // Hold still while the remaining dots take their turn.
        Animated.delay((DOT_COUNT - 1 - index) * DOT_DURATION),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [value, index]);

  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View
      style={[dotStyles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]}
    />
  );
}

export default function TypingIndicator({ usernames, showNames = false }: TypingIndicatorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (usernames.length === 0) return null;

  const label = formatTypingLabel(usernames);

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <View style={styles.bubble}>
        {showNames && (
          <Text style={styles.name} numberOfLines={1}>
            {label}
          </Text>
        )}
        <View style={styles.dots}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <AnimatedDot key={i} index={i} color={colors.textSecondary} />
          ))}
        </View>
      </View>
    </View>
  );
}

// Dot geometry does not depend on the palette, so it stays in a static sheet.
const dotStyles = StyleSheet.create({
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginVertical: 2,
      paddingHorizontal: spacing.md,
    },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.lg,
      borderBottomLeftRadius: borderRadius.sm,
      backgroundColor: colors.messageBubbleReceived,
    },
    name: {
      fontSize: typography.fontSizeXS,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.primary,
      marginBottom: 4,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 8,
    },
  });

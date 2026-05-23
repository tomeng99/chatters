import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing } from '../theme';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function LoadingSkeleton({
  width = '100%',
  height = 20,
  borderRadius: radius = borderRadius.sm,
  style,
}: LoadingSkeletonProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[{ width: width as any, height, borderRadius: radius }, style]}>
      <Animated.View
        style={[
          styles.skeleton,
          {
            width: '100%',
            height: '100%',
            borderRadius: radius,
            backgroundColor: colors.surfaceSecondary,
          },
          { opacity },
        ]}
      />
    </View>
  );
}

export function ConversationListSkeleton() {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.conversationItem}>
          <LoadingSkeleton width={48} height={48} borderRadius={borderRadius.round} />
          <View style={styles.conversationText}>
            <LoadingSkeleton width="60%" height={16} style={{ marginBottom: spacing.xs }} />
            <LoadingSkeleton width="80%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function MessageListSkeleton() {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View
          key={i}
          style={[
            styles.messageItem,
            i % 2 === 0 ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
          ]}
        >
          <LoadingSkeleton
            width={Math.random() * 100 + 150}
            height={40}
            borderRadius={borderRadius.md}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {},
  container: {
    padding: spacing.md,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  conversationText: {
    flex: 1,
  },
  messageItem: {
    marginVertical: spacing.xs,
    maxWidth: '70%',
  },
});

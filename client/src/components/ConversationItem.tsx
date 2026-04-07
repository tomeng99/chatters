import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import EncryptionBadge from './EncryptionBadge';
import { colors, typography, spacing, borderRadius } from '../theme';

interface ConversationItemProps {
  name: string;
  lastMessage?: string | null;
  lastMessageAt?: number | null;
  isEncrypted?: boolean;
  isGroup?: boolean;
  unreadCount?: number;
  onPress: () => void;
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts * 1000;
  if (diff < 60 * 1000) return 'now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 24 * 60 * 60 * 1000) {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(ts * 1000);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationItem({
  name,
  lastMessage,
  lastMessageAt,
  isEncrypted = false,
  isGroup = false,
  unreadCount = 0,
  onPress,
}: ConversationItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      onPress={onPress}
    >
      <Avatar username={name} size={52} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {lastMessageAt ? (
            <Text style={styles.time}>{formatTime(lastMessageAt)}</Text>
          ) : null}
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.previewRow}>
            {isEncrypted && <EncryptionBadge size={11} color={colors.textTertiary} />}
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMessage || 'No messages yet'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    backgroundColor: colors.background,
  },
  containerPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md - 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginRight: spacing.sm,
    letterSpacing: 0.1,
  },
  time: {
    fontSize: typography.fontSizeXS,
    color: colors.textTertiary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightBold,
  },
});

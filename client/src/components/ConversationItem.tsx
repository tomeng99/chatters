import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import EncryptionBadge from './EncryptionBadge';
import Row from './Row';
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
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar username={name} size={52} />
      <View style={styles.content}>
        <Row style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {lastMessageAt ? (
            <Text style={styles.time}>{formatTime(lastMessageAt)}</Text>
          ) : null}
        </Row>
        <Row style={styles.bottomRow}>
          <Row style={styles.previewRow}>
            {isEncrypted && <EncryptionBadge size={11} color={colors.textTertiary} />}
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMessage || 'No messages yet'}
            </Text>
          </Row>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </Row>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm + 2,
  },
  topRow: {
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  name: {
    flex: 1,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: typography.fontSizeXS,
    color: colors.textTertiary,
  },
  bottomRow: {
    justifyContent: 'space-between',
  },
  previewRow: {
    flex: 1,
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
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: spacing.sm,
  },
  badgeText: {
    color: colors.background,
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightBold,
  },
});

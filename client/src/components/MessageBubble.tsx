import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';
import EncryptionBadge from './EncryptionBadge';

interface MessageBubbleProps {
  content: string;
  isSent: boolean;
  isEncrypted: boolean;
  isCritical?: boolean;
  createdAt: number;
  senderUsername?: string;
  showSender?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({
  content,
  isSent,
  isEncrypted,
  isCritical = false,
  createdAt,
  senderUsername,
  showSender = false,
}: MessageBubbleProps) {
  return (
    <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
      <View
        style={[
          styles.bubble,
          isSent ? styles.bubbleSent : styles.bubbleReceived,
          isCritical && styles.bubbleCritical,
        ]}
      >
        {isCritical && (
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalIcon}>❗</Text>
            <Text style={[styles.criticalLabel, isSent ? styles.criticalLabelSent : styles.criticalLabelReceived]}>Critical</Text>
          </View>
        )}
        {showSender && !isSent && senderUsername ? (
          <Text style={styles.senderName}>{senderUsername}</Text>
        ) : null}
        <Text
          style={[
            styles.content,
            isSent ? styles.contentSent : styles.contentReceived,
          ]}
        >
          {content}
        </Text>
        <View style={styles.meta}>
          {isEncrypted && (
            <EncryptionBadge color={isSent ? 'rgba(255,255,255,0.7)' : colors.textTertiary} size={10} />
          )}
          <Text style={[styles.time, isSent ? styles.timeSent : styles.timeReceived]}>
            {formatTime(createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: spacing.md,
  },
  rowSent: {
    justifyContent: 'flex-end',
  },
  rowReceived: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleSent: {
    backgroundColor: colors.messageBubbleSent,
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleReceived: {
    backgroundColor: colors.messageBubbleReceived,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleCritical: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  criticalIcon: {
    fontSize: 10,
    marginRight: 3,
  },
  criticalLabel: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
  },
  criticalLabelSent: {
    color: 'rgba(255,255,255,0.85)',
  },
  criticalLabelReceived: {
    color: colors.error,
  },
  senderName: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.primary,
    marginBottom: 2,
  },
  content: {
    fontSize: typography.fontSizeMD,
    lineHeight: 20,
  },
  contentSent: {
    color: colors.messageBubbleSentText,
  },
  contentReceived: {
    color: colors.messageBubbleReceivedText,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  time: {
    fontSize: typography.fontSizeXS,
  },
  timeSent: {
    color: 'rgba(255,255,255,0.7)',
  },
  timeReceived: {
    color: colors.textTertiary,
  },
});

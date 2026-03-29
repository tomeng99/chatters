import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';
import EncryptionBadge from './EncryptionBadge';

interface MessageBubbleProps {
  content: string;
  isSent: boolean;
  isEncrypted: boolean;
  createdAt: number;
  senderUsername?: string;
  showSender?: boolean;
  messageType?: 'text' | 'image' | 'video' | 'file';
  fileName?: string | null;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Detect if a string is only emoji characters (and optional whitespace)
function isEmojiOnly(text: string): boolean {
  const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s\u200d\ufe0f]+$/u;
  // Also check it's not too long (max ~8 emoji for the "big emoji" effect)
  return emojiRegex.test(text.trim()) && text.trim().length <= 32;
}

// URL regex for detecting links in text
const URL_REGEX = /https?:\/\/[^\s<>\"')\]]+/gi;

function renderTextWithLinks(text: string, isSent: boolean) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</Text>
      );
    }
    // Add the link
    const url = match[0];
    parts.push(
      <Text
        key={`l-${match.index}`}
        style={[styles.link, isSent ? styles.linkSent : styles.linkReceived]}
        onPress={() => Linking.openURL(url)}
      >
        {url}
      </Text>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<Text key={`t-${lastIndex}`}>{text.slice(lastIndex)}</Text>);
  }

  if (parts.length === 0) {
    return <Text>{text}</Text>;
  }

  return <>{parts}</>;
}

export default function MessageBubble({
  content,
  isSent,
  isEncrypted,
  createdAt,
  senderUsername,
  showSender = false,
  messageType = 'text',
  fileName,
}: MessageBubbleProps) {
  const [imageError, setImageError] = useState(false);
  const emojiOnly = messageType === 'text' && isEmojiOnly(content);
  const hasLinks = messageType === 'text' && URL_REGEX.test(content);

  const resolveUrl = useCallback((url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url}`;
  }, []);

  const renderContent = () => {
    if (messageType === 'image' && !imageError) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => Linking.openURL(resolveUrl(content))}
        >
          <Image
            source={{ uri: resolveUrl(content) }}
            style={styles.mediaImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </TouchableOpacity>
      );
    }

    if (messageType === 'video') {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => Linking.openURL(resolveUrl(content))}
          style={styles.videoContainer}
        >
          <View style={styles.videoOverlay}>
            <Text style={styles.videoPlayIcon}>▶</Text>
          </View>
          <Text style={[styles.fileText, isSent ? styles.contentSent : styles.contentReceived]}>
            🎬 {fileName || 'Video'}
          </Text>
        </TouchableOpacity>
      );
    }

    if (messageType === 'file') {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => Linking.openURL(resolveUrl(content))}
          style={styles.fileContainer}
        >
          <Text style={styles.fileIcon}>📄</Text>
          <Text
            style={[styles.fileText, isSent ? styles.contentSent : styles.contentReceived]}
            numberOfLines={2}
          >
            {fileName || 'File'}
          </Text>
        </TouchableOpacity>
      );
    }

    // Fallback for image errors
    if (messageType === 'image' && imageError) {
      return (
        <Text style={[styles.content, isSent ? styles.contentSent : styles.contentReceived]}>
          📷 Image could not be loaded
        </Text>
      );
    }

    // Text message
    if (emojiOnly) {
      return (
        <Text style={styles.emojiContent}>
          {content}
        </Text>
      );
    }

    return (
      <Text style={[styles.content, isSent ? styles.contentSent : styles.contentReceived]}>
        {hasLinks ? renderTextWithLinks(content, isSent) : content}
      </Text>
    );
  };

  return (
    <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
      <View
        style={[
          styles.bubble,
          isSent ? styles.bubbleSent : styles.bubbleReceived,
          emojiOnly && styles.emojiBubble,
          messageType === 'image' && !imageError && styles.mediaBubble,
        ]}
      >
        {showSender && !isSent && senderUsername ? (
          <Text style={styles.senderName}>{senderUsername}</Text>
        ) : null}
        {renderContent()}
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
  emojiBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.xs,
  },
  mediaBubble: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    overflow: 'hidden',
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
  emojiContent: {
    fontSize: 40,
    lineHeight: 48,
    textAlign: 'center',
  },
  link: {
    textDecorationLine: 'underline',
  },
  linkSent: {
    color: '#d4e8ff',
  },
  linkReceived: {
    color: colors.primary,
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: borderRadius.md,
  },
  videoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  videoOverlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    color: '#fff',
    fontSize: 18,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fileIcon: {
    fontSize: 28,
  },
  fileText: {
    fontSize: typography.fontSizeMD,
    flexShrink: 1,
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

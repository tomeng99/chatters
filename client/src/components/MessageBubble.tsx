import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Animated, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography, spacing, borderRadius, animations } from '../theme';
import { useTheme } from '../context/ThemeContext';
import EncryptionBadge from './EncryptionBadge';
import { API_BASE } from '../config';
import { resolveMediaUrl } from '../utils/mediaUrl';
import MediaViewer from './MediaViewer';

interface MessageBubbleProps {
  content: string;
  isSent: boolean;
  isEncrypted: boolean;
  isCritical?: boolean;
  createdAt: number;
  senderUsername?: string;
  showSender?: boolean;
  messageType?: 'text' | 'image' | 'video' | 'file';
  fileName?: string | null;
  isDeleted?: boolean;
  onLongPress?: () => void;
}

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

// URL regex for detecting links in text (precompiled, reset lastIndex before each use)
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

function hasUrls(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

type BubbleStyles = ReturnType<typeof createStyles>;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function renderTextWithLinks(text: string, isSent: boolean, styles: BubbleStyles) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
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
  isCritical = false,
  createdAt,
  senderUsername,
  showSender = false,
  messageType = 'text',
  fileName,
  isDeleted = false,
  onLongPress,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageError, setImageError] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const emojiOnly = !isDeleted && messageType === 'text' && isEmojiOnly(content);
  const containsLinks = !isDeleted && messageType === 'text' && hasUrls(content);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // null for anything that is not one of our own uploads, which is the only
  // thing a media message legitimately carries. See utils/mediaUrl.
  const mediaUrl = useMemo(
    () => (messageType === 'text' ? null : resolveMediaUrl(content, API_BASE)),
    [content, messageType]
  );

  const openViewer = useCallback(() => setViewerVisible(true), []);
  const closeViewer = useCallback(() => setViewerVisible(false), []);

  const renderUnavailable = (icon: IconName, label: string) => (
    <View style={styles.imageErrorContainer}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={isSent ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
      />
      <Text style={[styles.content, isSent ? styles.contentSent : styles.contentReceived, { marginLeft: spacing.xs }]}>
        {label}
      </Text>
    </View>
  );

  const renderContent = () => {
    // A retracted message keeps its place in the thread, but nothing of what it said.
    if (isDeleted) {
      return (
        <View style={styles.deletedContainer}>
          <MaterialCommunityIcons name="cancel" size={13} color={colors.textTertiary} />
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      );
    }

    if (messageType === 'image') {
      if (!mediaUrl || imageError) {
        return renderUnavailable('image-off-outline', 'Image could not be loaded');
      }
      return (
        <>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openViewer}
          >
            <Image
              source={{ uri: mediaUrl }}
              style={styles.mediaImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          </TouchableOpacity>
          <MediaViewer
            visible={viewerVisible}
            uri={mediaUrl}
            mediaType="image"
            onClose={closeViewer}
          />
        </>
      );
    }

    if (messageType === 'video') {
      if (!mediaUrl) {
        return renderUnavailable('video-off-outline', 'Video could not be loaded');
      }
      return (
        <>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openViewer}
          >
            <View style={styles.videoPreview}>
              <View style={styles.videoPlayOverlay}>
                <MaterialCommunityIcons name="play-circle" size={48} color="#FFFFFF" />
              </View>
              {fileName ? (
                <Text style={styles.videoFileName} numberOfLines={2}>
                  {fileName}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
          <MediaViewer
            visible={viewerVisible}
            uri={mediaUrl}
            mediaType="video"
            onClose={closeViewer}
          />
        </>
      );
    }

    if (messageType === 'file') {
      if (!mediaUrl) {
        return renderUnavailable('file-alert-outline', 'File could not be loaded');
      }
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => Linking.openURL(mediaUrl)}
          style={styles.fileContainer}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={28}
            color={isSent ? 'rgba(255,255,255,0.85)' : colors.primary}
          />
          <Text
            style={[styles.fileText, isSent ? styles.contentSent : styles.contentReceived]}
            numberOfLines={2}
          >
            {fileName || 'File'}
          </Text>
        </TouchableOpacity>
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
        {containsLinks ? renderTextWithLinks(content, isSent, styles) : content}
      </Text>
    );
  };

  // Same style array either way, so adding the long-press affordance does not
  // move the bubble: only the element type changes.
  const bubbleStyle = [
    styles.bubble,
    isSent ? styles.bubbleSent : styles.bubbleReceived,
    isCritical && !isDeleted && styles.bubbleCritical,
    emojiOnly && styles.emojiBubble,
    // Only the bubbles that actually render media get the flush media padding;
    // an unavailable state is text and keeps the normal insets.
    messageType === 'image' && mediaUrl && !imageError && !isDeleted && styles.mediaBubble,
    messageType === 'video' && mediaUrl && !isDeleted && styles.mediaBubble,
    isDeleted && styles.bubbleDeleted,
  ];

  const bubbleContent = (
    <>
      {isCritical && !isDeleted && (
        <View style={styles.criticalBadge}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={12}
            color={isSent ? 'rgba(255,255,255,0.85)' : colors.error}
          />
          <Text style={[styles.criticalLabel, isSent ? styles.criticalLabelSent : styles.criticalLabelReceived]}>Critical</Text>
        </View>
      )}
      {showSender && !isSent && senderUsername ? (
        <Text style={styles.senderName}>{senderUsername}</Text>
      ) : null}
      {renderContent()}
      <View style={styles.meta}>
        {isEncrypted && !isDeleted && (
          <EncryptionBadge color={isSent ? 'rgba(255,255,255,0.6)' : colors.textTertiary} size={10} />
        )}
        <Text
          style={[
            styles.time,
            // The deleted bubble has no filled background, so the light-on-primary
            // timestamp would be invisible against it.
            isSent && !isDeleted ? styles.timeSent : styles.timeReceived,
          ]}
        >
          {formatTime(createdAt)}
        </Text>
      </View>
    </>
  );

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
        {onLongPress ? (
          <Pressable
            style={bubbleStyle}
            onLongPress={onLongPress}
            delayLongPress={350}
            accessibilityHint="Long press to delete this message"
          >
            {bubbleContent}
          </Pressable>
        ) : (
          <View style={bubbleStyle}>{bubbleContent}</View>
        )}
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deletedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deletedText: {
    fontSize: typography.fontSizeMD,
    fontStyle: 'italic',
    color: colors.textTertiary,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 3,
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
    lineHeight: 21,
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
    color: colors.linkSent,
  },
  linkReceived: {
    color: colors.primary,
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: borderRadius.md,
  },
  imageErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoPreview: {
    width: 220,
    height: 140,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFileName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSizeXS,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
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
    color: 'rgba(255,255,255,0.6)',
  },
  timeReceived: {
    color: colors.textTertiary,
  },
});

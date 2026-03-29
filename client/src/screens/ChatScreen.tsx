import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { socketService, Message } from '../services/socketService';
import MessageBubble from '../components/MessageBubble';
import EncryptionBadge from '../components/EncryptionBadge';
import {
  encryptMessage,
  decryptMessage,
  encryptGroupMessage,
  decryptGroupMessage,
  generateSharedKey,
  serializeEncryptedPayload,
  parseEncryptedPayload,
  EncryptedPayload,
} from '../utils/encryption';
import { decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type Props = {
  navigation: StackNavigationProp<AppStackParamList, 'Chat'>;
  route: RouteProp<AppStackParamList, 'Chat'>;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface DisplayMessage extends Message {
  decryptedContent?: string;
}

export default function ChatScreen({ navigation, route }: Props) {
  const { conversationId, conversationName, isGroup, members } = route.params;
  const { token, user, keyPair } = useAuthStore();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupSharedKey, setGroupSharedKey] = useState<Uint8Array | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const publicKeyCacheRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText} numberOfLines={1}>{conversationName}</Text>
          <View style={styles.headerSubtitle}>
            <EncryptionBadge size={11} color={colors.success} />
            <Text style={styles.headerSubtitleText}>End-to-end encrypted</Text>
          </View>
        </View>
      ),
    });
  }, [navigation, conversationName]);

  const getOrCreateGroupSharedKey = useCallback(async (): Promise<Uint8Array | null> => {
    if (!isGroup || !keyPair) return null;
    const storageKey = `group_key_${conversationId}`;
    const stored = await AsyncStorage.getItem(storageKey);
    if (stored) {
      const { decodeBase64 } = await import('tweetnacl-util');
      return decodeBase64(stored);
    }
    const sharedKey = generateSharedKey();
    const { encodeBase64 } = await import('tweetnacl-util');
    await AsyncStorage.setItem(storageKey, encodeBase64(sharedKey));
    return sharedKey;
  }, [isGroup, conversationId, keyPair]);

  useEffect(() => {
    if (isGroup) {
      getOrCreateGroupSharedKey().then(setGroupSharedKey);
    }
  }, [isGroup, getOrCreateGroupSharedKey]);

  const getUserPublicKey = useCallback(
    async (userId: string): Promise<Uint8Array | null> => {
      if (!keyPair) return null;

      if (userId === user?.id) {
        return keyPair.publicKey;
      }

      const fromMembers = members.find((m) => m.id === userId)?.publicKey;
      if (fromMembers) {
        return decodeBase64(fromMembers);
      }

      if (publicKeyCacheRef.current.has(userId)) {
        const cached = publicKeyCacheRef.current.get(userId);
        return cached ? decodeBase64(cached) : null;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/${userId}/publicKey`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          publicKeyCacheRef.current.set(userId, null);
          return null;
        }
        const data = await res.json();
        const publicKey = data?.publicKey ?? null;
        publicKeyCacheRef.current.set(userId, publicKey);
        return publicKey ? decodeBase64(publicKey) : null;
      } catch {
        return null;
      }
    },
    [keyPair, members, token, user?.id]
  );

  const decryptDisplayMessage = useCallback(
    async (msg: Message): Promise<DisplayMessage> => {
      if (!msg.isEncrypted || !keyPair) return { ...msg, decryptedContent: msg.content };

      try {
        if (isGroup) {
          const payload = parseEncryptedPayload(msg.content);
          if (!payload) return { ...msg, decryptedContent: '[Encrypted message]' };
          const gKey = groupSharedKey || (await getOrCreateGroupSharedKey());
          if (!gKey) return { ...msg, decryptedContent: '[Encrypted message]' };
          const decrypted = decryptGroupMessage(payload, gKey);
          return { ...msg, decryptedContent: decrypted || '[Unable to decrypt]' };
        } else {
          // nacl.box DH is symmetric: always use the other member's public key
          const otherMember = members.find((m) => m.id !== user?.id);
          const otherPubKey = otherMember ? await getUserPublicKey(otherMember.id) : null;
          if (!otherPubKey) return { ...msg, decryptedContent: '[Encrypted message]' };

          const payload = parseEncryptedPayload(msg.content);
          if (!payload) return { ...msg, decryptedContent: '[Encrypted message]' };
          const decrypted = decryptMessage(payload, otherPubKey, keyPair.secretKey);
          return { ...msg, decryptedContent: decrypted || '[Unable to decrypt]' };
        }
      } catch {
        return { ...msg, decryptedContent: '[Decryption error]' };
      }
    },
    [keyPair, isGroup, groupSharedKey, getOrCreateGroupSharedKey, getUserPublicKey, user?.id]
  );

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Message[] = await res.json();
        const decrypted = await Promise.all(data.map(decryptDisplayMessage));
        setMessages(decrypted);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, token, decryptDisplayMessage]);

  useEffect(() => {
    fetchMessages();
    socketService.joinConversation(conversationId);

    const unsub = socketService.onMessage(conversationId, async (msg) => {
      const displayMsg = await decryptDisplayMessage(msg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === displayMsg.id)) return prev;
        return [...prev, displayMsg];
      });
    });

    return unsub;
  }, [conversationId, fetchMessages, decryptDisplayMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    try {
      let content = text;
      let iv: string | null = null;
      let isEncrypted = false;

      if (keyPair) {
        let payload: EncryptedPayload | null = null;

        if (isGroup) {
          const gKey = groupSharedKey || (await getOrCreateGroupSharedKey());
          if (gKey) {
            payload = encryptGroupMessage(text, gKey);
            isEncrypted = true;
          }
        } else {
          const recipient = members.find((m) => m.id !== user?.id);
          if (recipient?.publicKey) {
            const recipientPubKey = decodeBase64(recipient.publicKey);
            payload = encryptMessage(text, recipientPubKey, keyPair.secretKey);
            isEncrypted = true;
          }
        }

        if (payload) {
          content = serializeEncryptedPayload(payload);
          iv = payload.nonce;
        }
      }

      const result = await socketService.sendMessage(conversationId, content, iv, isEncrypted);

      if (result.success && result.message) {
        const displayMsg: DisplayMessage = {
          ...result.message,
          decryptedContent: text,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === displayMsg.id)) return prev;
          return [...prev, displayMsg];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    socketService.emitTyping(conversationId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.emitTyping(conversationId, false);
    }, 1500);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        style={styles.flatList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isSent = item.sender.id === user?.id;
          const showSender =
            isGroup && !isSent &&
            (index === 0 || messages[index - 1]?.sender.id !== item.sender.id);
          return (
            <MessageBubble
              content={item.decryptedContent ?? item.content}
              isSent={isSent}
              isEncrypted={item.isEncrypted}
              createdAt={item.createdAt}
              senderUsername={item.sender.username}
              showSender={showSender}
            />
          );
        }}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerSubtitleText: {
    fontSize: typography.fontSizeXS,
    color: colors.success,
  },
  flatList: {
    flex: 1,
  },
  messageList: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizeMD,
    color: colors.text,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceSecondary,
  },
  sendIcon: {
    color: colors.background,
    fontSize: 18,
    fontWeight: typography.fontWeightBold,
    lineHeight: 22,
  },
});

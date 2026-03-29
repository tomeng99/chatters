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
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  NativeScrollEvent,
  Alert,
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
  encryptGroupKeyForMember,
  decryptGroupKeyFromSender,
  serializeEncryptedPayload,
  parseEncryptedPayload,
  EncryptedPayload,
} from '../utils/encryption';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type Props = {
  navigation: StackNavigationProp<AppStackParamList, 'Chat'>;
  route: RouteProp<AppStackParamList, 'Chat'>;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface DisplayMessage extends Message {
  decryptedContent?: string;
}

type MessageType = 'text' | 'image' | 'video' | 'file';

export default function ChatScreen({ navigation, route }: Props) {
  const { conversationId, conversationName, isGroup, members } = route.params;
  const { token, user, keyPair } = useAuthStore();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupSharedKey, setGroupSharedKey] = useState<Uint8Array | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);
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
    if (!isGroup || !keyPair || !token) return null;

    // Check local cache first
    const storageKey = `group_key_${conversationId}`;
    const stored = await AsyncStorage.getItem(storageKey);
    if (stored) {
      return decodeBase64(stored);
    }

    // Try to fetch the distributed key from the server
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/group-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.encryptedKey && data.nonce && data.senderPublicKey) {
          const senderPubKey = decodeBase64(data.senderPublicKey);
          const groupKey = decryptGroupKeyFromSender(
            data.encryptedKey,
            data.nonce,
            senderPubKey,
            keyPair.secretKey
          );
          if (groupKey) {
            await AsyncStorage.setItem(storageKey, encodeBase64(groupKey));
            return groupKey;
          }
        }
      }
    } catch {
      // Fall through to generate a new key if fetch fails
    }

    // No distributed key exists yet — generate and distribute to all members
    const groupKey = generateSharedKey();
    const keys: { userId: string; encryptedKey: string; nonce: string }[] = [];

    for (const member of members) {
      if (!member.publicKey) {
        console.warn(`Group key distribution: member ${member.id} has no public key`);
        continue;
      }
      const memberPubKey = decodeBase64(member.publicKey);
      const encrypted = encryptGroupKeyForMember(groupKey, memberPubKey, keyPair.secretKey);
      keys.push({
        userId: member.id,
        encryptedKey: encrypted.ciphertext,
        nonce: encrypted.nonce,
      });
    }

    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/group-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keys }),
      });

      if (res.ok || res.status === 409) {
        // 409 means another member already distributed — re-fetch
        if (res.status === 409) {
          const fetchRes = await fetch(
            `${API_BASE}/api/conversations/${conversationId}/group-key`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            if (data.exists && data.encryptedKey && data.nonce && data.senderPublicKey) {
              const senderPubKey = decodeBase64(data.senderPublicKey);
              const existingKey = decryptGroupKeyFromSender(
                data.encryptedKey,
                data.nonce,
                senderPubKey,
                keyPair.secretKey
              );
              if (existingKey) {
                await AsyncStorage.setItem(storageKey, encodeBase64(existingKey));
                return existingKey;
              }
            }
          }
          return null;
        }

        await AsyncStorage.setItem(storageKey, encodeBase64(groupKey));
        return groupKey;
      }
    } catch {
      // Distribution failed
    }

    return null;
  }, [isGroup, conversationId, keyPair, token, members]);

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

      if (publicKeyCacheRef.current.has(userId)) {
        const cached = publicKeyCacheRef.current.get(userId);
        return cached ? decodeBase64(cached) : null;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/${userId}/publicKey`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const publicKey = data?.publicKey ?? null;
          publicKeyCacheRef.current.set(userId, publicKey);
          return publicKey ? decodeBase64(publicKey) : null;
        }
      } catch {
        // Fall through to members fallback
      }

      const fromMembers = members.find((m) => m.id === userId)?.publicKey;
      if (fromMembers) {
        publicKeyCacheRef.current.set(userId, fromMembers);
        return decodeBase64(fromMembers);
      }

      publicKeyCacheRef.current.set(userId, null);
      return null;
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
          if (!otherMember) return { ...msg, decryptedContent: '[Encrypted message]' };

          const otherPubKey = await getUserPublicKey(otherMember.id);
          if (!otherPubKey) return { ...msg, decryptedContent: '[Encrypted message]' };

          const payload = parseEncryptedPayload(msg.content);
          if (!payload) return { ...msg, decryptedContent: '[Encrypted message]' };

          let decrypted = decryptMessage(payload, otherPubKey, keyPair.secretKey);

          // If decryption failed, the cached key may be stale — fetch fresh and retry
          if (!decrypted) {
            publicKeyCacheRef.current.delete(otherMember.id);
            const freshPubKey = await getUserPublicKey(otherMember.id);
            if (freshPubKey) {
              decrypted = decryptMessage(payload, freshPubKey, keyPair.secretKey);
            }
          }

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
    if (messages.length > 0 && isNearBottomRef.current) {
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
          if (recipient) {
            const recipientPubKey = await getUserPublicKey(recipient.id);
            if (recipientPubKey) {
              payload = encryptMessage(text, recipientPubKey, keyPair.secretKey);
              isEncrypted = true;
            }
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

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Enter' && !(e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey) {
      e.preventDefault();
      handleSend();
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

  const handleListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  const uploadFile = useCallback(async (uri: string, fileName: string, mimeType: string, file?: File | null): Promise<{ url: string; fileType: MessageType; fileName: string } | null> => {
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // On web, use the native File object if available, otherwise fetch the blob URI
        if (file) {
          formData.append('file', file, fileName);
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          formData.append('file', blob, fileName);
        }
      } else {
        // On native (iOS/Android), use the { uri, name, type } pattern supported by React Native
        formData.append('file', {
          uri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob);
      }

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      return await res.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload Error', message);
      return null;
    }
  }, [token]);

  const sendMediaMessage = useCallback(async (fileUrl: string, messageType: MessageType, fileName: string) => {
    setSending(true);
    try {
      let content = fileUrl;
      let iv: string | null = null;
      let isEncrypted = false;

      if (keyPair) {
        let payload: EncryptedPayload | null = null;

        if (isGroup) {
          const gKey = groupSharedKey || (await getOrCreateGroupSharedKey());
          if (gKey) {
            payload = encryptGroupMessage(fileUrl, gKey);
            isEncrypted = true;
          }
        } else {
          const recipient = members.find((m) => m.id !== user?.id);
          if (recipient) {
            const recipientPubKey = await getUserPublicKey(recipient.id);
            if (recipientPubKey) {
              payload = encryptMessage(fileUrl, recipientPubKey, keyPair.secretKey);
              isEncrypted = true;
            }
          }
        }

        if (payload) {
          content = serializeEncryptedPayload(payload);
          iv = payload.nonce;
        }
      }

      const result = await socketService.sendMessage(conversationId, content, iv, isEncrypted, messageType, fileName);

      if (result.success && result.message) {
        const displayMsg: DisplayMessage = {
          ...result.message,
          decryptedContent: fileUrl,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === displayMsg.id)) return prev;
          return [...prev, displayMsg];
        });
      }
    } finally {
      setSending(false);
    }
  }, [conversationId, keyPair, isGroup, groupSharedKey, getOrCreateGroupSharedKey, getUserPublicKey, user?.id, members]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to send images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.fileName || uri.split('/').pop() || 'file';
    const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const messageType: MessageType = asset.type === 'video' ? 'video' : 'image';
    // On web, expo-image-picker provides a File object on the asset
    const webFile = (asset as unknown as { file?: File }).file || null;

    const uploaded = await uploadFile(uri, fileName, mimeType, webFile);
    if (uploaded) {
      await sendMediaMessage(uploaded.url, messageType, uploaded.fileName);
    }
  }, [uploadFile, sendMediaMessage]);

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.name || 'document.pdf';
    const mimeType = asset.mimeType || 'application/pdf';
    // On web, expo-document-picker provides a File object on the asset
    const webFile = (asset as unknown as { file?: File }).file || null;

    const uploaded = await uploadFile(uri, fileName, mimeType, webFile);
    if (uploaded) {
      await sendMediaMessage(uploaded.url, 'file', uploaded.fileName);
    }
  }, [uploadFile, sendMediaMessage]);

  const [showAttachMenu, setShowAttachMenu] = useState(false);

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
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.messagesContainer}>
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
                messageType={item.messageType}
                fileName={item.fileName}
              />
            );
          }}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />
      </View>

      <View style={styles.inputBarContainer}>
        {showAttachMenu && (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachMenu(false); handlePickImage(); }}>
              <Text style={styles.attachOptionIcon}>🖼️</Text>
              <Text style={styles.attachOptionText}>Photo / Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachMenu(false); handlePickDocument(); }}>
              <Text style={styles.attachOptionIcon}>📄</Text>
              <Text style={styles.attachOptionText}>Document</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttachMenu(!showAttachMenu)}
            activeOpacity={0.7}
          >
            <Text style={styles.attachIcon}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={2000}
            returnKeyType="default"
            onKeyPress={handleKeyPress}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }
      : {}),
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
  messagesContainer: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  inputBarContainer: {
    backgroundColor: colors.background,
    flexShrink: 0,
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
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  attachIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: typography.fontWeightBold,
    lineHeight: 24,
  },
  attachMenu: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  attachOption: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  attachOptionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  attachOptionText: {
    fontSize: typography.fontSizeXS,
    color: colors.text,
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

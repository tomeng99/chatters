import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { socketService } from '../services/socketService';
import ConversationItem from '../components/ConversationItem';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type Props = { navigation: StackNavigationProp<AppStackParamList, 'Conversations'> };

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: number;
  members: Array<{ id: string; username: string; publicKey?: string | null }>;
  lastMessage?: {
    content: string;
    createdAt: number;
    isEncrypted: boolean;
    senderUsername: string;
  } | null;
}

export default function ConversationsScreen({ navigation }: Props) {
  const { token, user, logout } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginLeft: spacing.md }}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={logout} style={{ marginRight: spacing.md }}>
          <Text style={{ color: colors.primary, fontSize: typography.fontSizeMD }}>Sign Out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  useEffect(() => {
    if (token) {
      socketService.connect(token);
    }
    return () => {
      socketService.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const unsub = socketService.onAnyMessage(() => {
      fetchConversations(false);
    });
    return unsub;
  }, [token]);

  const fetchConversations = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const getConversationDisplayName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    const others = conv.members.filter((m) => m.id !== user?.id);
    if (others.length === 0) return 'You';
    return others.map((m) => m.username).join(', ');
  };

  const handleOpenConversation = (conv: Conversation) => {
    navigation.navigate('Chat', {
      conversationId: conv.id,
      conversationName: getConversationDisplayName(conv),
      isGroup: conv.isGroup,
      members: conv.members,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            name={getConversationDisplayName(item)}
            lastMessage={
              item.lastMessage
                ? item.lastMessage.isEncrypted
                  ? '🔒 Encrypted message'
                  : item.lastMessage.content
                : null
            }
            lastMessageAt={item.lastMessage?.createdAt ?? null}
            isEncrypted={item.lastMessage?.isEncrypted ?? false}
            isGroup={item.isGroup}
            onPress={() => handleOpenConversation(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>Start chatting by tapping the + button</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchConversations(false);
            }}
            tintColor={colors.primary}
          />
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
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
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabIcon: {
    fontSize: 24,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import { colors, typography, spacing, borderRadius } from '../theme';

type Props = { navigation: StackNavigationProp<AppStackParamList, 'NewChat'> };

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface SearchUser {
  id: string;
  username: string;
  publicKey?: string | null;
}

export default function NewChatScreen({ navigation }: Props) {
  const { token } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');

  const isGroup = selected.length > 1;

  const searchUsers = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/users/search?q=${encodeURIComponent(q.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } finally {
        setSearching(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const timeout = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(timeout);
  }, [query, searchUsers]);

  const toggleSelect = (u: SearchUser) => {
    setSelected((prev) =>
      prev.some((s) => s.id === u.id)
        ? prev.filter((s) => s.id !== u.id)
        : [...prev, u]
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) {
      Alert.alert('Select at least one person to chat with');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberUsernames: selected.map((u) => u.username),
          name: isGroup && groupName.trim() ? groupName.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to create conversation');
        return;
      }

      const conv = await res.json();
      navigation.replace('Chat', {
        conversationId: conv.id,
        conversationName:
          conv.name ||
          selected.map((u) => u.username).join(', '),
        isGroup: conv.isGroup,
        members: conv.members,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      {selected.length > 0 && (
        <View style={styles.selectedBar}>
          <FlatList
            horizontal
            data={selected}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectedChip}
                onPress={() => toggleSelect(item)}
              >
                <Avatar username={item.username} size={28} />
                <Text style={styles.chipName}>{item.username}</Text>
                <Text style={styles.chipRemove}>✕</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {isGroup && (
        <View style={styles.groupNameRow}>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name (optional)"
            placeholderTextColor={colors.textTertiary}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>
      )}

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const isSelected = selected.some((s) => s.id === item.id);
          return (
            <TouchableOpacity
              style={[styles.userRow, isSelected && styles.userRowSelected]}
              onPress={() => toggleSelect(item)}
              activeOpacity={0.7}
            >
              <Avatar username={item.username} size={44} />
              <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                {item.publicKey && (
                  <Text style={styles.encrypted}>🔒 E2E encrypted</Text>
                )}
              </View>
              <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.trim() ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searching ? 'Searching...' : 'No users found'}
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Search for people to start a conversation</Text>
            </View>
          )
        }
        contentContainerStyle={styles.list}
      />

      {selected.length > 0 && (
        <View style={styles.footer}>
          <Button
            title={isGroup ? `Create Group (${selected.length})` : `Start Chat with ${selected[0].username}`}
            onPress={handleCreate}
            loading={creating}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  selectedBar: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  chipName: {
    fontSize: typography.fontSizeSM,
    color: colors.text,
    fontWeight: typography.fontWeightMedium,
  },
  chipRemove: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  groupNameRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  groupNameInput: {
    fontSize: typography.fontSizeMD,
    color: colors.text,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: typography.fontSizeMD,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  userRowSelected: {
    backgroundColor: colors.surface,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
    color: colors.text,
  },
  encrypted: {
    fontSize: typography.fontSizeXS,
    color: colors.success,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.background,
    fontSize: 13,
    fontWeight: typography.fontWeightBold,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

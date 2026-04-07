import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import ScreenContainer from '../components/ScreenContainer';
import { colors, typography, spacing, borderRadius } from '../theme';
import { API_BASE } from '../config';

type Props = { navigation: StackNavigationProp<AppStackParamList, 'NewChat'> };

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
    <ScreenContainer>
      {selected.length > 0 && (
        <View style={styles.selectedBar}>
          <FlatList
            horizontal
            data={selected}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.selectedChip}
                onPress={() => toggleSelect(item)}
              >
                <Avatar username={item.username} size={28} />
                <Text style={styles.chipName}>{item.username}</Text>
                <MaterialCommunityIcons name="close" size={14} color={colors.textSecondary} />
              </Pressable>
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
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
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
            <Pressable
              style={({ pressed }) => [styles.userRow, isSelected && styles.userRowSelected, pressed && styles.userRowPressed]}
              onPress={() => toggleSelect(item)}
            >
              <Avatar username={item.username} size={44} />
              <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                {item.publicKey && (
                  <View style={styles.encryptedRow}>
                    <MaterialCommunityIcons name="lock" size={11} color={colors.success} />
                    <Text style={styles.encrypted}>E2E encrypted</Text>
                  </View>
                )}
              </View>
              <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
              </View>
            </Pressable>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  selectedBar: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  chipName: {
    fontSize: typography.fontSizeSM,
    color: colors.text,
    fontWeight: typography.fontWeightMedium,
  },
  groupNameRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  groupNameInput: {
    fontSize: typography.fontSizeInput,
    color: colors.text,
    padding: spacing.sm + 2,
    backgroundColor: colors.surfaceSecondary,
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
    backgroundColor: colors.surfaceSecondary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: typography.fontSizeInput,
    color: colors.text,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    gap: spacing.md,
  },
  userRowSelected: {
    backgroundColor: colors.primary + '08',
  },
  userRowPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
    color: colors.text,
  },
  encryptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  encrypted: {
    fontSize: typography.fontSizeXS,
    color: colors.success,
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
    backgroundColor: colors.surface,
  },
});

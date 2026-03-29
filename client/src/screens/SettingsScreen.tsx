import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { colors, typography, spacing, borderRadius } from '../theme';

type Props = { navigation: StackNavigationProp<AppStackParamList, 'Settings'> };

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type NotificationPreference = 'all' | 'tags_and_critical' | 'critical_only' | 'none';

const NOTIFICATION_OPTIONS: { value: NotificationPreference; label: string; description: string }[] = [
  { value: 'all', label: 'All Messages', description: 'Receive notifications for every message' },
  { value: 'tags_and_critical', label: 'Tags & Critical', description: 'Only when you are tagged or the message is critical' },
  { value: 'critical_only', label: 'Critical Only', description: 'Only for messages marked as critical' },
  { value: 'none', label: 'None', description: 'No notifications' },
];

export default function SettingsScreen({ navigation }: Props) {
  const { token, user } = useAuthStore();
  const [preference, setPreference] = useState<NotificationPreference>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreference(data.notificationPreference || 'all');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updatePreference = async (value: NotificationPreference) => {
    const previousValue = preference;
    setSaving(true);
    setPreference(value);
    try {
      const res = await fetch(`${API_BASE}/api/users/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationPreference: value }),
      });
      if (!res.ok) {
        setPreference(previousValue);
      }
    } catch {
      setPreference(previousValue);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <Text style={styles.sectionDescription}>
          Choose which messages trigger notifications
        </Text>
        {NOTIFICATION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              preference === option.value && styles.optionItemSelected,
            ]}
            onPress={() => updatePreference(option.value)}
            disabled={saving}
            activeOpacity={0.7}
          >
            <View style={styles.optionRadio}>
              <View
                style={[
                  styles.radioOuter,
                  preference === option.value && styles.radioOuterSelected,
                ]}
              >
                {preference === option.value && <View style={styles.radioInner} />}
              </View>
            </View>
            <View style={styles.optionText}>
              <Text
                style={[
                  styles.optionLabel,
                  preference === option.value && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.background,
  },
  username: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionItemSelected: {
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  optionRadio: {
    marginRight: spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
    color: colors.text,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeightSemiBold,
  },
  optionDescription: {
    fontSize: typography.fontSizeXS,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

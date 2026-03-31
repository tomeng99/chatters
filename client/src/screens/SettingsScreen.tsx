import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';
import ScreenContainer from '../components/ScreenContainer';
import Divider from '../components/Divider';
import AppText from '../components/AppText';
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
  const [browserPermission, setBrowserPermission] = useState<string>('default');

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

  useEffect(() => {
    getNotificationPermission().then(setBrowserPermission);
  }, []);

  const handleEnableBrowserNotifications = async () => {
    const granted = await requestNotificationPermission();
    const perm = await getNotificationPermission();
    setBrowserPermission(granted ? 'granted' : perm);
  };

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
      <ScreenContainer centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
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
        <AppText variant="title">{user?.username}</AppText>
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
        {(Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android') && (
          <View style={styles.browserNotifSection}>
            <Text style={styles.browserNotifTitle}>
              {Platform.OS === 'web' ? 'Browser Notifications' : 'Push Notifications'}
            </Text>
            {browserPermission === 'granted' ? (
              <View style={styles.browserNotifStatus}>
                <Text style={styles.browserNotifEnabled}>
                  {Platform.OS === 'web' ? '✅ Browser notifications enabled' : '✅ Notifications enabled'}
                </Text>
              </View>
            ) : browserPermission === 'denied' ? (
              <View style={styles.browserNotifStatus}>
                <Text style={styles.browserNotifDenied}>
                  {Platform.OS === 'web'
                    ? '❌ Browser notifications blocked. Please enable them in your browser settings.'
                    : '❌ Notifications blocked. Please enable them in your device settings.'}
                </Text>
              </View>
            ) : browserPermission === 'ios_web' ? (
              <View style={styles.browserNotifStatus}>
                <Text style={styles.browserNotifDenied}>
                  📱 Safari on iOS does not support notifications for regular websites.
                </Text>
                <Text style={[styles.browserNotifDenied, { marginTop: spacing.xs }]}>
                  To receive notifications, add this app to your Home Screen: tap the Share button (↑) in Safari, then "Add to Home Screen". Once opened from the Home Screen, notifications will work.
                </Text>
              </View>
            ) : browserPermission === 'unsupported' ? (
              <View style={styles.browserNotifStatus}>
                <Text style={styles.browserNotifDenied}>
                  Notifications are not supported on this browser.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.enableButton}
                onPress={handleEnableBrowserNotifications}
                activeOpacity={0.7}
              >
                <Text style={styles.enableButtonText}>
                  {Platform.OS === 'web' ? '🔔 Enable Browser Notifications' : '🔔 Enable Notifications'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  browserNotifSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  browserNotifTitle: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  browserNotifStatus: {
    paddingVertical: spacing.sm,
  },
  browserNotifEnabled: {
    fontSize: typography.fontSizeSM,
    color: colors.success,
  },
  browserNotifDenied: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
  },
  enableButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  enableButtonText: {
    color: colors.background,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
});

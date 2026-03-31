import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RadioButton } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';
import { colors, typography, spacing, borderRadius } from '../theme';
import { API_BASE } from '../config';

type Props = { navigation: StackNavigationProp<AppStackParamList, 'Settings'> };

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
        <View style={styles.encryptedBadge}>
          <MaterialCommunityIcons name="shield-check" size={14} color={colors.success} />
          <Text style={styles.encryptedText}>End-to-end encrypted</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="bell-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Choose which messages trigger notifications
        </Text>
        {NOTIFICATION_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.optionItem,
              preference === option.value && styles.optionItemSelected,
              pressed && styles.optionItemPressed,
            ]}
            onPress={() => updatePreference(option.value)}
            disabled={saving}
          >
            <RadioButton
              value={option.value}
              status={preference === option.value ? 'checked' : 'unchecked'}
              color={colors.primary}
              uncheckedColor={colors.textTertiary}
              disabled={saving}
            />
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
          </Pressable>
        ))}
        {(Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android') && (
          <View style={styles.browserNotifSection}>
            <Text style={styles.browserNotifTitle}>
              {Platform.OS === 'web' ? 'Browser Notifications' : 'Push Notifications'}
            </Text>
            {browserPermission === 'granted' ? (
              <View style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                <Text style={styles.browserNotifEnabled}>
                  {Platform.OS === 'web' ? 'Browser notifications enabled' : 'Notifications enabled'}
                </Text>
              </View>
            ) : browserPermission === 'denied' ? (
              <View style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.browserNotifDenied}>
                  {Platform.OS === 'web'
                    ? 'Browser notifications blocked. Please enable them in your browser settings.'
                    : 'Notifications blocked. Please enable them in your device settings.'}
                </Text>
              </View>
            ) : browserPermission === 'ios_web' ? (
              <View style={styles.browserNotifInfoBox}>
                <MaterialCommunityIcons name="cellphone" size={18} color={colors.textSecondary} />
                <View style={styles.iosNotifTextContainer}>
                  <Text style={styles.browserNotifDenied}>
                    Safari on iOS does not support notifications for regular websites.
                  </Text>
                  <Text style={[styles.browserNotifDenied, { marginTop: spacing.xs }]}>
                    To receive notifications, add this app to your Home Screen: tap the Share button in Safari, then "Add to Home Screen".
                  </Text>
                </View>
              </View>
            ) : browserPermission === 'unsupported' ? (
              <View style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="bell-off-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.browserNotifDenied}>
                  Notifications are not supported on this browser.
                </Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.enableButton, pressed && styles.enableButtonPressed]}
                onPress={handleEnableBrowserNotifications}
              >
                <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#FFFFFF" />
                <Text style={styles.enableButtonText}>
                  {Platform.OS === 'web' ? 'Enable Browser Notifications' : 'Enable Notifications'}
                </Text>
              </Pressable>
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: '#FFFFFF',
  },
  username: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  encryptedText: {
    fontSize: typography.fontSizeSM,
    color: colors.success,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
  },
  sectionDescription: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingRight: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  optionItemSelected: {
    backgroundColor: colors.primary + '0D',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  optionItemPressed: {
    opacity: 0.8,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  browserNotifInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iosNotifTextContainer: {
    flex: 1,
  },
  browserNotifEnabled: {
    fontSize: typography.fontSizeSM,
    color: colors.success,
    flex: 1,
  },
  browserNotifDenied: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
  },
  enableButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  enableButtonPressed: {
    opacity: 0.85,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
});

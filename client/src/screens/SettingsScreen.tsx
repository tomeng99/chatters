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
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';
import ScreenContainer from '../components/ScreenContainer';
import AppText from '../components/AppText';
import Row from '../components/Row';
import { colors, typography, spacing, borderRadius } from '../theme';
import { API_BASE } from '../config';

type NotificationPreference = 'all' | 'tags_and_critical' | 'critical_only' | 'none';

const NOTIFICATION_OPTIONS: { value: NotificationPreference; label: string; description: string }[] = [
  { value: 'all', label: 'All Messages', description: 'Receive notifications for every message' },
  { value: 'tags_and_critical', label: 'Tags & Critical', description: 'Only when you are tagged or the message is critical' },
  { value: 'critical_only', label: 'Critical Only', description: 'Only for messages marked as critical' },
  { value: 'none', label: 'None', description: 'No notifications' },
];

export default function SettingsScreen(): React.JSX.Element {
  const { token, user } = useAuthStore();
  const [preference, setPreference] = useState<NotificationPreference>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<string>('default');

  const fetchSettings = useCallback(async (): Promise<void> => {
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

  const handleEnableBrowserNotifications = async (): Promise<void> => {
    const granted = await requestNotificationPermission();
    const perm = await getNotificationPermission();
    setBrowserPermission(granted ? 'granted' : perm);
  };

  const updatePreference = async (value: NotificationPreference): Promise<void> => {
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
        <Row style={styles.encryptedBadge}>
          <MaterialCommunityIcons name="shield-check" size={14} color={colors.success} />
          <AppText variant="caption" color={colors.success}>End-to-end encrypted</AppText>
        </Row>
      </View>

      <View style={styles.section}>
        <Row style={styles.sectionHeader}>
          <MaterialCommunityIcons name="bell-outline" size={20} color={colors.text} />
          <AppText variant="body" style={styles.sectionTitle}>Notifications</AppText>
        </Row>
        <AppText variant="caption" style={styles.sectionDescription}>
          Choose which messages trigger notifications
        </AppText>
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
              <AppText variant="label">{option.description}</AppText>
            </View>
          </Pressable>
        ))}
        {(Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android') && (
          <View style={styles.browserNotifSection}>
            <AppText variant="body" style={styles.browserNotifTitle}>
              {Platform.OS === 'web' ? 'Browser Notifications' : 'Push Notifications'}
            </AppText>
            {browserPermission === 'granted' ? (
              <Row style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                <AppText variant="caption" color={colors.success}>
                  {Platform.OS === 'web' ? 'Browser notifications enabled' : 'Notifications enabled'}
                </AppText>
              </Row>
            ) : browserPermission === 'denied' ? (
              <Row style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.error} />
                <AppText variant="caption" style={{ flex: 1 }}>
                  {Platform.OS === 'web'
                    ? 'Browser notifications blocked. Please enable them in your browser settings.'
                    : 'Notifications blocked. Please enable them in your device settings.'}
                </AppText>
              </Row>
            ) : browserPermission === 'ios_web' ? (
              <Row style={styles.browserNotifInfoBox}>
                <MaterialCommunityIcons name="cellphone" size={18} color={colors.textSecondary} />
                <View style={styles.iosNotifTextContainer}>
                  <AppText variant="caption">
                    Safari on iOS does not support notifications for regular websites.
                  </AppText>
                  <AppText variant="caption" style={{ marginTop: spacing.xs }}>
                    To receive notifications, add this app to your Home Screen: tap the Share button in Safari, then "Add to Home Screen".
                  </AppText>
                </View>
              </Row>
            ) : browserPermission === 'unsupported' ? (
              <Row style={styles.browserNotifStatus}>
                <MaterialCommunityIcons name="bell-off-outline" size={18} color={colors.textTertiary} />
                <AppText variant="caption">
                  Notifications are not supported on this browser.
                </AppText>
              </Row>
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
  encryptedBadge: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontWeight: typography.fontWeightSemiBold,
  },
  sectionDescription: {
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
  browserNotifSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  browserNotifTitle: {
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.sm,
  },
  browserNotifStatus: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  browserNotifInfoBox: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iosNotifTextContainer: {
    flex: 1,
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

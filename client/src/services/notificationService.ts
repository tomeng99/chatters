import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationData } from './socketService';

// Configure how notifications appear when the app is in the foreground (native only)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isBrowserNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
}

function isNativePlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  if (isBrowserNotificationSupported()) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  return false;
}

export async function getNotificationPermission(): Promise<string> {
  if (isNativePlatform()) {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  if (isBrowserNotificationSupported()) {
    return Notification.permission;
  }

  return 'unsupported';
}

function buildNotificationContent(data: NotificationData): { title: string; body: string } {
  const title = data.isCritical
    ? `❗ Critical from ${data.senderUsername}`
    : data.isTagged
      ? `🏷️ ${data.senderUsername} tagged you`
      : `💬 ${data.senderUsername}`;

  const body = data.conversationName
    ? `in ${data.conversationName}`
    : 'New message';

  return { title, body };
}

export async function showNotification(data: NotificationData): Promise<void> {
  if (isNativePlatform()) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const { title, body } = buildNotificationContent(data);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { conversationId: data.conversationId } },
      trigger: null, // Show immediately
    });
    return;
  }

  if (isBrowserNotificationSupported()) {
    if (Notification.permission !== 'granted') return;
    const { title, body } = buildNotificationContent(data);
    const tag = `chatters-${data.messageId}`;
    new Notification(title, { body, tag });
  }
}

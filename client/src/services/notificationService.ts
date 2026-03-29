import { Platform } from 'react-native';
import type { NotificationData } from './socketService';

function isBrowserNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  // Only request if permission is 'default' (not yet decided)
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): string {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function showBrowserNotification(data: NotificationData): void {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const title = data.isCritical
    ? `❗ Critical from ${data.senderUsername}`
    : data.isTagged
      ? `🏷️ ${data.senderUsername} tagged you`
      : `💬 ${data.senderUsername}`;

  const body = data.conversationName
    ? `in ${data.conversationName}`
    : 'New message';

  const tag = `chatters-${data.messageId}`;

  new Notification(title, { body, tag });
}

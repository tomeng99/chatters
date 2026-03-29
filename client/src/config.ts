import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // In development, derive the server host automatically so that mobile
  // devices and other PCs on the local network reach the correct machine.

  // Expo Go (mobile): hostUri is e.g. "192.168.1.50:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3001`;
  }

  // Web: use the hostname the browser used to load the page, so another PC
  // that opened http://192.168.1.50:8081 will call http://192.168.1.50:3001.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
}

export const API_BASE = getApiBase();

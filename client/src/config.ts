import Constants from 'expo-constants';

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // In development, derive the server host from Expo's dev server URI so that
  // mobile devices on the local network reach the correct machine automatically.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3001`;
  }

  return 'http://localhost:3001';
}

export const API_BASE = getApiBase();

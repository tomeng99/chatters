import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateKeyPair,
  keyPairToBase64,
  keyPairFromBase64,
  KeyPair,
} from '../utils/encryption';
import { API_BASE } from '../config';

const STORAGE_KEYS = {
  TOKEN: 'chatters_token',
  USER: 'chatters_user',
  KEY_PAIR: 'chatters_keypair',
};

const getUserKeyPairStorageKey = (userId: string) => `chatters_keypair_${userId}`;

async function loadKeyPairForUser(userId: string): Promise<KeyPair | null> {
  const scopedKey = getUserKeyPairStorageKey(userId);
  const scopedKeyPair = await AsyncStorage.getItem(scopedKey);
  if (scopedKeyPair) {
    return keyPairFromBase64(JSON.parse(scopedKeyPair));
  }

  // One-time migration from legacy global key storage.
  const legacyKeyPair = await AsyncStorage.getItem(STORAGE_KEYS.KEY_PAIR);
  if (!legacyKeyPair) return null;

  await AsyncStorage.setItem(scopedKey, legacyKeyPair);
  await AsyncStorage.removeItem(STORAGE_KEYS.KEY_PAIR);
  return keyPairFromBase64(JSON.parse(legacyKeyPair));
}

async function saveKeyPairForUser(userId: string, keyPair: KeyPair): Promise<void> {
  const b64 = keyPairToBase64(keyPair);
  await AsyncStorage.setItem(getUserKeyPairStorageKey(userId), JSON.stringify(b64));
}

async function syncPublicKey(token: string, keyPair: KeyPair): Promise<void> {
  const { encodeBase64 } = await import('tweetnacl-util');
  const publicKey = encodeBase64(keyPair.publicKey);

  const res = await fetch(`${API_BASE}/api/auth/public-key`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ publicKey }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to sync public key');
  }
}

interface User {
  id: string;
  username: string;
  publicKey?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  keyPair: KeyPair | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getOrCreateKeyPair: () => Promise<KeyPair>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  keyPair: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const [tokenStr, userStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
      ]);

      if (!tokenStr || !userStr) {
        set({ isInitialized: true });
        return;
      }

      const user = JSON.parse(userStr) as User;
      const keyPair = await loadKeyPairForUser(user.id);

      if (keyPair) {
        try {
          await syncPublicKey(tokenStr, keyPair);
        } catch {
          // Sync failure is non-fatal (e.g., expired token will redirect to login)
        }
      }

      set({ token: tokenStr, user, keyPair, isInitialized: true });
    } catch {
      set({ isInitialized: true });
    }
  },

  getOrCreateKeyPair: async () => {
    const existing = get().keyPair;
    if (existing) return existing;

    const currentUser = get().user;
    const kp = generateKeyPair();

    if (currentUser?.id) {
      await saveKeyPairForUser(currentUser.id, kp);
    }

    set({ keyPair: kp });
    return kp;
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      let keyPair = await loadKeyPairForUser(data.user.id);

      if (!keyPair) {
        keyPair = generateKeyPair();
        await saveKeyPairForUser(data.user.id, keyPair);
      }

      await syncPublicKey(data.token, keyPair);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
      ]);

      set({ token: data.token, user: data.user, keyPair, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const keyPair = generateKeyPair();
      const { encodeBase64 } = await import('tweetnacl-util');
      const publicKeyB64 = encodeBase64(keyPair.publicKey);

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, publicKey: publicKeyB64 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
        saveKeyPairForUser(data.user.id, keyPair),
      ]);

      set({ token: data.token, user: data.user, keyPair, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER),
    ]);
    set({ token: null, user: null, keyPair: null });
  },
}));

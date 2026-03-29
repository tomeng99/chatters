import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateKeyPair,
  keyPairToBase64,
  keyPairFromBase64,
  KeyPair,
} from '../utils/encryption';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const STORAGE_KEYS = {
  TOKEN: 'chatters_token',
  USER: 'chatters_user',
  KEY_PAIR: 'chatters_keypair',
};

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
      const [tokenStr, userStr, keyPairStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.KEY_PAIR),
      ]);

      if (tokenStr && userStr) {
        const user = JSON.parse(userStr);
        const keyPair = keyPairStr ? keyPairFromBase64(JSON.parse(keyPairStr)) : null;
        set({ token: tokenStr, user, keyPair, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  getOrCreateKeyPair: async () => {
    const existing = get().keyPair;
    if (existing) return existing;

    const kp = generateKeyPair();
    const b64 = keyPairToBase64(kp);
    await AsyncStorage.setItem(STORAGE_KEYS.KEY_PAIR, JSON.stringify(b64));
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

      const kpStr = await AsyncStorage.getItem(STORAGE_KEYS.KEY_PAIR);
      let keyPair: KeyPair;

      if (kpStr) {
        keyPair = keyPairFromBase64(JSON.parse(kpStr));
      } else {
        keyPair = generateKeyPair();
        const b64 = keyPairToBase64(keyPair);
        await AsyncStorage.setItem(STORAGE_KEYS.KEY_PAIR, JSON.stringify(b64));

        const { decodeBase64, encodeBase64 } = await import('tweetnacl-util');
        const pubKeyB64 = encodeBase64(keyPair.publicKey);

        await fetch(`${API_BASE}/api/auth/public-key`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({ publicKey: pubKeyB64 }),
        });
      }

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

      const b64 = keyPairToBase64(keyPair);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
        AsyncStorage.setItem(STORAGE_KEYS.KEY_PAIR, JSON.stringify(b64)),
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

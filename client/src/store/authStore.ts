import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateKeyPair,
  keyPairToBase64,
  keyPairFromBase64,
  KeyPair,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
} from '../utils/encryption';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

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

async function syncPublicKey(
  token: string,
  keyPair: KeyPair,
  password?: string
): Promise<void> {
  const { encodeBase64 } = await import('tweetnacl-util');
  const publicKey = encodeBase64(keyPair.publicKey);

  const body: Record<string, string> = { publicKey };

  // If password is provided, also upload the encrypted private key for cross-device recovery
  if (password) {
    const encrypted = await encryptPrivateKeyWithPassword(keyPair.secretKey, password);
    body.encryptedPrivateKey = encrypted.encryptedPrivateKey;
    body.keySalt = encrypted.keySalt;
    body.keyNonce = encrypted.keyNonce;
  }

  const res = await fetch(`${API_BASE}/api/auth/public-key`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
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

      if (!keyPair) {
        // Local keypair is missing (e.g., new device with restored token but no keys).
        // Force re-login so password-based recovery can run.
        console.warn('[Init] Valid session but no local keypair — forcing re-login for key recovery');
        await Promise.all([
          AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
          AsyncStorage.removeItem(STORAGE_KEYS.USER),
        ]);
        set({ isInitialized: true });
        return;
      }

      try {
        await syncPublicKey(tokenStr, keyPair);
      } catch {
        // Sync failure is non-fatal (e.g., expired token will redirect to login)
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
    if (currentUser?.id) {
      // Try loading from local storage first
      const loaded = await loadKeyPairForUser(currentUser.id);
      if (loaded) {
        set({ keyPair: loaded });
        return loaded;
      }
    }

    // Generate new keypair only as last resort
    const kp = generateKeyPair();

    if (currentUser?.id) {
      await saveKeyPairForUser(currentUser.id, kp);
      // Sync the new public key to the server so it stays consistent
      const currentToken = get().token;
      if (currentToken) {
        try {
          await syncPublicKey(currentToken, kp);
        } catch (err) {
          console.warn('Failed to sync new public key to server:', err);
        }
      }
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

      // 1. Try to load keypair from local storage (same device)
      let keyPair = await loadKeyPairForUser(data.user.id);
      const serverHasBackup = Boolean(data.encryptedPrivateKey && data.keySalt && data.keyNonce);

      // 2. If no local key, try to recover from server backup
      if (!keyPair && serverHasBackup) {
        console.log('[KeyRecovery] Attempting to recover keypair from server backup...');
        const secretKey = await decryptPrivateKeyWithPassword(
          data.encryptedPrivateKey,
          data.keySalt,
          data.keyNonce,
          password
        );
        if (secretKey) {
          const nacl = (await import('tweetnacl')).default;
          keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
          await saveKeyPairForUser(data.user.id, keyPair);
          console.log('[KeyRecovery] Successfully recovered keypair from server backup');
        } else {
          console.warn('[KeyRecovery] Failed to decrypt server backup — wrong password or corrupted data');
        }
      }

      // 3. Only generate a new keypair as a last resort (no local key, no server backup).
      // This means old messages encrypted with a previous keypair will be unreadable.
      let generatedNewKeyPair = false;
      if (!keyPair) {
        console.warn('[KeyRecovery] No local or server-backed keypair found; generating new keypair. Old encrypted messages will be unreadable.');
        keyPair = generateKeyPair();
        await saveKeyPairForUser(data.user.id, keyPair);
        generatedNewKeyPair = true;
      }

      // Upload encrypted backup whenever a new keypair was generated or
      // the server doesn't have a backup yet (e.g., legacy account).
      const needsBackupUpload = generatedNewKeyPair || !serverHasBackup;
      await syncPublicKey(data.token, keyPair, needsBackupUpload ? password : undefined);

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

      // Encrypt the private key with the password for server-side backup
      const encryptedKeyData = await encryptPrivateKeyWithPassword(keyPair.secretKey, password);

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          publicKey: publicKeyB64,
          encryptedPrivateKey: encryptedKeyData.encryptedPrivateKey,
          keySalt: encryptedKeyData.keySalt,
          keyNonce: encryptedKeyData.keyNonce,
        }),
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

import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

const textDecoder = new TextDecoder();

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
}

export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

export function keyPairToBase64(keyPair: KeyPair): { publicKey: string; secretKey: string } {
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

export function keyPairFromBase64(b64: { publicKey: string; secretKey: string }): KeyPair {
  return {
    publicKey: decodeBase64(b64.publicKey),
    secretKey: decodeBase64(b64.secretKey),
  };
}

export function encryptMessage(
  message: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(message);
  const encrypted = nacl.box(messageBytes, nonce, recipientPublicKey, senderSecretKey);

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

export function decryptMessage(
  payload: EncryptedPayload,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string | null {
  try {
    const ciphertext = decodeBase64(payload.ciphertext);
    const nonce = decodeBase64(payload.nonce);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    if (!decrypted) return null;
    return textDecoder.decode(decrypted);
  } catch {
    return null;
  }
}

export function encryptGroupMessage(
  message: string,
  sharedKey: Uint8Array
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(message);
  const encrypted = nacl.secretbox(messageBytes, nonce, sharedKey);

  if (!encrypted) {
    throw new Error('Group encryption failed');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

export function decryptGroupMessage(
  payload: EncryptedPayload,
  sharedKey: Uint8Array
): string | null {
  try {
    const ciphertext = decodeBase64(payload.ciphertext);
    const nonce = decodeBase64(payload.nonce);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedKey);
    if (!decrypted) return null;
    return textDecoder.decode(decrypted);
  } catch {
    return null;
  }
}

export function generateSharedKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

export function encryptGroupKeyForMember(
  groupKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(groupKey, nonce, recipientPublicKey, senderSecretKey);

  if (!encrypted) {
    throw new Error('Failed to encrypt group key for member');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

export function decryptGroupKeyFromSender(
  encryptedKey: string,
  nonce: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): Uint8Array | null {
  try {
    const ciphertext = decodeBase64(encryptedKey);
    const nonceBytes = decodeBase64(nonce);
    const decrypted = nacl.box.open(ciphertext, nonceBytes, senderPublicKey, recipientSecretKey);
    return decrypted || null;
  } catch {
    return null;
  }
}

export function serializeEncryptedPayload(payload: EncryptedPayload): string {
  return JSON.stringify(payload);
}

export function parseEncryptedPayload(str: string): EncryptedPayload | null {
  try {
    const parsed = JSON.parse(str);
    if (parsed.ciphertext && parsed.nonce) return parsed as EncryptedPayload;
    return null;
  } catch {
    return null;
  }
}

/**
 * Derive a symmetric encryption key from a password and salt using NaCl's SHA-512.
 * Runs asynchronously in chunks to avoid blocking the UI/main thread on mobile.
 *
 * NOTE: This is a pragmatic approach using existing dependencies. For stronger
 * protection against GPU/ASIC attacks, upgrade to Argon2id or PBKDF2 when a
 * suitable cross-platform library is available.
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = decodeUTF8(password);
  const input = new Uint8Array(salt.length + passwordBytes.length);
  input.set(salt);
  input.set(passwordBytes, salt.length);

  const ROUNDS = 100000;
  const CHUNK_SIZE = 5000; // Yield to event loop every N rounds
  let hash = nacl.hash(input);
  for (let i = 1; i < ROUNDS; i++) {
    hash = nacl.hash(hash);
    if (i % CHUNK_SIZE === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return hash.slice(0, nacl.secretbox.keyLength);
}

/**
 * Encrypt a NaCl secret key using a password-derived key so it can be stored
 * on the server for cross-device recovery.
 */
export async function encryptPrivateKeyWithPassword(
  secretKey: Uint8Array,
  password: string
): Promise<{ encryptedPrivateKey: string; keySalt: string; keyNonce: string }> {
  const salt = nacl.randomBytes(32);
  const derivedKey = await deriveKeyFromPassword(password, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(secretKey, nonce, derivedKey);

  if (!encrypted) {
    throw new Error('Failed to encrypt private key');
  }

  return {
    encryptedPrivateKey: encodeBase64(encrypted),
    keySalt: encodeBase64(salt),
    keyNonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a NaCl secret key that was encrypted with a password-derived key.
 * Used during login to recover the keypair from server backup.
 */
export async function decryptPrivateKeyWithPassword(
  encryptedPrivateKey: string,
  keySalt: string,
  keyNonce: string,
  password: string
): Promise<Uint8Array | null> {
  try {
    const salt = decodeBase64(keySalt);
    const derivedKey = await deriveKeyFromPassword(password, salt);
    const nonce = decodeBase64(keyNonce);
    const ciphertext = decodeBase64(encryptedPrivateKey);
    return nacl.secretbox.open(ciphertext, nonce, derivedKey) || null;
  } catch {
    return null;
  }
}

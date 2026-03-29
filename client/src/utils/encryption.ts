import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

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
  const messageBytes = encodeUTF8(message);
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
  const messageBytes = encodeUTF8(message);
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

export function encryptSharedKeyForRecipient(
  sharedKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(sharedKey, nonce, recipientPublicKey, senderSecretKey);

  if (!encrypted) {
    throw new Error('Failed to encrypt shared key');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

export function decryptSharedKey(
  payload: EncryptedPayload,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): Uint8Array | null {
  try {
    const ciphertext = decodeBase64(payload.ciphertext);
    const nonce = decodeBase64(payload.nonce);
    return nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
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

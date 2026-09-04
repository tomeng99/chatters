import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import {
  generateKeyPair,
  keyPairToBase64,
  keyPairFromBase64,
  encryptMessage,
  decryptMessage,
  encryptGroupMessage,
  decryptGroupMessage,
  generateSharedKey,
  encryptGroupKeyForMember,
  decryptGroupKeyFromSender,
  serializeEncryptedPayload,
  parseEncryptedPayload,
  deriveKeyFromPassword,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
} from './encryption';

// A message with multi-byte characters: the encode/decode pair has to be
// UTF-8 clean, not latin-1, or emoji arrive mangled.
const UNICODE_MESSAGE = 'héllo — 🎉 안녕하세요';

test('a keypair survives a base64 round trip', () => {
  const keyPair = generateKeyPair();
  const restored = keyPairFromBase64(keyPairToBase64(keyPair));

  assert.deepEqual(restored.publicKey, keyPair.publicKey);
  assert.deepEqual(restored.secretKey, keyPair.secretKey);
});

test('a 1:1 message decrypts for the intended recipient', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const payload = encryptMessage(UNICODE_MESSAGE, bob.publicKey, alice.secretKey);

  assert.equal(decryptMessage(payload, alice.publicKey, bob.secretKey), UNICODE_MESSAGE);
});

test('a 1:1 message is not plaintext on the wire', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const payload = encryptMessage('meet me at noon', bob.publicKey, alice.secretKey);

  assert.doesNotMatch(payload.ciphertext, /meet me at noon/);
  assert.notEqual(payload.ciphertext, '');
  assert.notEqual(payload.nonce, '');
});

test('a 1:1 message does not decrypt for a third party', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  const eve = generateKeyPair();

  const payload = encryptMessage('secret', bob.publicKey, alice.secretKey);

  assert.equal(decryptMessage(payload, alice.publicKey, eve.secretKey), null);
});

// Callers render the return value straight into the message list, so a
// corrupt payload has to come back as null rather than throw.
test('decryptMessage returns null instead of throwing on a corrupt payload', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  assert.equal(
    decryptMessage({ ciphertext: 'not base64 !!', nonce: '???' }, alice.publicKey, bob.secretKey),
    null
  );
  assert.equal(
    decryptMessage({ ciphertext: '', nonce: '' }, alice.publicKey, bob.secretKey),
    null
  );
});

test('a tampered 1:1 ciphertext fails to decrypt', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const payload = encryptMessage('transfer approved', bob.publicKey, alice.secretKey);
  const bytes = Buffer.from(payload.ciphertext, 'base64');
  bytes[0] ^= 0xff;

  const tampered = { ...payload, ciphertext: bytes.toString('base64') };

  assert.equal(decryptMessage(tampered, alice.publicKey, bob.secretKey), null);
});

// Nonce reuse under the same key is the one mistake that breaks NaCl outright.
test('encrypting the same message twice produces a fresh nonce each time', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const first = encryptMessage('same text', bob.publicKey, alice.secretKey);
  const second = encryptMessage('same text', bob.publicKey, alice.secretKey);

  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('a group message decrypts with the shared key', () => {
  const groupKey = generateSharedKey();

  const payload = encryptGroupMessage(UNICODE_MESSAGE, groupKey);

  assert.equal(decryptGroupMessage(payload, groupKey), UNICODE_MESSAGE);
});

test('a group message does not decrypt with a different shared key', () => {
  const payload = encryptGroupMessage('members only', generateSharedKey());

  assert.equal(decryptGroupMessage(payload, generateSharedKey()), null);
});

test('decryptGroupMessage returns null instead of throwing on a corrupt payload', () => {
  assert.equal(decryptGroupMessage({ ciphertext: 'nope !!', nonce: '!!' }, generateSharedKey()), null);
});

test('generateSharedKey returns a full-length secretbox key', () => {
  assert.equal(generateSharedKey().length, nacl.secretbox.keyLength);
  assert.notEqual(encodeBase64(generateSharedKey()), encodeBase64(generateSharedKey()));
});

// The whole group flow: the key is wrapped for a member, unwrapped by them,
// and the unwrapped key has to actually open the group's messages.
test('a group key wrapped for a member unwraps and opens group messages', () => {
  const owner = generateKeyPair();
  const member = generateKeyPair();
  const groupKey = generateSharedKey();

  const wrapped = encryptGroupKeyForMember(groupKey, member.publicKey, owner.secretKey);
  const unwrapped = decryptGroupKeyFromSender(
    wrapped.ciphertext,
    wrapped.nonce,
    owner.publicKey,
    member.secretKey
  );

  assert.notEqual(unwrapped, null);
  assert.deepEqual(unwrapped, groupKey);

  const message = encryptGroupMessage('welcome to the group', groupKey);
  assert.equal(decryptGroupMessage(message, unwrapped as Uint8Array), 'welcome to the group');
});

test('a group key wrapped for one member does not unwrap for another', () => {
  const owner = generateKeyPair();
  const member = generateKeyPair();
  const outsider = generateKeyPair();
  const groupKey = generateSharedKey();

  const wrapped = encryptGroupKeyForMember(groupKey, member.publicKey, owner.secretKey);

  assert.equal(
    decryptGroupKeyFromSender(wrapped.ciphertext, wrapped.nonce, owner.publicKey, outsider.secretKey),
    null
  );
});

test('decryptGroupKeyFromSender returns null instead of throwing on garbage', () => {
  const member = generateKeyPair();
  const owner = generateKeyPair();

  assert.equal(
    decryptGroupKeyFromSender('not base64 !!', '!!', owner.publicKey, member.secretKey),
    null
  );
});

test('an encrypted payload survives serialization', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  const payload = encryptMessage('stored as text', bob.publicKey, alice.secretKey);

  const parsed = parseEncryptedPayload(serializeEncryptedPayload(payload));

  assert.deepEqual(parsed, payload);
  assert.equal(decryptMessage(parsed!, alice.publicKey, bob.secretKey), 'stored as text');
});

test('parseEncryptedPayload returns null for anything that is not a payload', () => {
  assert.equal(parseEncryptedPayload('plain text message'), null);
  assert.equal(parseEncryptedPayload('{'), null);
  assert.equal(parseEncryptedPayload('{"ciphertext":"abc"}'), null);
  assert.equal(parseEncryptedPayload('{"nonce":"abc"}'), null);
});

test('deriveKeyFromPassword is deterministic and salt-dependent', async () => {
  const salt = nacl.randomBytes(32);
  const otherSalt = nacl.randomBytes(32);

  const key = await deriveKeyFromPassword('correct horse battery staple', salt);
  const same = await deriveKeyFromPassword('correct horse battery staple', salt);
  const otherSaltKey = await deriveKeyFromPassword('correct horse battery staple', otherSalt);
  const otherPasswordKey = await deriveKeyFromPassword('wrong horse battery staple', salt);

  assert.equal(key.length, nacl.secretbox.keyLength);
  assert.deepEqual(same, key);
  assert.notDeepEqual(otherSaltKey, key);
  assert.notDeepEqual(otherPasswordKey, key);
});

test('a private key backup round trips through the password that made it', async () => {
  const keyPair = generateKeyPair();

  const backup = await encryptPrivateKeyWithPassword(keyPair.secretKey, 'hunter2-but-longer');
  const recovered = await decryptPrivateKeyWithPassword(
    backup.encryptedPrivateKey,
    backup.keySalt,
    backup.keyNonce,
    'hunter2-but-longer'
  );

  assert.deepEqual(recovered, keyPair.secretKey);
  // The backup the server stores must not be the secret key in the clear.
  assert.notEqual(backup.encryptedPrivateKey, encodeBase64(keyPair.secretKey));
});

test('a private key backup does not open with the wrong password', async () => {
  const keyPair = generateKeyPair();

  const backup = await encryptPrivateKeyWithPassword(keyPair.secretKey, 'hunter2-but-longer');
  const recovered = await decryptPrivateKeyWithPassword(
    backup.encryptedPrivateKey,
    backup.keySalt,
    backup.keyNonce,
    'hunter3-but-longer'
  );

  assert.equal(recovered, null);
});

test('decryptPrivateKeyWithPassword returns null instead of throwing on a corrupt backup', async () => {
  assert.equal(await decryptPrivateKeyWithPassword('!!', '!!', '!!', 'password'), null);
});

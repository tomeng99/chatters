import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUploadPath, resolveMediaUrl } from './mediaUrl';

const API_BASE = 'https://chat.example.com';

// The exact shape server/src/routes/uploads.ts returns.
const REAL_UPLOAD = '/uploads/3f2504e0-4f89-11d3-9a0c-0305e82c3301.jpg';

test('a real upload path resolves against the API base', () => {
  assert.equal(resolveMediaUrl(REAL_UPLOAD, API_BASE), `${API_BASE}${REAL_UPLOAD}`);
});

test('every extension the upload endpoint can produce is accepted', () => {
  for (const ext of ['.jpg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.mpeg', '.pdf']) {
    assert.equal(isUploadPath(`/uploads/3f2504e0-4f89-11d3-9a0c-0305e82c3301${ext}`), true, ext);
  }
});

// The attack this closes: a sender puts a URL they control in a media message,
// and the recipient's client fetches it with no interaction, handing over their
// IP address, user agent and the moment they opened the chat.
test('an absolute URL to another host is rejected', () => {
  assert.equal(resolveMediaUrl('https://tracker.example/px.gif', API_BASE), null);
  assert.equal(resolveMediaUrl('http://tracker.example/px.gif', API_BASE), null);
});

test('a protocol-relative URL is rejected', () => {
  assert.equal(resolveMediaUrl('//tracker.example/px.gif', API_BASE), null);
});

test('an absolute URL that only starts with the uploads prefix is rejected', () => {
  assert.equal(resolveMediaUrl('https://tracker.example/uploads/px.gif', API_BASE), null);
});

test('traversal out of the uploads directory is rejected', () => {
  assert.equal(resolveMediaUrl('/uploads/../../etc/passwd', API_BASE), null);
  assert.equal(resolveMediaUrl('/uploads/..', API_BASE), null);
  assert.equal(resolveMediaUrl('/uploads/.', API_BASE), null);
});

test('a nested path under uploads is rejected', () => {
  assert.equal(resolveMediaUrl('/uploads/sub/dir/file.jpg', API_BASE), null);
});

test('a query string or fragment is rejected', () => {
  // Nothing the server hands out has one, and either would let a sender smuggle
  // a redirect or a cache-busting beacon past the prefix check.
  assert.equal(resolveMediaUrl('/uploads/file.jpg?to=tracker.example', API_BASE), null);
  assert.equal(resolveMediaUrl('/uploads/file.jpg#x', API_BASE), null);
});

test('a backslash in the file name is rejected', () => {
  assert.equal(resolveMediaUrl('/uploads/\\tracker.example\\px.gif', API_BASE), null);
});

test('a non-uploads path and an empty file name are rejected', () => {
  assert.equal(resolveMediaUrl('/api/auth/login', API_BASE), null);
  assert.equal(resolveMediaUrl('/uploads/', API_BASE), null);
  assert.equal(resolveMediaUrl('', API_BASE), null);
});

test('a javascript: URL is rejected', () => {
  assert.equal(resolveMediaUrl('javascript:alert(1)', API_BASE), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const TEST_SECRET = 'test-secret-used-only-by-this-suite';
process.env.JWT_SECRET = TEST_SECRET;

// config/env reads JWT_SECRET at import time and kills the process when it is
// missing, so the middleware has to be pulled in after the env var is set —
// a top-level import would be hoisted above the assignment above.
const { authenticateToken } = require('./auth') as typeof import('./auth');

interface CapturedResponse {
  statusCode: number | null;
  body: { error?: string } | null;
}

interface Invocation {
  req: Request;
  res: CapturedResponse;
  nextCalled: boolean;
}

/** Run the middleware against a fake request carrying the given Authorization header. */
function invoke(authHeader?: string): Invocation {
  const captured: CapturedResponse = { statusCode: null, body: null };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: { error?: string }) {
      captured.body = payload;
      return this;
    },
  };

  const req = {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  } as Request;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  authenticateToken(req, res as unknown as Response, next);

  return { req, res: captured, nextCalled };
}

function signWith(secret: string, options?: jwt.SignOptions): string {
  return jwt.sign({ id: 'user-1', username: 'alice' }, secret, options);
}

test('accepts a token signed with the configured secret and attaches the user', () => {
  const { req, res, nextCalled } = invoke(`Bearer ${signWith(TEST_SECRET)}`);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.equal(req.user.id, 'user-1');
  assert.equal(req.user.username, 'alice');
});

test('rejects a request with no Authorization header', () => {
  const { res, nextCalled } = invoke();

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Access token required' });
});

// The header is parsed as "<scheme> <token>", so a bare token is not a credential.
test('rejects an Authorization header with no Bearer scheme', () => {
  const { res, nextCalled } = invoke(signWith(TEST_SECRET));

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('rejects a Bearer scheme with no token after it', () => {
  const { res, nextCalled } = invoke('Bearer');

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('rejects a token signed with a different secret', () => {
  const { res, nextCalled } = invoke(`Bearer ${signWith('some-other-secret')}`);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Invalid or expired token' });
});

test('rejects an expired token', () => {
  const { res, nextCalled } = invoke(`Bearer ${signWith(TEST_SECRET, { expiresIn: '-1s' })}`);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

// The classic JWT downgrade: an attacker re-encodes the payload with
// "alg": "none" and drops the signature. jwt.verify must not honour it.
test('rejects an unsigned "alg: none" token', () => {
  const unsigned = jwt.sign({ id: 'attacker', username: 'mallory' }, '', { algorithm: 'none' });
  const { res, nextCalled } = invoke(`Bearer ${unsigned}`);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('rejects a token whose payload was edited after signing', () => {
  const [header, , signature] = signWith(TEST_SECRET).split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ id: 'user-2', username: 'mallory' }))
    .toString('base64url');
  const { res, nextCalled } = invoke(`Bearer ${header}.${forgedPayload}.${signature}`);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('rejects a syntactically invalid token', () => {
  const { res, nextCalled } = invoke('Bearer not-a-jwt');

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

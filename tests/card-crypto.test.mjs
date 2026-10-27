import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { ed25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/nist.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

import {
  challengeMessage,
  normalizeP256Signature,
  parsePairingKey,
  samePublicKey,
  verifyCardSignature,
} from '../src/api/item/card-crypto.ts';

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const digest = (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest());

test('pairing key must be exactly 32 hex bytes', () => {
  assert.deepEqual(parsePairingKey(Buffer.from(key).toString('hex')), key);
  assert.throws(() => parsePairingKey('not-a-key'));
  assert.throws(() => parsePairingKey('aa'.repeat(31)));
});

test('signature verifies only for the signed card action and pinned public key', () => {
  const nonce = new Uint8Array(32).fill(7);
  const message = digest(challengeMessage('card-a', 'fund', '["card-1",5]', nonce));
  const differentAmount = digest(challengeMessage('card-a', 'fund', '["card-1",6]', nonce));
  const differentPurpose = digest(challengeMessage('card-a', 'sign-in', '["card-1",5]', nonce));

  for (const [curve, prehash] of [
    [p256, false],
    [secp256k1, true],
  ]) {
    const publicKey = curve.getPublicKey(key, false);
    const signature = curve.sign(message, key, { lowS: false, prehash }).toCompactRawBytes();
    assert.equal(verifyCardSignature(signature, message, publicKey), true);
    const wrongHashMode = curve.sign(message, key, { lowS: false, prehash: !prehash }).toCompactRawBytes();
    assert.equal(verifyCardSignature(wrongHashMode, message, publicKey), false);
    assert.equal(verifyCardSignature(signature, differentAmount, publicKey), false);
    assert.equal(verifyCardSignature(signature, differentPurpose, publicKey), false);
    assert.equal(
      verifyCardSignature(signature, message, curve.getPublicKey(Uint8Array.from(key).reverse(), false)),
      false,
    );
    assert.equal(samePublicKey(publicKey, Buffer.from(publicKey).toString('hex')), true);
  }
});

test('a real Ed25519 signature verifies for a 32-byte public key', () => {
  const message = digest(challengeMessage('card-a', 'sign-in', '', new Uint8Array(32).fill(9)));
  const publicKey = ed25519.getPublicKey(key);
  const signature = ed25519.sign(message, key);
  assert.equal(verifyCardSignature(signature, message, publicKey), true);
  assert.equal(verifyCardSignature(new Uint8Array(64).fill(0xee), message, publicKey), false);
  assert.equal(
    verifyCardSignature(
      signature,
      digest(challengeMessage('card-b', 'sign-in', '', new Uint8Array(32).fill(9))),
      publicKey,
    ),
    false,
  );
  assert.equal(verifyCardSignature(signature, message, ed25519.getPublicKey(Uint8Array.from(key).reverse())), false);
});

test('high-S P-256 signatures normalize for Soroban without changing authorization', () => {
  const message = digest(new Uint8Array(32).fill(21));
  const publicKey = p256.getPublicKey(key, false);
  const low = p256.sign(message, key).toCompactRawBytes();
  const highS = p256.Signature.fromCompact(low).s;
  const n = p256.CURVE.n;
  const highBytes = new Uint8Array(64);
  highBytes.set(low.slice(0, 32));
  const sHex = (n - highS).toString(16).padStart(64, '0');
  highBytes.set(Buffer.from(sHex, 'hex'), 32);
  const normalized = normalizeP256Signature(highBytes);
  assert.deepEqual(normalized, low);
  assert.equal(p256.verify(normalized, message, publicKey), true);
  assert.throws(() => normalizeP256Signature(new Uint8Array(63)));
});

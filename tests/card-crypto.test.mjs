import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { ed25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/nist.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

import { challengeMessage, parsePairingKey, samePublicKey, verifyCardSignature } from '../src/api/item/card-crypto.ts';

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const digest = (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest());

test('pairing key must be exactly 32 hex bytes', () => {
  assert.deepEqual(parsePairingKey(Buffer.from(key).toString('hex')), key);
  assert.throws(() => parsePairingKey('not-a-key'));
  assert.throws(() => parsePairingKey('aa'.repeat(31)));
});

test('signature verifies only for the signed card action and pinned public key', () => {
  const nonce = new Uint8Array(32).fill(7);
  const message = digest(challengeMessage('card-a', 'reload', '["card-1",5]', nonce));
  const differentAmount = digest(challengeMessage('card-a', 'reload', '["card-1",6]', nonce));
  const differentPurpose = digest(challengeMessage('card-a', 'sign-in', '["card-1",5]', nonce));

  for (const curve of [p256, secp256k1]) {
    const publicKey = curve.getPublicKey(key, false);
    const signature = curve.sign(message, key, { lowS: false, prehash: true }).toCompactRawBytes();
    assert.equal(verifyCardSignature(signature, message, publicKey), true);
    const rawDigestSignature = curve.sign(message, key, { lowS: false, prehash: false }).toCompactRawBytes();
    assert.equal(verifyCardSignature(rawDigestSignature, message, publicKey), false);
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

import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { p256 } from '@noble/curves/nist.js';
import { StrKey } from '@stellar/stellar-sdk';

import { accountAddress, issueChallenge, publicKeyBytes, verifyChallenge } from '../src/account.mjs';

const secret = 'test challenge secret with at least thirty two bytes';
const privateKey = new Uint8Array(32).fill(7);
const publicKey = Buffer.from(p256.getPublicKey(privateKey, false)).toString('hex');
const otherPublicKey = Buffer.from(p256.getPublicKey(new Uint8Array(32).fill(8), false)).toString('hex');

test('mainnet address is deterministic, key-bound, and a C-address', () => {
  const first = accountAddress(publicKeyBytes(publicKey));
  assert.equal(accountAddress(publicKeyBytes(publicKey)), first);
  assert.notEqual(accountAddress(publicKeyBytes(otherPublicKey)), first);
  assert.equal(StrKey.isValidContract(first), true);
  assert.throws(() => publicKeyBytes(`02${publicKey.slice(2)}`));
});

test('proof requires a fresh server challenge signed directly by P-256', () => {
  const now = 1_800_000_000_000;
  const { digest, token } = issueChallenge(secret, now);
  const signature = p256.sign(Buffer.from(digest, 'hex'), privateKey, { lowS: false }).toCompactRawBytes();
  const sigHex = Buffer.from(signature).toString('hex');
  assert.equal(verifyChallenge(secret, digest, token, publicKey, sigHex, now + 1000), true);
  assert.equal(verifyChallenge(secret, digest, token, otherPublicKey, sigHex, now + 1000), false);
  assert.equal(verifyChallenge(secret, digest, token, publicKey, sigHex, now + 120001), false);
  assert.equal(
    verifyChallenge(secret, digest, `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`, publicKey, sigHex, now),
    false,
  );
  assert.equal(verifyChallenge(secret, '00'.repeat(32), token, publicKey, sigHex, now), false);
  const doubleHashed = p256.sign(Buffer.from(digest, 'hex'), privateKey, { lowS: false, prehash: true });
  assert.equal(
    verifyChallenge(
      secret,
      digest,
      token,
      publicKey,
      Buffer.from(doubleHashed.toCompactRawBytes()).toString('hex'),
      now,
    ),
    false,
  );
});

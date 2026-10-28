import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { p256 } from '@noble/curves/nist.js';
import { Address, Networks, xdr } from '@stellar/stellar-sdk/base';
import {
  amountUnits,
  cardAccountAddress,
  signedTransferAuth,
  transferDigest,
  validatePreparedTransfer,
} from '../src/api/stellar/transfer-codec.ts';
import { fixture, intent, publicKey, privateKey } from './transfer-fixture.mjs';

test('amounts are exact and reject zero, overflow, exponent notation, signs, and extra decimal places', () => {
  assert.equal(amountUnits('0.0000001'), 1n);
  assert.equal(amountUnits('123456789012.1234567'), 1234567890121234567n);
  assert.equal(amountUnits('922337203685.4775807'), 9223372036854775807n);
  for (const amount of ['0', '-1', '+1', '1e2', '1.00000001', '01', 'NaN', '922337203685.4775808', '']) {
    assert.throws(() => amountUnits(amount));
  }
});

for (const v2 of [false, true]) {
  test(`SDK17 authorization matches the checked-in host-test vector (v${v2 ? 2 : 1})`, () => {
    const { prepared, signature, signedAuth } = fixture(v2);
    validatePreparedTransfer(prepared, intent, publicKey, 1001);
    assert.equal(p256.verify(signature, transferDigest(prepared), publicKey), true);
    const checkedIn = readFileSync(
      new URL(`../contracts/p256-verifier/fixtures/transfer-v${v2 ? 2 : 1}.xdr`, import.meta.url),
      'utf8',
    ).trim();
    assert.equal(signedAuth, checkedIn);
    const entry = xdr.SorobanAuthorizationEntry.fromXdr(signedAuth, 'base64');
    assert.equal(entry.rootInvocation.subInvocations.length, 0);
  });
}

test('signing rejects changed intent, network, account, authority, nested calls and expiry', () => {
  const { prepared } = fixture();
  const check = (p, i = intent, key = publicKey, ledger = 1000) => validatePreparedTransfer(p, i, key, ledger);
  for (const changed of [
    { ...intent, amount: '1.26' },
    { ...intent, asset: 'USDC' },
    { ...intent, recipient: cardAccountAddress(p256.getPublicKey(new Uint8Array(32).fill(8), false)) },
  ]) {
    assert.throws(() => check(prepared, changed));
  }
  assert.throws(() => check({ ...prepared, network: Networks.TESTNET }));
  assert.throws(() => check({ ...prepared, account: intent.recipient }));
  assert.throws(() => check({ ...prepared, verifier: prepared.account }));
  assert.throws(() => check(prepared, intent, p256.getPublicKey(new Uint8Array(32).fill(8), false)));
  assert.throws(() => check(prepared, intent, publicKey, 1120));
  assert.throws(() => check({ ...prepared, expirationLedger: 999999 }));
  const wire = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64').toXdrObject();
  wire.rootInvocation.subInvocations.push(structuredClone(wire.rootInvocation));
  assert.throws(() => check({ ...prepared, auth: xdr.SorobanAuthorizationEntry.fromXdrObject(wire).toXdr('base64') }));
  wire.rootInvocation.subInvocations = [];
  wire.credentials.address.address = Address.fromString(intent.recipient).toScAddress().toXdrObject();
  assert.throws(() => check({ ...prepared, auth: xdr.SorobanAuthorizationEntry.fromXdrObject(wire).toXdr('base64') }));
});

test('P-256 signature binds nonce and payload; rejects high-S, double hashing and wrong key', () => {
  const { prepared, signature } = fixture();
  const wire = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64').toXdrObject();
  wire.credentials.address.nonce += 1n;
  const changed = { ...prepared, auth: xdr.SorobanAuthorizationEntry.fromXdrObject(wire).toXdr('base64') };
  assert.throws(() => signedTransferAuth(changed, publicKey, signature));
  const sig = p256.Signature.fromCompact(signature);
  const high = new p256.Signature(sig.r, p256.CURVE.n - sig.s).toCompactRawBytes();
  assert.throws(() => signedTransferAuth(prepared, publicKey, high));
  const twice = p256.sign(transferDigest(prepared), privateKey, { prehash: true }).toCompactRawBytes();
  assert.throws(() => signedTransferAuth(prepared, publicKey, twice));
  assert.throws(() => signedTransferAuth(prepared, p256.getPublicKey(new Uint8Array(32).fill(8), false), signature));
  assert.notDeepEqual(Buffer.from(transferDigest(fixture(true).prepared)), Buffer.from(transferDigest(prepared)));
});

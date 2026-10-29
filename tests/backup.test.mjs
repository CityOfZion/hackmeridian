import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { p256 } from '@noble/curves/nist.js';
import { xdr } from '@stellar/stellar-sdk/base';
import { fixture, publicKey, publicKeyHex, intent as payment } from './transfer-fixture.mjs';
import { backupFixture, backupPublicKey, backupPublicKeyHex, backupSecret, authorization } from './backup-fixture.mjs';
import { backupProofDigest, validatePreparedBackup } from '../src/api/stellar/backup-codec.ts';
import { transferDigest, signedTransferAuth, validatePreparedTransfer } from '../src/api/stellar/transfer-codec.ts';
import { accountSigners, changeWallet, emptyWallet, parseWallet } from '../src/wallet/model.ts';

test('backup approval binds exact account, candidate, one independent Default rule and current rule', () => {
  const { prepared, intent, binding } = backupFixture();
  const check = (p = prepared, i = intent, b = binding) => validatePreparedBackup(p, i, publicKey, 1001, b);
  check();
  assert.throws(() => check(prepared, { ...intent, publicKey: publicKeyHex }));
  assert.throws(() => check({ ...prepared, ruleId: 1 }));
  assert.throws(() => check(prepared, intent, { ...binding, account: payment.recipient }));
  const wire = xdr.HostFunction.fromXdr(prepared.func, 'base64').toXdrObject();
  wire.invokeContract.functionName = 'add_signer';
  assert.throws(() => check({ ...prepared, func: xdr.HostFunction.fromXdrObject(wire).toXdr('base64') }));
  const auth = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64').toXdrObject();
  auth.rootInvocation.subInvocations.push(structuredClone(auth.rootInvocation));
  assert.throws(() => check({ ...prepared, auth: xdr.SorobanAuthorizationEntry.fromXdrObject(auth).toXdr('base64') }));
  assert.throws(() => validatePreparedBackup(prepared, intent, publicKey, 1120, binding));
});
test('backup can sign for original account only with the selected binding and rule', () => {
  const prepared = authorization({ ...fixture().prepared, ruleId: 1 }, 458n);
  const binding = { account: prepared.account, ruleId: 1 };
  validatePreparedTransfer(prepared, payment, backupPublicKey, 1000, binding);
  assert.throws(() => validatePreparedTransfer(prepared, payment, backupPublicKey, 1000));
  const signature = p256.sign(transferDigest(prepared), backupSecret, { lowS: true }).toCompactRawBytes();
  signedTransferAuth(prepared, backupPublicKey, signature, binding);
  assert.throws(() => signedTransferAuth({ ...prepared, ruleId: 0 }, backupPublicKey, signature, binding));
  assert.throws(() => signedTransferAuth(prepared, publicKey, signature, binding));
  assert.notDeepEqual(backupProofDigest(prepared.account, new Uint8Array(32)), transferDigest(prepared));
});
test('backup enrollment and card selection preserve one account, names, balances address and independent accounts across restart', () => {
  const id = fixture().prepared.account;
  const verifiedAt = new Date().toISOString();
  const enroll = (data, uid, key, ruleId) =>
    changeWallet(data, {
      type: 'enroll',
      account: { id, cardUid: uid, publicKey: key, originPublicKey: publicKeyHex, ruleId, name: 'Savings', verifiedAt },
      card: { uid, name: uid, publicKey: key, verifiedAt },
    });
  let wallet = enroll(emptyWallet(), 'primary', publicKeyHex, 0);
  wallet = enroll(wallet, 'backup', backupPublicKeyHex, 1);
  wallet = parseWallet(JSON.stringify(wallet));
  assert.equal(wallet.accounts.length, 1);
  assert.equal(accountSigners(wallet.accounts[0]).length, 2);
  assert.equal(wallet.accounts[0].publicKey, backupPublicKeyHex);
  wallet = changeWallet(wallet, { type: 'selectSigner', id, publicKey: publicKeyHex });
  assert.equal(wallet.accounts[0].cardUid, 'primary');
  assert.equal(wallet.accounts[0].id, id);
  assert.throws(() => changeWallet(wallet, { type: 'selectSigner', id, publicKey: 'bad' }));
  assert.throws(() => enroll(wallet, 'clone', publicKeyHex, 0));
});

test('backup host fixtures match the phone codec', () => {
  assert.equal(
    readFileSync(new URL('../contracts/p256-verifier/fixtures/backup-add.xdr', import.meta.url), 'utf8').trim(),
    backupFixture().signedAuth,
  );
  const prepared = authorization({ ...fixture().prepared, ruleId: 1 }, 458n);
  const signature = p256.sign(transferDigest(prepared), backupSecret, { lowS: true }).toCompactRawBytes();
  assert.equal(
    readFileSync(new URL('../contracts/p256-verifier/fixtures/backup-transfer.xdr', import.meta.url), 'utf8').trim(),
    signedTransferAuth(prepared, backupPublicKey, signature, { account: prepared.account, ruleId: 1 }),
  );
});

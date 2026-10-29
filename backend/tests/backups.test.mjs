import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { p256 } from '@noble/curves/nist.js';
import { issueChallenge } from '../src/account.mjs';
import { validateAuthority } from '../src/stellar.mjs';
import { makeBackupService, verifyBackupProof, openZeppelinBackupFunction } from '../src/backups.mjs';
import { openTransferStore } from '../src/transfer-store.mjs';
import { backupFixture, backupPublicKeyHex, backupSecret } from '../../tests/backup-fixture.mjs';
import { publicKeyHex, publicKey } from '../../tests/transfer-fixture.mjs';
import { backupProofDigest, backupFunction } from '../../src/api/stellar/backup-codec.ts';
import { P256_VERIFIER } from '../../src/api/stellar/transfer-codec.ts';

process.env.CHALLENGE_SECRET = 'backup tests: local secret at least thirty two characters';
const f = backupFixture();
function proof() {
  const challenge = issueChallenge(process.env.CHALLENGE_SECRET);
  return {
    ...challenge,
    signature: Buffer.from(
      p256
        .sign(backupProofDigest(f.intent.account, Buffer.from(challenge.digest, 'hex')), backupSecret, { lowS: true })
        .toCompactRawBytes(),
    ).toString('hex'),
  };
}
function setup({ path = ':memory:', loseResponse = false, installed = false } = {}) {
  let calls = 0;
  const store = openTransferStore(path, (r) => r.intent.account);
  const chain = {
    prepare: async () => f.prepared,
    latestLedger: async () => 1001,
    enforce: async () => {},
    submit: async () => {
      calls++;
      if (loseResponse) throw new Error('lost response');
      return { hash: 'ab'.repeat(32) };
    },
    lookup: async () => ({ state: loseResponse ? 'unknown' : 'confirmed', hash: 'ab'.repeat(32) }),
  };
  const authority = async (address) =>
    address === f.intent.account
      ? [{ ruleId: 0, publicKey: publicKeyHex }, ...(installed ? [{ ruleId: 1, publicKey: backupPublicKeyHex }] : [])]
      : null;
  return { service: makeBackupService({ store, chain, authority }), store, calls: () => calls };
}
test('candidate proof is fresh, bound to the account and cannot substitute a login challenge or another key', () => {
  const p = proof();
  assert.equal(verifyBackupProof(f.intent, p), true);
  assert.equal(verifyBackupProof({ ...f.intent, publicKey: publicKeyHex }, p), false);
  assert.equal(verifyBackupProof({ ...f.intent, account: P256_VERIFIER }, p), false);
  assert.equal(verifyBackupProof(f.intent, { ...p, token: '0.' + '00'.repeat(32) }), false);
  const login = p256.sign(Buffer.from(p.digest, 'hex'), backupSecret, { lowS: true }).toCompactRawBytes();
  assert.equal(verifyBackupProof(f.intent, { ...p, signature: Buffer.from(login).toString('hex') }), false);
});
test('backup submission requires original signature, submits once and verifies membership for discovery', async () => {
  const h = setup({ installed: true });
  try {
    await assert.rejects(h.service.prepare(publicKeyHex, f.intent, f.binding, { signature: '00' }), /proof/);
    const record = await h.service.prepare(publicKeyHex, f.intent, f.binding, proof());
    await assert.rejects(h.service.submit(record.prepared.id, '00'.repeat(64)), /signature/);
    const signature = Buffer.from(f.signature).toString('hex');
    const results = await Promise.all([
      h.service.submit(record.prepared.id, signature),
      h.service.submit(record.prepared.id, signature),
    ]);
    assert.equal(results[0].state, 'pending');
    assert.equal(h.calls(), 1);
    assert.equal((await h.service.status(record.prepared.id)).state, 'confirmed');
    assert.deepEqual(await h.service.discover(backupPublicKeyHex), [
      { address: f.intent.account, ruleId: 1, originPublicKey: publicKeyHex },
    ]);
    assert.equal((await h.service.membership(f.intent.account, backupPublicKeyHex)).ruleId, 1);
  } finally {
    h.service.close();
  }
});
test('lost enrollment survives restart, blocks replacement and index alone grants no authority', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vaultpass-backups-'));
  const path = join(dir, 'backups.sqlite');
  let h = setup({ path, loseResponse: true });
  try {
    const record = await h.service.prepare(publicKeyHex, f.intent, f.binding, proof());
    const signature = Buffer.from(f.signature).toString('hex');
    assert.equal((await h.service.submit(record.prepared.id, signature)).state, 'unknown');
    h.service.close();
    h = setup({ path, loseResponse: true });
    assert.deepEqual(await h.service.discover(backupPublicKeyHex), []);
    await assert.rejects(h.service.membership(f.intent.account, backupPublicKeyHex), /not been confirmed/);
    await assert.rejects(h.service.prepare(publicKeyHex, f.intent, f.binding, proof()), /earlier approval/);
    assert.equal((await h.service.submit(record.prepared.id, signature)).state, 'unknown');
    assert.equal(h.calls(), 0);
  } finally {
    h.service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('authority inspection accepts independent card rules and rejects multisig, policies, delegated authority and wrong verifier', () => {
  const rule = {
    id: 0,
    context_type: { tag: 'Default' },
    signers: [{ tag: 'External', values: [P256_VERIFIER, Buffer.from(publicKey)] }],
    policies: [],
    valid_until: undefined,
  };
  assert.deepEqual(validateAuthority([rule], P256_VERIFIER), [{ ruleId: 0, publicKey: publicKeyHex }]);
  for (const bad of [
    { ...rule, policies: ['other'] },
    { ...rule, signers: [...rule.signers, ...rule.signers] },
    { ...rule, valid_until: 2000 },
    { ...rule, signers: [{ tag: 'Delegated', values: [P256_VERIFIER] }] },
    { ...rule, context_type: { tag: 'CallContract' } },
  ])
    assert.throws(() => validateAuthority([bad], P256_VERIFIER));
  assert.throws(() => validateAuthority([rule], f.intent.account));
});

test('installed OpenZeppelin bindings encode exactly the enrollment reviewed by the mobile SDK', () => {
  assert.equal(openZeppelinBackupFunction(f.intent), backupFunction(f.intent));
  assert.throws(() => openZeppelinBackupFunction({ ...f.intent, publicKey: '00' }));
});

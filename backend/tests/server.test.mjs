import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { after, before, test } from 'node:test';

import { makeServer } from '../src/server.mjs';
import { makeTransferService } from '../src/transfer-service.mjs';
import { openTransferStore } from '../src/transfer-store.mjs';
import { fixture, intent, publicKeyHex } from '../../tests/transfer-fixture.mjs';

let server;
let base;

before(async () => {
  process.env.CHALLENGE_SECRET = 'local test secret of at least thirty two characters';
  server = makeServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('account API issues a challenge and rejects an invalid card proof before any chain call', async () => {
  const challenge = await fetch(`${base}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(challenge.status, 200);
  const { digest, token } = await challenge.json();
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.match(token, /^\d{13}\.[0-9a-f]{64}$/);
  const resolve = await fetch(`${base}/accounts/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ digest, token, publicKey: '04' + '00'.repeat(64), signature: '00'.repeat(64) }),
  });
  assert.equal(resolve.status, 401);
});

test('HTTP transfer flow validates input and signature, submits once, and returns confirmed status', async () => {
  let submitted = 0;
  const service = makeTransferService({
    store: openTransferStore(':memory:'),
    chain: {
      prepare: async () => fixture().prepared,
      latestLedger: async () => 1001,
      enforce: async () => {},
      submit: async () => {
        submitted++;
        return { hash: 'ab'.repeat(32) };
      },
      lookup: async () => ({ state: 'confirmed', hash: 'ab'.repeat(32), ledger: 1002 }),
    },
  });
  const api = makeServer({ transfers: service });
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(0, '127.0.0.1', resolve);
  });
  const post = async (path, body) =>
    fetch(`http://127.0.0.1:${api.address().port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post('/transfers/prepare', { publicKey: publicKeyHex, intent: { ...intent, amount: '0' } })).status,
      400,
    );
    const prepared = await (await post('/transfers/prepare', { publicKey: publicKeyHex, intent })).json();
    const id = prepared.prepared.id;
    assert.equal((await post('/transfers/submit', { id, signature: '00'.repeat(64) })).status, 401);
    const signature = Buffer.from(fixture().signature).toString('hex');
    assert.equal((await (await post('/transfers/submit', { id, signature })).json()).state, 'pending');
    assert.equal((await (await post('/transfers/submit', { id, signature })).json()).state, 'pending');
    assert.equal((await (await post('/transfers/status', { id })).json()).state, 'confirmed');
    assert.equal(submitted, 1);
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});

test('existing HTTP API accepts a candidate proof and current-card approval, then confirms backup membership', async () => {
  const { p256 } = await import('@noble/curves/nist.js');
  const { makeBackupService } = await import('../src/backups.mjs');
  const { backupFixture, backupSecret, backupPublicKeyHex } = await import('../../tests/backup-fixture.mjs');
  const { backupProofDigest } = await import('../../src/api/stellar/backup-codec.ts');
  const f = backupFixture();
  let submitted = 0;
  let installed = false;
  const service = makeBackupService({
    store: openTransferStore(':memory:', (r) => r.intent.account),
    chain: {
      prepare: async () => f.prepared,
      latestLedger: async () => 1001,
      enforce: async () => {},
      submit: async () => {
        submitted++;
        return { hash: 'cd'.repeat(32) };
      },
      lookup: async () => {
        installed = true;
        return { state: 'confirmed', hash: 'cd'.repeat(32), ledger: 1002 };
      },
    },
    authority: async (address) =>
      address === f.intent.account
        ? [{ ruleId: 0, publicKey: publicKeyHex }, ...(installed ? [{ ruleId: 1, publicKey: backupPublicKeyHex }] : [])]
        : null,
  });
  const api = makeServer({ backups: service });
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(0, '127.0.0.1', resolve);
  });
  const post = async (path, body) =>
    fetch(`http://127.0.0.1:${api.address().port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    const challenge = await (await post('/challenge', {})).json();
    const candidateSignature = Buffer.from(
      p256
        .sign(backupProofDigest(f.intent.account, Buffer.from(challenge.digest, 'hex')), backupSecret, { lowS: true })
        .toCompactRawBytes(),
    ).toString('hex');
    const body = {
      publicKey: publicKeyHex,
      intent: f.intent,
      binding: f.binding,
      proof: { ...challenge, signature: candidateSignature },
    };
    assert.equal(
      (await post('/backups/prepare', { ...body, proof: { ...body.proof, signature: '00'.repeat(64) } })).status,
      401,
    );
    const response = await post('/backups/prepare', body);
    assert.equal(response.status, 200);
    const record = await response.json();
    assert.equal(record.prepared.account, f.intent.account);
    const id = record.prepared.id;
    assert.equal((await post('/backups/submit', { id, signature: '00'.repeat(64) })).status, 401);
    const signature = Buffer.from(f.signature).toString('hex');
    assert.equal((await (await post('/backups/submit', { id, signature })).json()).state, 'pending');
    assert.equal((await (await post('/backups/submit', { id, signature })).json()).state, 'pending');
    assert.equal(submitted, 1);
    assert.equal(
      (await post('/accounts/membership', { account: f.intent.account, publicKey: backupPublicKeyHex })).status,
      409,
    );
    assert.equal((await (await post('/backups/status', { id })).json()).state, 'confirmed');
    const member = await (
      await post('/accounts/membership', { account: f.intent.account, publicKey: backupPublicKeyHex })
    ).json();
    assert.deepEqual(member, { address: f.intent.account, ruleId: 1, originPublicKey: publicKeyHex });
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});

test('HTTP freeze endpoints enforce card approval and preserve one submission on retries', async () => {
  const { freezeFixture } = await import('../../tests/freeze-fixture.mjs');
  const { validateFreezeIntent, validatePreparedFreeze } = await import('../../src/api/stellar/freeze-codec.ts');
  const f = freezeFixture();
  let submitted = 0;
  const service = makeTransferService({
    store: openTransferStore(':memory:', (r) => r.intent.account),
    chain: {
      prepare: async () => f.prepared,
      latestLedger: async () => 1001,
      enforce: async () => {},
      submit: async () => {
        submitted++;
        return { hash: 'cd'.repeat(32) };
      },
      lookup: async () => ({ state: 'confirmed', hash: 'cd'.repeat(32), ledger: 1002 }),
    },
    validate: validatePreparedFreeze,
    parseIntent: validateFreezeIntent,
    lockKey: (r) => r.intent.account,
  });
  const api = makeServer({ freezes: service });
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(0, '127.0.0.1', resolve);
  });
  const post = (path, body) =>
    fetch(`http://127.0.0.1:${api.address().port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (
        await post('/freeze/prepare', {
          publicKey: publicKeyHex,
          intent: { ...f.intent, action: 'reset' },
          binding: f.binding,
        })
      ).status,
      400,
    );
    const response = await post('/freeze/prepare', { publicKey: publicKeyHex, intent: f.intent, binding: f.binding });
    assert.equal(response.status, 200);
    const {
      prepared: { id },
    } = await response.json();
    assert.equal((await post('/freeze/submit', { id, signature: '00'.repeat(64) })).status, 401);
    assert.equal(submitted, 0);
    const signature = Buffer.from(f.signature).toString('hex');
    assert.equal((await (await post('/freeze/submit', { id, signature })).json()).state, 'pending');
    await post('/freeze/submit', { id, signature });
    assert.equal(submitted, 1);
    assert.equal((await (await post('/freeze/status', { id })).json()).state, 'confirmed');
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});

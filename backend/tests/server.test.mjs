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

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { makeServer } from '../src/server.mjs';

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

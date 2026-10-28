import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientAddress, createRequestLimiter } from '../src/request-limit.mjs';

const request = (peer, forwarded, url = '/challenge') => ({
  socket: { remoteAddress: peer },
  headers: { 'x-real-ip': forwarded },
  url,
});

test('forwarded addresses require explicit trust and a loopback peer', () => {
  assert.equal(clientAddress(request('127.0.0.1', '192.0.2.1')), '127.0.0.1');
  assert.equal(clientAddress(request('198.51.100.1', '192.0.2.1'), true), '198.51.100.1');
  assert.equal(clientAddress(request('127.0.0.1', '192.0.2.1'), true), '192.0.2.1');
  assert.equal(clientAddress(request('::1', '2001:db8::1'), true), '2001:db8::1');
  assert.equal(clientAddress(request('127.0.0.1', '192.0.2.1, 192.0.2.2'), true), '127.0.0.1');
});

test('proxy clients have independent limits; read queries cannot bypass limits; windows expire', () => {
  let time = 0;
  const limit = createRequestLimiter({ trustLoopbackProxy: true, now: () => time });
  const first = request('127.0.0.1', '192.0.2.1');
  for (let i = 0; i < 12; i++) assert.equal(limit(first), true);
  assert.equal(limit(first), false);
  assert.equal(limit(request('127.0.0.1', '192.0.2.2')), true);
  for (let i = 0; i < 60; i++) assert.equal(limit({ ...first, url: `/health?probe=${i}` }), true);
  assert.equal(limit({ ...first, url: '/health?probe=extra' }), false);
  time = 60_000;
  assert.equal(limit(first), true);
});

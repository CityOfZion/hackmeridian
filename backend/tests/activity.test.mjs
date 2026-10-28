import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Address, Contract, nativeToScVal } from '@stellar/stellar-sdk';
import { accountActivity, activityAssets, decodeActivity } from '../src/activity.mjs';

const [account, other, token] = [...activityAssets.keys()];
const event = (overrides = {}) => ({
  id: '0000000000000000001-0000000001',
  contractId: new Contract(token),
  type: 'contract',
  inSuccessfulContractCall: true,
  topic: [
    nativeToScVal('transfer', { type: 'symbol' }),
    Address.fromString(other).toScVal(),
    Address.fromString(account).toScVal(),
  ],
  value: nativeToScVal(1234567890123456789n, { type: 'i128' }),
  txHash: 'ab'.repeat(32),
  ledger: 100,
  ledgerClosedAt: '2026-10-28T00:00:00Z',
  ...overrides,
});
test('activity binds asset contract and address, and preserves exact integer precision', () => {
  const decoded = decodeActivity(event(), account);
  assert.equal(decoded.amount, '123456789012.3456789');
  assert.equal(decoded.asset, 'EURC');
  assert.equal(decoded.direction, 'received');
  assert.equal(decodeActivity(event(), token), null);
  assert.equal(decodeActivity(event({ inSuccessfulContractCall: false }), account), null);
  assert.equal(decodeActivity(event({ topic: [nativeToScVal('mint'), ...event().topic.slice(1)] }), account), null);
});
test('history declares retention, deduplicates and uses exclusive cursor pagination', async () => {
  const requests = [];
  const rpc = {
    getHealth: async () => ({ oldestLedger: 50, latestLedger: 100 }),
    getEvents: async (query) => {
      requests.push(query);
      return { events: [event(), event()], latestLedger: 100, cursor: '0000000000000000001-0000000001' };
    },
  };
  const page = await accountActivity(rpc, account);
  assert.equal(page.oldestLedger, 50);
  assert.equal(page.events.length, 1);
  assert.equal(page.hasMore, false);
  await accountActivity(rpc, account, page.cursor);
  assert.equal(requests[0].startLedger, 50);
  assert.equal(requests[1].startLedger, undefined);
  assert.equal(requests[1].cursor, page.cursor);
  assert.equal(requests[0].filters[0].contractIds.length, 3);
});
test('full pages report incomplete history; malformed cursors fail before network reads', async () => {
  const rpc = {
    getHealth: async () => ({ oldestLedger: 50, latestLedger: 100 }),
    getEvents: async () => ({
      events: Array.from({ length: 100 }, (_, i) => event({ id: String(i) })),
      cursor: '100-1',
      latestLedger: 100,
    }),
  };
  assert.equal((await accountActivity(rpc, account)).hasMore, true);
  await assert.rejects(accountActivity({}, account, 'https://bad.test'), /cursor/);
});

test('large histories are fetched in bounded contiguous windows and cursor pages cannot leak newer events', async () => {
  const requests = [];
  const rpc = {
    getHealth: async () => ({ oldestLedger: 1, latestLedger: 10000 }),
    getEvents: async (query) => {
      requests.push(query);
      return { events: [event({ ledger: 10000 })], cursor: '100-1', latestLedger: 10000 };
    },
  };
  const first = await accountActivity(rpc, account);
  assert.equal(first.startLedger, 8977);
  assert.equal(first.endLedger, 10001);
  const earlier = await accountActivity(rpc, account, undefined, first.startLedger);
  assert.equal(earlier.endLedger, first.startLedger);
  assert.equal(earlier.endLedger - earlier.startLedger, 1024);
  assert.equal(earlier.events.length, 0);
  await accountActivity(rpc, account, '100-1', first.startLedger);
  assert.equal(requests[2].startLedger, undefined);
  assert.equal(requests[2].endLedger, undefined);
  await assert.rejects(accountActivity(rpc, account, undefined, 10002), /retention/);
});

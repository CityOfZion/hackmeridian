import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTransferStorage } from '../src/wallet/transfer-storage.ts';
import { fixture, intent } from './transfer-fixture.mjs';

function setup() {
  const values = new Map();
  const { prepared } = fixture();
  const saved = { id: prepared.id, signature: 'ab'.repeat(64), intent };
  const record = { prepared, intent, state: 'pending' };
  const storage = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
  return { values, saved, record, storage, api: createTransferStorage(storage, async () => record) };
}
test('pending approvals stay with their account when another keychain is selected', async () => {
  const { api, saved } = setup();
  await api.save('account-one', saved);
  assert.equal(await api.load('account-two'), null);
  assert.deepEqual(await api.load('account-one'), saved);
  await api.clear('account-two');
  assert.deepEqual(await api.load('account-one'), saved);
});
test('legacy receipt moves only after the server identifies its original account', async () => {
  const { api, values, saved, record } = setup();
  await api.save('card-uid', saved);
  assert.equal(await api.load('another-account', 'card-uid'), null);
  assert.ok(values.has('item.transfer.card-uid'));
  assert.deepEqual(await api.load(record.prepared.account, 'card-uid'), saved);
  assert.ok(!values.has('item.transfer.card-uid'));
  assert.deepEqual(await api.load(record.prepared.account), saved);
});
test('lost status response or failed secure write cannot discard the legacy receipt', async () => {
  const { storage, saved, values, record } = setup();
  await storage.set('item.transfer.card-uid', JSON.stringify(saved));
  const offline = createTransferStorage(storage, async () => {
    throw new Error('offline');
  });
  await assert.rejects(offline.load(record.prepared.account, 'card-uid'), /offline/);
  const full = createTransferStorage(
    {
      ...storage,
      set: async () => {
        throw new Error('storage full');
      },
    },
    async () => record,
  );
  await assert.rejects(full.load(record.prepared.account, 'card-uid'), /storage full/);
  assert.ok(values.has('item.transfer.card-uid'));
});
test('malformed receipts and changed server intent fail closed', async () => {
  const { storage, saved, record, api } = setup();
  await assert.rejects(api.save('account', { ...saved, signature: 'bad' }));
  await api.save('card-uid', saved);
  const mismatch = createTransferStorage(storage, async () => ({ ...record, intent: { ...intent, amount: '100' } }));
  await assert.rejects(mismatch.load(record.prepared.account, 'card-uid'), /intent/);
});

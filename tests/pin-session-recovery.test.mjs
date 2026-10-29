import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPinSession } from '../src/api/item/pin-session.ts';
import { readPasswordSlots, recoverPinChange } from '../src/api/item/pin-recovery.ts';
import { reviewInterruptedAccount } from '../src/wallet/card-action-recovery.ts';
const profile = { identityId: 2, credentialIdentityId: 2, credentialSlot: 1 };

test('PIN cache is scoped to card and exact profile, expires, returns copies and cannot revive after locking', () => {
  let now = 0;
  const cache = createPinSession(() => now);
  const generation = cache.generation();
  cache.remember('card', { profile, password: '654321' }, generation);
  assert.equal(cache.read('other', profile), null);
  assert.equal(cache.read('card', { ...profile, credentialSlot: 0 }), null);
  const copy = cache.read('card', profile);
  copy.password = '';
  copy.profile.identityId = 7;
  assert.equal(cache.read('card', profile).password, '654321');
  now = 15 * 60 * 1000;
  assert.equal(cache.read('card', profile), null);
  cache.clear();
  cache.remember('card', { profile, password: '654321' }, generation);
  assert.equal(cache.read('card', profile), null);
});

test('PIN inventory only reads parameters; transport and unsupported statuses never become absent slots', async () => {
  const commands = [];
  const transport = {
    async transmit(cmd) {
      commands.push([...cmd]);
      const slot = cmd.at(-1);
      if (slot !== 1) return Uint8Array.of(0x6a, 0x83);
      const response = new Uint8Array(21);
      response[0] = 1;
      response[17] = 5;
      response[18] = 4;
      response[19] = 0x90;
      return response;
    },
  };
  assert.deepEqual(await readPasswordSlots(transport, 2, 2), [1]);
  assert.equal(commands.length, 4);
  assert.ok(commands.every((cmd) => cmd[1] === 0x25 && cmd[2] === 0));
  await assert.rejects(readPasswordSlots({ transmit: async () => Uint8Array.of(0x69, 0x85) }, 2, 2));
  await assert.rejects(
    readPasswordSlots(
      {
        transmit: async () => {
          throw new Error('tag lost');
        },
      },
      2,
      2,
    ),
  );
});

test('PIN-change recovery confirms removal using the new credential without another delete', async () => {
  const sent = [];
  const t = {
    info: { uid: 'card' },
    authenticatedIdentityId: 2,
    async tunnel(ins) {
      sent.push(ins);
      return Uint8Array.of(0, 2, 0, 0, 1, 1, 1);
    },
  };
  const credential = { mode: 'pin', profile, publicKey: 'aa', change: { stage: 'removing', oldSlot: 0, newSlot: 1 } };
  let saved;
  const recovered = await recoverPinChange(t, 'card', credential, [1], 1, async (c) => {
    saved = c;
  });
  assert.equal(recovered.change, undefined);
  assert.equal(saved.profile.credentialSlot, 1);
  assert.deepEqual(sent, [0x81]);
  await assert.rejects(recoverPinChange(t, 'wrong', credential, [1], 1, async () => {}));
});

test('account recovery finds one new keyring, distinguishes no write, and rejects ambiguous or missing inventory', () => {
  const raw = JSON.stringify({
    action: 'Create account',
    master: '1',
    existingRings: [0],
    existingMasterRings: [0],
    name: 'Savings',
  });
  const keys = {
    masters: [{ slot: 1, rings: [0, 1] }],
    rings: [
      { ring: 0, master: 1, publicKey: 'a' },
      { ring: 1, master: 1, publicKey: 'b' },
    ],
  };
  assert.equal(reviewInterruptedAccount(raw, keys).ring.ring, 1);
  assert.equal(reviewInterruptedAccount(raw, { ...keys, masters: [{ slot: 1, rings: [0] }] }).ring, undefined);
  assert.throws(() => reviewInterruptedAccount(raw, { ...keys, masters: [{ slot: 1, rings: [0, 1, 2] }] }));
  assert.throws(() => reviewInterruptedAccount(raw, { ...keys, masters: [{ slot: 1, rings: [1] }] }));
});

test('receipts from the previous APK can recover one newly found account, but cannot assume no write', () => {
  const raw = JSON.stringify({ action: 'Create account', master: '1', existingRings: [0] });
  const keys = {
    masters: [{ slot: 1, rings: [0, 1] }],
    rings: [
      { ring: 0, master: 1, publicKey: 'a' },
      { ring: 1, master: 1, publicKey: 'b' },
    ],
  };
  assert.equal(reviewInterruptedAccount(raw, keys).ring.ring, 1);
  assert.throws(() => reviewInterruptedAccount(raw, { ...keys, rings: keys.rings.slice(0, 1) }));
});

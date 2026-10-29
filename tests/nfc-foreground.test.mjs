import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foregroundReader } from '../src/api/nfc/foreground-reader.ts';
import { pinPromptDefaults } from '../src/api/item/pin-defaults.ts';

test('foreground registration is shared by startup and successive taps, including an already-present card', async () => {
  const calls = [];
  const reader = foregroundReader({
    register: async () => calls.push('register'),
    connectPresent: async () => calls.push('connect'),
    waitForCard: async () => calls.push('wait'),
  });
  await Promise.all([reader.ensure(), reader.ensure()]);
  assert.deepEqual(calls, ['register']); // Idle discovery cannot authenticate.
  await reader.connect(() => false);
  await reader.connect(() => false); // PIN dialog between exchanges retains the registration.
  assert.deepEqual(calls, ['register', 'connect', 'connect']);
});

test('a stale tag waits for a new tap; cancellation never starts another request', async () => {
  let waits = 0;
  let cancelled = false;
  const reader = foregroundReader({
    register: async () => {},
    connectPresent: async () => {
      throw new Error('tag removed');
    },
    waitForCard: async () => {
      waits++;
    },
  });
  await reader.connect(() => cancelled);
  assert.equal(waits, 1);
  cancelled = true;
  await assert.rejects(
    reader.connect(() => cancelled),
    /cancelled/,
  );
  assert.equal(waits, 1);
  const cancelledDuringConnect = foregroundReader({
    register: async () => {},
    connectPresent: async () => {
      cancelled = true;
      throw new Error('cancelled');
    },
    waitForCard: async () => {
      waits++;
    },
  });
  cancelled = false;
  await assert.rejects(cancelledDuringConnect.connect(() => cancelled));
  assert.equal(waits, 1);
});

test('failed registration can recover when NFC is enabled', async () => {
  let attempts = 0;
  const reader = foregroundReader({
    register: async () => {
      if (++attempts === 1) throw new Error('NFC off');
    },
    connectPresent: async () => {},
    waitForCard: async () => {},
  });
  await assert.rejects(reader.ensure());
  await reader.connect(() => false);
  assert.equal(attempts, 2);
});

test('bank and first-use holder defaults remain distinct; saved profiles and personal PINs take precedence', () => {
  assert.deepEqual(pinPromptDefaults({ defaults: 'issuer' }), {
    profile: { identityId: 1, credentialIdentityId: 1, credentialSlot: 0 },
    password: '000000',
  });
  assert.deepEqual(pinPromptDefaults({}), {
    profile: { identityId: 2, credentialIdentityId: 2, credentialSlot: 0 },
    password: '000000',
  });
  const profile = { identityId: 7, credentialIdentityId: 9, credentialSlot: 2 };
  assert.deepEqual(pinPromptDefaults({ profile }), { profile, password: '' });
  assert.deepEqual(pinPromptDefaults({ profile, defaults: 'initial-holder' }), { profile, password: '000000' });
  for (const defaults of [undefined, 'issuer', 'initial-holder']) {
    assert.equal(pinPromptDefaults({ profile, defaults, newPin: true }).password, '');
  }
});

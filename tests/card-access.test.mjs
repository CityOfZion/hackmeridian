import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseCardCredential,
  pinProfile,
  authenticationMode,
  pinAttemptTransport,
  validCardPin,
  DEFAULT_PIN_LENGTH,
} from '../src/api/item/card-auth.ts';
import { journalCardMutations, cardActionTimestamp } from '../src/api/item/card-operation.ts';
import { newAccountPath } from '../src/api/item/account-path.ts';
import { DEFAULT_FACTORY_PAIRING_KEY } from '../src/api/item/issuer-bootstrap.ts';
const profile = { identityId: 17, credentialIdentityId: 17, credentialSlot: 1 };

test('six-character default PIN accepts numbers and letters; incomplete PINs are rejected', () => {
  assert.equal(DEFAULT_PIN_LENGTH, 6);
  for (const value of ['123456', 'aB3!xZ']) assert.equal(validCardPin(value), true);
  for (const value of ['12345', '1234567890123', '12345\n']) assert.equal(validCardPin(value), false);
});
test('public credential serialization excludes secrets and never downgrades a cardholder PIN', () => {
  const saved = parseCardCredential({
    mode: 'pin',
    profile,
    publicKey: 'aa'.repeat(65),
    password: '123456',
    pairingKey: DEFAULT_FACTORY_PAIRING_KEY,
  });
  assert.equal('password' in saved, false);
  assert.equal('pairingKey' in saved, false);
  assert.throws(() => authenticationMode({ paired: true }, saved, 'pairing'));
  assert.equal(authenticationMode({}, saved), 'pin');
  assert.throws(() => pinProfile(null));
});
test('bundled factory key requires explicit bank pairing and cannot reopen retired pairing', () => {
  assert.match(DEFAULT_FACTORY_PAIRING_KEY, /^[0-9a-f]{64}$/);
  const saved = { mode: 'pin', profile, publicKey: 'aa'.repeat(65) };
  assert.equal(authenticationMode({ paired: true }, saved, 'pairing', true), 'pairing');
  assert.throws(() => authenticationMode({ paired: false }, saved, 'pairing', true));
  assert.throws(() => authenticationMode({ paired: true }, saved, 'pin', true));
  assert.throws(() => authenticationMode({ paired: true }, saved, undefined, true));
});
test('PIN attempt tracking retains no payload and does not refund an uncertain attempt', async () => {
  const wrapped = pinAttemptTransport({
    connect: async () => true,
    disconnect: async () => {},
    transmit: async () => Uint8Array.of(0x69, 0x82),
  });
  await wrapped.transport.transmit(Uint8Array.of(0xa0, 0x25, 1, 0, 1, 99));
  assert.equal(wrapped.state.began, true);
  assert.equal(wrapped.state.confirmed, false);
  assert.deepEqual(Object.keys(wrapped.state).sort(), ['began', 'confirmed', 'limit', 'remaining']);
});
test('random account paths have a fixed Stellar namespace and four independently hardened components', () => {
  const source = Uint8Array.from({ length: 16 }, (_, i) => i);
  const path = newAccountPath(source),
    view = new DataView(path.buffer);
  assert.equal(path.length, 24);
  assert.equal(view.getUint32(0), 0x8000002c);
  assert.equal(view.getUint32(4), 0x80000094);
  for (let i = 0; i < 4; i++) assert.ok(view.getUint32(8 + i * 4) >= 0x80000000);
  const other = source.slice();
  other[15] ^= 1;
  assert.notDeepEqual(newAccountPath(other), path);
  assert.throws(() => newAccountPath(new Uint8Array(15)));
});
test('creation is journaled before its APDU; failed storage and malformed recovery data fail closed', async () => {
  const events = [];
  const tunnel = {
    tunnel: async (ins) => {
      events.push(ins);
      return new Uint8Array();
    },
  };
  const guarded = journalCardMutations(tunnel, async () => events.push('saved'));
  await guarded.tunnel(0x15);
  await guarded.tunnel(0x13, 2, 1, newAccountPath(new Uint8Array(16)));
  assert.deepEqual(events, [0x15, 'saved', 0x13]);
  const broken = journalCardMutations(tunnel, async () => {
    throw new Error('storage full');
  });
  await assert.rejects(broken.tunnel(0x13));
  assert.equal(events.length, 3);
  assert.equal(cardActionTimestamp('{'), Infinity);
  assert.equal(cardActionTimestamp('{"at":"invalid"}'), Infinity);
});

test('configured-card account creation discovers P-256, derives once through SDK and checks its returned ring', async () => {
  const { deriveAccount } = await import('../src/api/item/card-management.ts');
  const { publicKey } = await import('./transfer-fixture.mjs');
  const sent = [];
  const channel = {
    tunnel: async (ins, p1, p2, data) => {
      sent.push({ ins, p1, p2, data });
      if (ins === 0x81) return Uint8Array.of(0, 17, 0, 0, 1, 1, 1);
      if (ins === 0x15) return Uint8Array.of(1, 1, 0, 2, 0, 17, 0, 17, 1, 192, 0, 0, 0, 0, 0);
      if (ins === 0x51) {
        const out = new Uint8Array(17);
        if (p1 === 2) {
          out[0] = 1;
          out[1] = 2;
          out[4] = 2;
        }
        return out;
      }
      if (ins === 0x13 || ins === 0x14) return publicKey;
      if (ins === 0x16) return Uint8Array.of(0, 10, 0, 2, 2, 1, 1, 0, 1, 0, 0, 3, 0, 0);
      throw new Error('Unexpected SDK operation');
    },
  };
  const path = newAccountPath(new Uint8Array(16));
  const result = await deriveAccount(channel, 1, path, 2);
  assert.equal(result.ring, 0);
  assert.equal(result.publicKey, Buffer.from(publicKey).toString('hex'));
  const derive = sent.filter((s) => s.ins === 0x13);
  assert.equal(derive.length, 1);
  assert.equal(derive[0].p1, 2);
  assert.equal(derive[0].p2, 1);
  assert.deepEqual(derive[0].data, path);
  sent.length = 0;
  await assert.rejects(deriveAccount(channel, 0, path, 2));
  assert.equal(
    sent.some((s) => s.ins === 0x13),
    false,
  );
});
test('PIN rotation proves the new slot before old-slot removal and persists uncertainty before a lost response', async () => {
  const { verifyNewPin, removeOldPin } = await import('../src/api/item/pin-change.ts');
  const credential = {
    mode: 'pin',
    publicKey: 'aa'.repeat(65),
    profile: { ...profile, credentialSlot: 0 },
    change: { stage: 'verify', oldSlot: 0, newSlot: 1 },
  };
  let saved;
  const channel = {
    authenticatedIdentityId: 17,
    tunnel: async () => {
      throw new Error('lost link');
    },
  };
  await assert.rejects(verifyNewPin(channel, credential, { ...profile, credentialSlot: 0 }, async (c) => (saved = c)));
  assert.equal(saved, undefined);
  await verifyNewPin(channel, credential, profile, async (c) => (saved = c));
  assert.equal(saved.profile.credentialSlot, 1);
  assert.equal(saved.change.stage, 'remove');
  await assert.rejects(removeOldPin(channel, saved, profile, async (c) => (saved = c)));
  assert.equal(saved.change.stage, 'removing');
  assert.equal(saved.profile.credentialSlot, 1);
  await assert.rejects(
    removeOldPin(channel, saved, profile, async () => assert.fail('Do not replay an unknown deletion')),
  );
});

test('bank verification accepts a full HTTPS URL and preserves the card NDEF wire format', async () => {
  const { setBankUri } = await import('../src/api/item/card-management.ts');
  const writes = [];
  const tunnel = {
    async tunnel(ins, p1, p2, data) {
      assert.equal(ins, 0x16);
      writes.push(new TextDecoder().decode(data));
      return new Uint8Array();
    },
  };
  await setBankUri(tunnel, 'https://coz.io');
  await setBankUri(tunnel, 'coz.io/verify/?d=');
  assert.deepEqual(writes, ['coz.io/?d=', 'coz.io/verify/?d=']);
  for (const invalid of [
    'http://coz.io',
    'https://coz.io/#other',
    'https://coz.io/?redirect=other',
    `https://coz.io/${'a'.repeat(100)}`,
  ])
    await assert.rejects(setBankUri(tunnel, invalid));
  assert.equal(writes.length, 2);
});

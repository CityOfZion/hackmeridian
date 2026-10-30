import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardEntryIntent, entryPinProfile, entryAccount } from '../src/wallet/card-entry.ts';
import { inspectUserCard } from '../src/api/item/card-onboarding.ts';
import { parseIssuance } from '../src/api/item/card-issuance.ts';
const profile = { identityId: 2, credentialIdentityId: 2, credentialSlot: 1 };
const credential = { mode: 'pin', profile, publicKey: 'aa'.repeat(65) };

test('entry routes interrupted setup and PIN changes before any remembered wallet', () => {
  for (const phase of ['verify-holder', 'personal-pin-unknown', 'remove-default-unknown'])
    assert.equal(cardEntryIntent({ phase }, credential, null), 'setup');
  assert.equal(
    cardEntryIntent({ phase: 'complete' }, { ...credential, change: { stage: 'removing' } }, null),
    'pin-recovery',
  );
  assert.equal(cardEntryIntent(null, credential, '{bad journal'), 'setup');
  assert.equal(cardEntryIntent({ phase: 'complete' }, credential, null), 'inspect');
  assert.equal(cardEntryIntent(null, null, null), 'inspect');
  assert.equal(cardEntryIntent(null, { mode: 'pairing' }, null), 'legacy');
});
test('entry uses the recorded profile or one candidate slot, never guesses multiple personal slots', () => {
  assert.deepEqual(entryPinProfile({ phase: 'complete', holder: 7, personalSlot: 3 }, credential, [0]), {
    identityId: 7,
    credentialIdentityId: 7,
    credentialSlot: 3,
  });
  assert.deepEqual(entryPinProfile(null, credential, [0]), profile);
  assert.equal(entryPinProfile(null, null, [0, 1]).credentialSlot, 0);
  assert.equal(entryPinProfile(null, null, [2]).credentialSlot, 2);
  for (const slots of [[], [1, 2]]) assert.throws(() => entryPinProfile(null, null, slots));
});
test('entry chooses only this card and verified key; multiple accounts without a match require selection', () => {
  const rings = [
    { ring: 0, master: 1, publicKey: 'a' },
    { ring: 1, master: 1, publicKey: 'b' },
  ];
  assert.equal(entryAccount('card', rings), undefined);
  assert.equal(entryAccount('card', rings, { cardUid: 'other', ring: 0, publicKey: 'a' }), undefined);
  assert.equal(entryAccount('card', rings, { cardUid: 'card', ring: 1, publicKey: 'b' }), rings[1]);
  assert.throws(() => entryAccount('card', rings, { cardUid: 'card', ring: 1, publicKey: 'changed' }));
  assert.equal(entryAccount('card', rings.slice(0, 1)), rings[0]);
});
function card({ count = 1, caps = 0, mode = 0o700, owner = 2, masters = 1, rings = [] } = {}) {
  const commands = [];
  const t = {
    info: { uid: 'card' },
    authenticatedIdentityId: 2,
    async tunnel(ins, p1, p2) {
      commands.push(ins);
      if (ins === 0x81) return Uint8Array.of(0, 2, 0, caps, 1, 1, count);
      if (ins === 0x15)
        return Uint8Array.from([
          masters,
          ...Array.from({ length: masters }, (_, i) => [
            i + 1,
            0,
            2,
            0,
            owner,
            0,
            255,
            mode >> 8,
            mode & 255,
            rings.length,
            1,
            0,
            0,
            0,
            ...rings,
          ]).flat(),
        ]);
      if (ins === 0x51) {
        const e = new Uint8Array(17);
        if (p1 === 2) {
          e[0] = 1;
          e[1] = 2;
          e[4] = 2;
        }
        return e;
      }
      if (ins === 0x70) return Uint8Array.of(1, p2, 0, owner, 0, 255, mode >> 8, mode & 255);
      throw new Error('Unexpected command, no mutation permitted: ' + ins);
    },
  };
  return { t, commands };
}
test('new phone reconstructs a standard bank handoff only from authenticated ownership; no card writes', async () => {
  const c = card();
  const result = await inspectUserCard(c.t, 'card', { ...profile, credentialSlot: 0 }, [0], true);
  assert.equal(result.record.phase, 'personal-pin-ready');
  assert.equal(result.record.holder, 2);
  assert.equal(result.record.master, 1);
  assert.deepEqual(parseIssuance(JSON.stringify(result.record), 'card'), result.record);
  assert.ok(c.commands.every((ins) => [0x81, 0x15, 0x51, 0x70].includes(ins)));
  const interrupted = await inspectUserCard(
    card({ count: 2 }).t,
    'card',
    { ...profile, credentialSlot: 0 },
    [0, 1],
    true,
  );
  assert.equal(interrupted.record.phase, 'personal-pin-unknown');
});
test('ready card inspection does not manufacture an issuance receipt or reset personal credentials', async () => {
  const result = await inspectUserCard(card().t, 'card', profile, [1], false);
  assert.equal(result.record, null);
  assert.equal(result.keys.masters.length, 1);
});
test('entry fails closed on wrong card, concealed credentials, issuer access and ambiguous handoff', async () => {
  await assert.rejects(inspectUserCard(card().t, 'other', profile, [1], false));
  await assert.rejects(inspectUserCard(card({ count: 2 }).t, 'card', profile, [1], false));
  await assert.rejects(inspectUserCard(card({ caps: 1 }).t, 'card', profile, [1], false));
  await assert.rejects(inspectUserCard(card({ count: 2 }).t, 'card', profile, [0, 1], false));
  for (const options of [{ mode: 0o777 }, { owner: 1 }, { masters: 2 }, { masters: 0 }])
    await assert.rejects(inspectUserCard(card(options).t, 'card', { ...profile, credentialSlot: 0 }, [0], true));
});

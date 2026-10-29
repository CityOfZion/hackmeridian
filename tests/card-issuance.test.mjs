import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { CardError } from '@item-systems/item/mobile';
import {
  startIssuance,
  advanceIssuance,
  inspectIssuance,
  verifyIssuance,
  choosePersonalPin,
  verifyPersonalPin,
  removeDefaultPin,
  parseIssuance,
  issuanceBlocksChanges,
} from '../src/api/item/card-issuance.ts';

const uid = '65a819c4eeb2fbdf612323b6da03f093';
const bytes = (...items) => Uint8Array.from(items.flat());
const word = (n) => [n >> 8, n & 255];
function card() {
  const identities = new Map([[1, { caps: 0xffff, credentials: [] }]]);
  const masters = [];
  const sent = [];
  const saved = [];
  let receipt;
  let fault;
  let actor = 1;
  const tunnel = {
    info: { uid, masterSlots: 3, tunnelProfile: { agreement: 2 } },
    get authenticatedIdentityId() {
      return actor;
    },
    async tunnel(ins, p1 = 0, p2 = 0, data = new Uint8Array()) {
      sent.push({ ins, p1, p2 }); // Never log secret command payloads.
      let reply;
      if (ins === 0x81) {
        const id = p1 === 255 && p2 === 255 ? actor : p1 * 256 + p2;
        const i = identities.get(id);
        if (!i) throw new CardError(0x6a83);
        return bytes(word(id), word(i.caps), 1, 1, i.credentials.filter(Boolean).length);
      }
      if (ins === 0x15)
        return bytes(
          masters.length,
          ...masters.map((m) => [
            m.slot,
            Number(m.anchor),
            1,
            ...word(m.owner),
            ...word(m.group),
            ...word(m.mode),
            0,
            1,
            0,
            0,
            0,
          ]),
        );
      if (ins === 0x51) {
        const d = new Uint8Array(19);
        if (p1 === 0) {
          d[0] = 1;
          d[1] = 2;
          d[2] = 1;
          d[4] = 2;
        }
        return d;
      }
      if (ins === 0x80) {
        const id = data[0] * 256 + data[1];
        assert.equal(identities.has(id), false);
        identities.set(id, { caps: data[2] * 256 + data[3], credentials: [] });
        reply = bytes();
      } else if (ins === 0x84) {
        const i = identities.get(p1 * 256 + p2);
        assert.equal(data[0], 5); // Published SDK password enrollment, not an app-defined protocol.
        const slot = i.credentials.length;
        i.credentials.push(data.slice());
        reply = bytes(slot);
      } else if (ins === 0x17) {
        const slot = masters.length;
        masters.push({ slot, anchor: slot === 0, owner: actor, group: 255, mode: 0o700 });
        reply = bytes(slot);
      } else if (ins === 0x72) {
        assert.equal(p1, 1);
        const m = masters[p2];
        assert.equal(m.owner, actor);
        m.owner = data[0] * 256 + data[1];
        m.group = data[2] * 256 + data[3];
        reply = bytes();
      } else if (ins === 0x70) {
        const m = masters[p2];
        assert.equal(m.owner, actor);
        return bytes(1, p2, word(m.owner), word(m.group), word(m.mode));
      } else if (ins === 0x85) {
        const i = identities.get(p1 * 256 + p2);
        assert.equal(actor, p1 * 256 + p2);
        assert.ok(i.credentials[data[0]]);
        i.credentials[data[0]] = null;
        reply = bytes();
      } else throw new Error(`Unexpected SDK command ${ins.toString(16)}`);
      if (fault === ins) {
        fault = undefined;
        throw new Error('Acknowledgement lost');
      }
      return reply;
    },
  };
  const save = async (r) => {
    receipt = structuredClone(r);
    saved.push(structuredClone(r));
  };
  return {
    tunnel,
    identities,
    masters,
    sent,
    saved,
    save,
    get receipt() {
      return receipt;
    },
    as: (n) => {
      actor = n;
    },
    failAfter: (ins) => {
      fault = ins;
    },
  };
}
async function prepared(c) {
  let r = await startIssuance(c.tunnel, uid, 2, c.save);
  while (['credential-ready', 'reserve-ready', 'master-ready'].includes(r.phase))
    r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  return r;
}
const mutations = (c) => c.sent.filter((s) => [0x80, 0x84, 0x17, 0x72, 0x85].includes(s.ins));

test('bank creates an unprivileged identity, initial PIN, separate master, and transfers owner-only access', async () => {
  const c = card();
  let r = await prepared(c);
  assert.equal(c.identities.get(2).caps, 0);
  assert.equal(c.identities.get(2).credentials.length, 1);
  const enrollment = c.identities.get(2).credentials[0];
  const { passwordScalar } = await import('../node_modules/@item-systems/item/dist/esm/smartcard/mobile/password.js');
  const expected = await passwordScalar('000000', enrollment.slice(2, 18), uid, 2);
  assert.deepEqual(enrollment.slice(18, 50), expected);
  assert.equal(enrollment[50], 5);
  expected.fill(0);
  assert.equal(r.phase, 'transfer-ready');
  assert.equal(r.reserve, 0);
  assert.equal(r.master, 1);
  assert.equal(c.masters[0].anchor, true);
  assert.equal(c.masters[1].anchor, false);
  assert.equal(c.masters[1].owner, 1);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  assert.equal(r.phase, 'verify-holder');
  assert.deepEqual(c.masters[1], { slot: 1, anchor: false, owner: 2, group: 255, mode: 0o700 });
  await assert.rejects(verifyIssuance(c.tunnel, r, c.save), /cardholder PIN/);
  c.as(2);
  r = await verifyIssuance(c.tunnel, r, c.save);
  assert.equal(r.phase, 'personal-pin-ready');
  assert.equal(issuanceBlocksChanges(JSON.stringify(r), uid), true);
  assert.equal(
    mutations(c).some((s) => [0x23, 0x12].includes(s.ins)),
    false,
  );
  for (const saved of c.saved) {
    assert.doesNotMatch(JSON.stringify(saved), /000000|password|seed|pairingKey/);
    assert.equal(parseIssuance(JSON.stringify(saved), uid).phase, saved.phase);
  }
});

test('activation proves the personal PIN before removing the default; wrong sessions and same PIN are rejected', async () => {
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  c.as(2);
  r = await verifyIssuance(c.tunnel, r, c.save);
  const before = mutations(c).length;
  await assert.rejects(choosePersonalPin(c.tunnel, r, 0, '000000', randomBytes, c.save));
  await assert.rejects(choosePersonalPin(c.tunnel, r, 1, '123456', randomBytes, c.save));
  assert.equal(mutations(c).length, before);
  r = await choosePersonalPin(c.tunnel, r, 0, '123456', randomBytes, c.save);
  assert.equal(r.personalSlot, 1);
  await assert.rejects(removeDefaultPin(c.tunnel, r, 1, c.save));
  await assert.rejects(verifyPersonalPin(c.tunnel, r, 0, c.save));
  r = await verifyPersonalPin(c.tunnel, r, 1, c.save);
  r = await removeDefaultPin(c.tunnel, r, 1, c.save);
  assert.equal(r.phase, 'complete');
  assert.equal(c.identities.get(2).credentials[0], null);
  assert.ok(c.identities.get(2).credentials[1]);
  assert.equal(issuanceBlocksChanges(JSON.stringify(r), uid), false);
});

test('wrong card, existing recipient, same recipient, missing issuer capabilities, and insufficient capacity fail before writes', async () => {
  for (const scenario of ['uid', 'existing', 'same', 'capability', 'capacity', 'provider']) {
    const c = card();
    if (scenario === 'uid') c.tunnel.info.uid = 'another';
    if (scenario === 'existing') c.identities.set(2, { caps: 0, credentials: [] });
    if (scenario === 'capability') c.identities.get(1).caps = 1;
    if (scenario === 'capacity') c.tunnel.info.masterSlots = 1;
    if (scenario === 'provider') c.tunnel.info.tunnelProfile.agreement = 5;
    await assert.rejects(startIssuance(c.tunnel, uid, scenario === 'same' ? 1 : 2, c.save));
    assert.equal(mutations(c).length, 0, scenario);
    assert.equal(c.saved.length, 0, scenario);
  }
});

test('storage failure prevents identity creation; lost identity acknowledgement is inspected without another create', async () => {
  const c = card();
  await assert.rejects(
    startIssuance(c.tunnel, uid, 2, async () => {
      throw new Error('storage full');
    }),
  );
  assert.equal(mutations(c).length, 0);
  c.failAfter(0x80);
  await assert.rejects(startIssuance(c.tunnel, uid, 2, c.save));
  assert.equal(c.receipt.phase, 'identity-unknown');
  const r = await inspectIssuance(c.tunnel, c.receipt, c.save);
  assert.equal(r.phase, 'credential-ready');
  assert.equal(mutations(c).filter((s) => s.ins === 0x80).length, 1);
});

test('lost PIN enrollment acknowledgement stays blocked without guessing a credential or retrying', async () => {
  const c = card();
  const r = await startIssuance(c.tunnel, uid, 2, c.save);
  c.failAfter(0x84);
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  assert.equal(c.receipt.phase, 'credential-unknown');
  await assert.rejects(inspectIssuance(c.tunnel, c.receipt, c.save), /unknown outcome/);
  await assert.rejects(advanceIssuance(c.tunnel, c.receipt, c.save, randomBytes));
  assert.equal(mutations(c).filter((s) => s.ins === 0x84).length, 1);
});

test('lost generation and transfer acknowledgements reconcile from card state without replay', async () => {
  const c = card();
  let r = await startIssuance(c.tunnel, uid, 2, c.save);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  c.failAfter(0x17);
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  assert.equal(c.receipt.phase, 'reserve-unknown');
  await assert.rejects(advanceIssuance(c.tunnel, c.receipt, c.save, randomBytes));
  r = await inspectIssuance(c.tunnel, c.receipt, c.save);
  c.failAfter(0x17);
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  r = await inspectIssuance(c.tunnel, c.receipt, c.save);
  assert.equal(r.master, 1);
  c.failAfter(0x72);
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  r = await inspectIssuance(c.tunnel, c.receipt, c.save);
  assert.equal(r.phase, 'verify-holder');
  assert.equal(mutations(c).filter((s) => s.ins === 0x17).length, 2);
  assert.equal(mutations(c).filter((s) => s.ins === 0x72).length, 1);
});

test('ambiguous generation and invalid receipts stay blocked', async () => {
  const c = card();
  let r = await startIssuance(c.tunnel, uid, 2, c.save);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  await assert.rejects(inspectIssuance(c.tunnel, { ...r, phase: 'reserve-unknown' }, c.save));
  assert.throws(() => parseIssuance('{', uid));
  assert.throws(() => parseIssuance(JSON.stringify({ ...r, uid: 'wrong' }), uid));
  assert.throws(() => parseIssuance(JSON.stringify({ ...r, phase: 'complete' }), uid));
});

test('public activation handoff cannot skip activation, cross cards, or include secrets', async () => {
  const { activationHandoff } = await import('../src/api/item/card-issuance.ts');
  const c = card();
  let r = await prepared(c);
  assert.throws(() => activationHandoff(JSON.stringify(r), uid));
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  assert.equal(activationHandoff(JSON.stringify(r), uid).holder, 2);
  assert.throws(() => activationHandoff(JSON.stringify(r), 'another-card'));
  assert.throws(() => activationHandoff(JSON.stringify({ ...r, password: '000000' }), uid));
  assert.throws(() => activationHandoff(JSON.stringify({ ...r, phase: 'complete' }), uid));
});

test('lost default-PIN removal remains blocked and preserves the new credential', async () => {
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  c.as(2);
  r = await verifyIssuance(c.tunnel, r, c.save);
  r = await choosePersonalPin(c.tunnel, r, 0, '654321', randomBytes, c.save);
  r = await verifyPersonalPin(c.tunnel, r, 1, c.save);
  c.failAfter(0x85);
  await assert.rejects(removeDefaultPin(c.tunnel, r, 1, c.save));
  assert.equal(c.receipt.phase, 'remove-default-unknown');
  assert.ok(c.identities.get(2).credentials[1]);
  await assert.rejects(removeDefaultPin(c.tunnel, c.receipt, 1, c.save));
  assert.equal(mutations(c).filter((s) => s.ins === 0x85).length, 1);
});

test('existing tunnel master is preserved; unsafe permissions and changed recipient prevent transfer', async () => {
  const c = card();
  c.masters.push({ slot: 0, anchor: true, owner: 1, group: 255, mode: 0o700 });
  let r = await prepared(c);
  assert.equal(c.masters.length, 2);
  assert.equal(mutations(c).filter((s) => s.ins === 0x17).length, 1);
  c.masters[1].mode = 0o777;
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  c.masters[1].mode = 0o700;
  c.identities.get(2).caps = 0xffff;
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  c.identities.get(2).caps = 0;
  c.identities.get(2).credentials = [];
  await assert.rejects(advanceIssuance(c.tunnel, r, c.save, randomBytes));
  assert.equal(mutations(c).filter((s) => s.ins === 0x72).length, 0);
});

test('single setup approval enrolls once, verifies in a fresh session and removes the initial PIN', async () => {
  const { completePinSetup } = await import('../src/api/item/complete-pin-setup.ts');
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  const logins = [];
  const done = await completePinSetup(
    r,
    '000000',
    '654321',
    async (pin, work) => {
      logins.push(pin.profile.credentialSlot);
      assert.equal(pin.password, logins.length === 1 ? '000000' : '654321');
      c.as(2);
      await work(c.tunnel);
      return true;
    },
    randomBytes,
    c.save,
  );
  assert.deepEqual(logins, [0, 1]);
  assert.equal(done.record.phase, 'complete');
  assert.equal(done.profile.credentialSlot, 1);
  assert.equal(mutations(c).filter((s) => s.ins === 0x85).length, 1);
});

test('failed new-PIN authentication never removes the initial PIN; resume never re-enrolls', async () => {
  const { completePinSetup } = await import('../src/api/item/complete-pin-setup.ts');
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  let attempts = 0;
  await assert.rejects(
    completePinSetup(
      r,
      '000000',
      '654321',
      async (pin, work) => {
        attempts++;
        c.as(2);
        if (pin.profile.credentialSlot === 1) throw new Error('authentication failed');
        await work(c.tunnel);
        return true;
      },
      randomBytes,
      c.save,
    ),
  );
  assert.equal(attempts, 2);
  assert.equal(c.receipt.phase, 'verify-personal-pin');
  assert.ok(c.identities.get(2).credentials[0]);
  const enrolled = mutations(c).filter((s) => s.ins === 0x84).length;
  const done = await completePinSetup(
    c.receipt,
    '',
    '654321',
    async (_pin, work) => {
      await work(c.tunnel);
      return true;
    },
    randomBytes,
    c.save,
  );
  assert.equal(done.record.phase, 'complete');
  assert.equal(mutations(c).filter((s) => s.ins === 0x84).length, enrolled);
});

test('lost personal enrollment and deletion receipts recover by inspection without repeating either write', async () => {
  const { recoverPinSetup } = await import('../src/api/item/pin-recovery.ts');
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  c.as(2);
  r = await verifyIssuance(c.tunnel, r, c.save);
  c.failAfter(0x84);
  await assert.rejects(choosePersonalPin(c.tunnel, r, 0, '654321', randomBytes, c.save));
  assert.equal(c.receipt.phase, 'personal-pin-unknown');
  const before = mutations(c).length;
  r = await recoverPinSetup(c.tunnel, c.receipt, [0, 1], 0, c.save);
  assert.equal(r.phase, 'verify-personal-pin');
  assert.equal(r.personalSlot, 1);
  assert.equal(mutations(c).length, before);
  r = await verifyPersonalPin(c.tunnel, r, 1, c.save);
  c.failAfter(0x85);
  await assert.rejects(removeDefaultPin(c.tunnel, r, 1, c.save));
  r = await recoverPinSetup(c.tunnel, c.receipt, [1], 1, c.save);
  assert.equal(r.phase, 'complete');
  assert.equal(mutations(c).filter((s) => s.ins === 0x85).length, 1);
});

test('recovery handles a write that never reached the card, and rejects conflicting inventory', async () => {
  const { recoverPinSetup } = await import('../src/api/item/pin-recovery.ts');
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  c.as(2);
  r = await verifyIssuance(c.tunnel, r, c.save);
  const pending = { ...r, phase: 'personal-pin-unknown' };
  await assert.rejects(recoverPinSetup(c.tunnel, pending, [0, 1], 0, c.save));
  const before = mutations(c).length;
  r = await recoverPinSetup(c.tunnel, pending, [0], 0, c.save);
  assert.equal(r.phase, 'personal-pin-ready');
  assert.equal(mutations(c).length, before);
  c.as(1);
  await assert.rejects(recoverPinSetup(c.tunnel, pending, [0], 0, c.save));
});

test('cancelling the first PIN setup session never starts a second authentication', async () => {
  const { completePinSetup } = await import('../src/api/item/complete-pin-setup.ts');
  const c = card();
  let r = await prepared(c);
  r = await advanceIssuance(c.tunnel, r, c.save, randomBytes);
  let sessions = 0;
  const before = mutations(c).length;
  const done = await completePinSetup(
    r,
    '000000',
    '654321',
    async () => {
      sessions++;
      return false;
    },
    randomBytes,
    c.save,
  );
  assert.equal(done, null);
  assert.equal(sessions, 1);
  assert.equal(mutations(c).length, before);
});

import {
  apdu,
  response,
  CardError,
  MicrokernelClient,
  type CardTransport,
  type ItemSecureTunnel,
} from '@item-systems/item/mobile';
import type { Issuance } from './card-issuance';

/** Read the published password-exchange PARAMS operation. Never sends BEGIN or CONFIRM.
 * Only missing-record statuses mean absent; locked/unsupported/transport errors remain errors.
 * Public inventory is advisory until checked in a fresh authenticated holder session.
 */
export async function readPasswordSlots(transport: CardTransport, identity: number, agreement: number) {
  if (!Number.isInteger(identity) || identity < 1 || identity > 127 || ![1, 2].includes(agreement))
    throw new Error('Unsupported card PIN profile.');
  const slots: number[] = [];
  for (let slot = 0; slot < 4; slot++) {
    const subject = Uint8Array.of(1, 0, identity, 0, identity, slot);
    try {
      const data = response(await transport.transmit(apdu(0xa0, 0x25, 0, 0, subject)));
      // SDK agreement 2 is P-256 (password suite 1); agreement 1 is K1 (suite 2).
      if (
        data.length !== 19 ||
        data[0] !== (agreement === 2 ? 1 : 2) ||
        data[17] < 1 ||
        data[17] > 10 ||
        data[18] > data[17]
      )
        throw new Error('Unsupported card PIN inventory.');
      slots.push(slot);
    } catch (e) {
      if (!(e instanceof CardError && [0x6a83, 0x6a88].includes(e.status))) throw e;
    }
  }
  return slots;
}

/** Reconcile a lost enrollment/deletion receipt without replaying the write. */
export async function recoverPinSetup(
  t: ItemSecureTunnel,
  r: Issuance,
  slots: number[],
  usedSlot: number,
  save: (next: Issuance) => Promise<void>,
) {
  const actor = await new MicrokernelClient(t).uac.current();
  if (
    t.info?.uid !== r.uid ||
    t.authenticatedIdentityId !== r.holder ||
    actor.uid !== r.holder ||
    actor.capabilities !== 0 ||
    actor.policy !== 1 ||
    actor.threshold !== 1 ||
    actor.credentialCount !== slots.length ||
    new Set(slots).size !== slots.length ||
    slots.some((s) => !Number.isInteger(s) || s < 0 || s > 3) ||
    !slots.includes(usedSlot)
  )
    throw new Error('Card credentials changed. Recovery needs inspection.');
  let next: Issuance;
  if (r.phase === 'personal-pin-unknown' && usedSlot === r.credentialSlot) {
    const added = slots.filter((s) => s !== r.credentialSlot);
    if (added.length > 1) throw new Error('More than one new credential exists. Recovery needs inspection.');
    next = added.length
      ? { ...r, personalSlot: added[0], phase: 'verify-personal-pin' }
      : { ...r, phase: 'personal-pin-ready' };
  } else if (
    r.phase === 'remove-default-unknown' &&
    usedSlot === r.personalSlot &&
    r.personalSlot !== undefined &&
    slots.every((s) => s === r.credentialSlot || s === r.personalSlot)
  ) {
    next = { ...r, phase: slots.includes(r.credentialSlot!) ? 'remove-default-pin' : 'complete' };
  } else throw new Error('This setup cannot be recovered with that PIN.');
  await save(next);
  return next;
}

export async function recoverPinChange(
  t: ItemSecureTunnel,
  uid: string,
  credential: import('./pin-change').PinCredential,
  slots: number[],
  usedSlot: number,
  save: (next: import('./pin-change').PinCredential) => Promise<void>,
) {
  const { change, ...clean } = credential;
  const owner = credential.profile.credentialIdentityId;
  const actor = await new MicrokernelClient(t).uac.current();
  if (
    t.info?.uid !== uid ||
    t.authenticatedIdentityId !== owner ||
    actor.uid !== owner ||
    actor.credentialCount !== slots.length ||
    new Set(slots).size !== slots.length ||
    slots.some((s) => !Number.isInteger(s) || s < 0 || s > 3) ||
    !slots.includes(usedSlot)
  )
    throw new Error('Card credentials changed. Recovery needs inspection.');
  let next = credential;
  if (change?.stage === 'enrolling' && usedSlot === change.oldSlot) {
    const added = slots.filter((s) => s !== change.oldSlot);
    if (added.length > 1) throw new Error('Multiple credentials exist. PIN recovery needs inspection.');
    next = added.length ? { ...credential, change: { ...change, newSlot: added[0], stage: 'verify' } } : clean;
  } else if (
    change?.stage === 'removing' &&
    usedSlot === change.newSlot &&
    slots.every((s) => s === change.newSlot || s === change.oldSlot)
  ) {
    next = slots.includes(change.oldSlot) ? { ...credential, change: { ...change, stage: 'remove' } } : clean;
  } else throw new Error('Use the correct PIN to recover this change.');
  await save(next);
  return next;
}

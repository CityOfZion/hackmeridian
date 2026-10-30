import { MicrokernelClient, type ItemSecureTunnel } from '@item-systems/item/mobile';
import type { PinProfile } from './card-auth';
import type { Issuance } from './card-issuance';
import { inspectOwnedKeys } from './card-management.ts';

/** Recover the standard bank handoff on a new phone from authenticated, read-only evidence.
 * No credential, key or ownership mutation occurs here. Nonstandard/ambiguous cards need their receipt.
 */
export async function inspectUserCard(
  tunnel: ItemSecureTunnel,
  uid: string,
  profile: PinProfile,
  slots: number[],
  initialPin: boolean,
) {
  const client = new MicrokernelClient(tunnel);
  const actor = await client.uac.current();
  if (
    tunnel.info?.uid !== uid ||
    tunnel.authenticatedIdentityId !== profile.identityId ||
    actor.uid !== profile.identityId ||
    profile.identityId !== profile.credentialIdentityId ||
    actor.capabilities !== 0 ||
    actor.policy !== 1 ||
    actor.threshold !== 1 ||
    actor.credentialCount !== slots.length ||
    new Set(slots).size !== slots.length ||
    slots.some((s) => !Number.isInteger(s) || s < 0 || s > 3) ||
    !slots.includes(profile.credentialSlot)
  )
    throw new Error('Cardholder access needs inspection. Check the activation details from your bank.');
  const keys = await inspectOwnedKeys(tunnel);
  if (!keys.masters.length)
    throw new Error('Your bank needs to assign a masterkey to this cardholder before setup can continue.');
  if (!keys.engines.length) throw new Error('Your bank needs to configure P-256 signing on this card.');
  if (!initialPin) {
    if (slots.length !== 1)
      throw new Error('Multiple PIN credentials remain. Resume setup with your bank activation details.');
    return { keys, record: null };
  }
  const master = keys.masters[0];
  if (
    profile.identityId === 1 ||
    profile.credentialSlot !== 0 ||
    keys.masters.length !== 1 ||
    master.mode !== 0o700 ||
    master.gid !== 255 ||
    master.rings.length ||
    !slots.includes(0) ||
    slots.length > 2
  )
    throw new Error('Initial-PIN setup needs the original bank activation details. No card changes were made.');
  const resource = await client.posix.stat(1, master.slot);
  if (resource.uid !== actor.uid || resource.gid !== 255 || resource.mode !== 0o700)
    throw new Error('Cardholder masterkey ownership could not be verified.');
  const record: Issuance = {
    version: 1,
    uid,
    issuer: 1,
    holder: actor.uid,
    // Conservatively retain the standard bank permission warning in reconstructed handoffs.
    issuerCanManageIdentities: true,
    phase: slots.length === 1 ? 'personal-pin-ready' : 'personal-pin-unknown',
    credentialSlot: 0,
    master: master.slot,
    before: [],
  };
  return { keys, record };
}

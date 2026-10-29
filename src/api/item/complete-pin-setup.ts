import type { ItemSecureTunnel, RandomSource } from '@item-systems/item/mobile';
import type { PinInput } from './card-auth';
import {
  choosePersonalPin,
  verifyIssuance,
  verifyPersonalPin,
  removeDefaultPin,
  type Issuance,
} from './card-issuance.ts';

type Session = (input: PinInput, work: (t: ItemSecureTunnel) => Promise<void>) => Promise<boolean>;
/** One user approval, two authenticated tunnels. Acknowledged checkpoints survive interruption.
 * No authentication or uncertain mutation is retried. Removal requires an authenticated new PIN.
 */
export async function completePinSetup(
  record: Issuance,
  currentPassword: string,
  newPassword: string,
  session: Session,
  random: RandomSource,
  save: (record: Issuance) => Promise<void>,
) {
  let next = record;
  if (!['verify-holder', 'personal-pin-ready', 'verify-personal-pin', 'remove-default-pin'].includes(next.phase))
    throw new Error('PIN setup needs inspection before it can continue.');
  const profile = (credentialSlot: number) => ({
    identityId: record.holder,
    credentialIdentityId: record.holder,
    credentialSlot,
  });
  if (next.phase === 'verify-holder' || next.phase === 'personal-pin-ready') {
    if (currentPassword === newPassword) throw new Error('Choose a different personal PIN.');
    const connected = await session(
      { profile: profile(next.credentialSlot!), password: currentPassword },
      async (t) => {
        if (next.phase === 'verify-holder') next = await verifyIssuance(t, next, save);
        next = await choosePersonalPin(t, next, next.credentialSlot!, newPassword, random, save);
      },
    );
    if (!connected) return null;
  }
  const personalProfile = profile(next.personalSlot!);
  const connected = await session({ profile: personalProfile, password: newPassword }, async (t) => {
    if (next.phase === 'verify-personal-pin')
      next = await verifyPersonalPin(t, next, personalProfile.credentialSlot, save);
    next = await removeDefaultPin(t, next, personalProfile.credentialSlot, save);
  });
  return connected ? { record: next, profile: personalProfile } : null;
}

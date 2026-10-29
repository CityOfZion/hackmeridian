import {
  enrollPassword,
  MicrokernelClient,
  SPAKE2_P256_SHA256,
  SPAKE2_SECP256K1_SHA256,
  type ItemSecureTunnel,
  type RandomSource,
} from '@item-systems/item/mobile';
import { validCardPin, type CardCredential, type PinChange, type PinProfile } from './card-auth.ts';

export type PinCredential = Extract<CardCredential, { mode: 'pin' }>;
type Save = (credential: PinCredential) => Promise<void>;

/** Every step is a separate, explicitly requested card action. Journal before mutations. */
export async function enrollNewPin(
  tunnel: ItemSecureTunnel,
  uid: string,
  credential: PinCredential,
  password: string,
  random: RandomSource,
  save: Save,
) {
  if (credential.change) throw new Error('Finish the existing PIN change before starting another.');
  if (!validCardPin(password)) throw new Error('Choose a PIN with 6–12 characters.');
  if (tunnel.info?.uid !== uid || tunnel.authenticatedIdentityId !== credential.profile.credentialIdentityId)
    throw new Error('Authenticate as this card’s PIN credential owner.');
  const agreement = tunnel.info.tunnelProfile?.agreement;
  if (agreement !== 1 && agreement !== 2) throw new Error('Card exchange provider is unavailable.');
  const change: PinChange = { stage: 'enrolling', oldSlot: credential.profile.credentialSlot };
  await save({ ...credential, change });
  try {
    const newSlot = await enrollPassword(
      tunnel,
      credential.profile.credentialIdentityId,
      password,
      uid,
      random,
      5,
      agreement === 2 ? SPAKE2_P256_SHA256 : SPAKE2_SECP256K1_SHA256,
    );
    if (newSlot === change.oldSlot) throw new Error('Card returned the active credential slot.');
    await save({ ...credential, change: { ...change, stage: 'verify', newSlot } });
  } catch {
    throw new Error(
      'PIN enrollment was not confirmed. The old PIN was not removed. Do not repeat enrollment; inspect credential slots with a supported card manager before continuing.',
    );
  } finally {
    password = '';
  }
}

export async function verifyNewPin(tunnel: ItemSecureTunnel, credential: PinCredential, used: PinProfile, save: Save) {
  const change = credential.change;
  if (
    change?.stage !== 'verify' ||
    change.newSlot === undefined ||
    used.credentialSlot !== change.newSlot ||
    used.credentialIdentityId !== credential.profile.credentialIdentityId ||
    tunnel.authenticatedIdentityId !== credential.profile.credentialIdentityId
  )
    throw new Error('A new PIN must be enrolled and authenticated before it can replace the old PIN.');
  await save({
    ...credential,
    profile: { ...credential.profile, credentialSlot: change.newSlot },
    change: { ...change, stage: 'remove' },
  });
}

export async function removeOldPin(tunnel: ItemSecureTunnel, credential: PinCredential, used: PinProfile, save: Save) {
  const change = credential.change;
  if (
    change?.stage !== 'remove' ||
    change.newSlot !== credential.profile.credentialSlot ||
    used.credentialSlot !== change.newSlot ||
    used.credentialIdentityId !== credential.profile.credentialIdentityId ||
    tunnel.authenticatedIdentityId !== credential.profile.credentialIdentityId
  )
    throw new Error('Verify the new PIN before removing the old credential.');
  await save({ ...credential, change: { ...change, stage: 'removing' } });
  try {
    await new MicrokernelClient(tunnel).uac.removeCredential(credential.profile.credentialIdentityId, change.oldSlot);
    const { change: _change, ...complete } = credential;
    await save(complete);
  } catch {
    throw new Error(
      'Old PIN removal was not confirmed. The verified new PIN remains selected. Inspect the old credential with a supported card manager; VaultPass will not replay the deletion.',
    );
  }
}

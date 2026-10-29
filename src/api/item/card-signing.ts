import { cardPinSession } from './pin-session';
import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

import i18n from '@/i18n';
import { CardSigningError, challengeMessage, hex } from './card-crypto';
import { parseCardCredential, type CardCredential, type PinProfile, type PinChange } from './card-auth';

export {
  CardSigningError,
  normalizeP256Signature,
  parsePairingKey,
  samePublicKey,
  verifyCardSignature,
} from './card-crypto';

const storageKey = (uid: string) => `item.pairing.${uid}`;
/** UIDs with a saved credential. SecureStore can't list keys, so this tells, before any tap, whether a Pass is paired. */
const PAIRED_UIDS_KEY = 'item.pairing.uids';

export async function pairedUids(): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await getItemAsync(PAIRED_UIDS_KEY)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((uid): uid is string => typeof uid === 'string') : [];
  } catch {
    return [];
  }
}

/** True once any Pass has a pairing key saved on this phone. */
export async function hasPairedPass(): Promise<boolean> {
  return (await pairedUids()).length > 0;
}

/** Removes this phone's tunnel credential only. It does not alter the physical card or its accounts. */
export async function forgetCredential(uid: string): Promise<void> {
  cardPinSession.clear();
  await deleteItemAsync(storageKey(uid));
  await setItemAsync(PAIRED_UIDS_KEY, JSON.stringify((await pairedUids()).filter((value) => value !== uid)));
}

/** Records `uid` as paired; also backfills credentials saved before this list existed. */
export async function markPaired(uid: string): Promise<void> {
  const uids = await pairedUids();
  if (!uids.includes(uid)) await setItemAsync(PAIRED_UIDS_KEY, JSON.stringify([...uids, uid]));
}
export async function loadCredential(uid: string): Promise<CardCredential | null> {
  const value = await getItemAsync(storageKey(uid));
  if (!value) return null;
  try {
    return parseCardCredential(JSON.parse(value));
  } catch {
    throw new CardSigningError(i18n.t('common:errors.pass.credentialsInvalid'));
  }
}

export async function saveCredential(uid: string, pairingKey: Uint8Array, publicKey: Uint8Array): Promise<void> {
  await setItemAsync(storageKey(uid), JSON.stringify({ pairingKey: hex(pairingKey), publicKey: hex(publicKey) }), {
    keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await markPaired(uid);
}

/** Replaces a legacy pairing secret only after a verified PIN session/signature. */
export async function savePinCredential(uid: string, profile: PinProfile, publicKey: string, change?: PinChange) {
  const credential = parseCardCredential({ mode: 'pin', profile, publicKey, change });
  await setItemAsync(storageKey(uid), JSON.stringify(credential), {
    keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await markPaired(uid);
}

export async function signingDigest(uid: string, purpose: 'sign-in' | 'fund', payload: string): Promise<Uint8Array> {
  const message = challengeMessage(uid, purpose, payload, getRandomBytes(32));
  return new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(message).buffer));
}

import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

import i18n from '@/i18n';
import { CardSigningError, challengeMessage, hex } from './card-crypto';

export {
  CardSigningError,
  normalizeP256Signature,
  parsePairingKey,
  samePublicKey,
  verifyCardSignature,
} from './card-crypto';

type Credential = { pairingKey: string; publicKey: string };

const storageKey = (uid: string) => `item.pairing.${uid}`;
/** UIDs with a saved credential. SecureStore can't list keys, so this tells, before any tap, whether a Pass is paired. */
const PAIRED_UIDS_KEY = 'item.pairing.uids';

async function pairedUids(): Promise<string[]> {
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

/** Records `uid` as paired; also backfills credentials saved before this list existed. */
export async function markPaired(uid: string): Promise<void> {
  const uids = await pairedUids();
  if (!uids.includes(uid)) await setItemAsync(PAIRED_UIDS_KEY, JSON.stringify([...uids, uid]));
}
export async function loadCredential(uid: string): Promise<Credential | null> {
  const value = await getItemAsync(storageKey(uid));
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') throw new Error();
    const credential = parsed as Credential;
    if (
      !/^[0-9a-f]{64}$/.test(credential.pairingKey) ||
      !/^(?:[0-9a-f]{64}|[0-9a-f]{66}|[0-9a-f]{130})$/.test(credential.publicKey)
    )
      throw new Error();
    return credential;
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

export async function signingDigest(uid: string, purpose: 'sign-in' | 'fund', payload: string): Promise<Uint8Array> {
  const message = challengeMessage(uid, purpose, payload, getRandomBytes(32));
  return new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(message).buffer));
}

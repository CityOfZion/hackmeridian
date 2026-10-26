import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

import i18n from '@/i18n';
import { CardSigningError, challengeMessage, hex } from './card-crypto';

export { CardSigningError, parsePairingKey, samePublicKey, verifyCardSignature } from './card-crypto';

type Credential = { pairingKey: string; publicKey: string };

const storageKey = (uid: string) => `item.pairing.${uid}`;
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
}

export async function signingDigest(uid: string, purpose: 'sign-in' | 'fund', payload: string): Promise<Uint8Array> {
  const message = challengeMessage(uid, purpose, payload, getRandomBytes(32));
  return new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(message).buffer));
}

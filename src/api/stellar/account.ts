import { loadCredential } from '@/api/item/card-signing';
import { type PayAsset } from '@/constants';
import i18n from '@/i18n';

import { StellarError } from './horizon';
import { smartAccountBalances } from './smart-account';

/** The Pass's P-256 Soroban smart account: address and token balances. */
export type PassAccount = {
  address: string;
  /** Token balances. Null is retained for legacy funding-screen types. */
  balances: Record<PayAsset, number | null>;
  /** XLM token balance held by the smart account; network fees are sponsored. */
  xlmBalance: number;
  /** True when the expected card-controlled contract is deployed. */
  exists: boolean;
};

/** The public signing key pinned for this Pass at sign-in. */
export async function passPublicKey(chipId: string): Promise<Uint8Array> {
  const credential = await loadCredential(chipId);
  if (!credential) throw new StellarError(i18n.t('common:errors.stellar.signInFirst'));
  return Uint8Array.from(credential.publicKey.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

export async function loadPassAccount(chipId: string): Promise<PassAccount> {
  const key = await passPublicKey(chipId);
  if (key.length !== 65 || key[0] !== 4) throw new StellarError('The active Pass key must be P-256.');
  return smartAccountBalances(key);
}

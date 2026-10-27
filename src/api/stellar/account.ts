import { loadCredential } from '@/api/item/card-signing';
import { PAY_ASSETS, type PayAsset } from '@/constants';
import i18n from '@/i18n';

import { stellarAsset } from './config';
import { loadAccount, StellarError } from './horizon';
import { passAddress } from './payment';

/** The Pass's Stellar account (its vault): address, and its EURC and USDC. */
export type PassAccount = {
  address: string;
  /** Per asset: the balance, or null when the account has no trustline for it (or is unfunded). */
  balances: Record<PayAsset, number | null>;
  /** XLM held by the account (reserves and fees); 0 when it is unfunded. */
  xlmBalance: number;
  /** False until the address receives XLM. */
  exists: boolean;
};

/** The Ed25519 key pinned for this Pass at sign-in: the Stellar account the vault lives in. */
export async function passPublicKey(chipId: string): Promise<Uint8Array> {
  const credential = await loadCredential(chipId);
  if (!credential) throw new StellarError(i18n.t('common:errors.stellar.signInFirst'));
  return Uint8Array.from(credential.publicKey.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

export async function loadPassAccount(chipId: string): Promise<PassAccount> {
  const address = passAddress(await passPublicKey(chipId));
  const account = await loadAccount(address);
  const balances = Object.fromEntries(
    PAY_ASSETS.map((code) => [code, account?.balanceOf(stellarAsset(code)) ?? null]),
  ) as Record<PayAsset, number | null>;
  return { address, balances, xlmBalance: account?.xlmBalance ?? 0, exists: !!account };
}

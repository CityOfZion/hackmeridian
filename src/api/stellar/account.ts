import { loadCredential } from '@/api/item/card-signing';

import { usdcAsset } from './config';
import { loadAccount, StellarError } from './horizon';
import { passAddress } from './payment';

/** The Pass's Stellar account (its vault): address and on-chain USDC balance. */
export type PassAccount = {
  address: string;
  /** USDC held by the account; 0 when it is unfunded or has no USDC trustline. */
  balance: number;
  /** XLM held by the account (reserves and fees); 0 when it is unfunded. */
  xlmBalance: number;
  /** False until the address receives XLM. */
  exists: boolean;
  hasTrustline: boolean;
};

/** The Ed25519 key pinned for this Pass at sign-in: the Stellar account the vault lives in. */
export async function passPublicKey(chipId: string): Promise<Uint8Array> {
  const credential = await loadCredential(chipId);
  if (!credential) throw new StellarError('Sign in with your Pass to see its Stellar account.');
  return Uint8Array.from(credential.publicKey.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

export async function loadPassAccount(chipId: string): Promise<PassAccount> {
  const address = passAddress(await passPublicKey(chipId));
  const asset = usdcAsset();
  const account = await loadAccount(address, asset.getCode(), asset.getIssuer() ?? '');
  return {
    address,
    balance: account?.balance ?? 0,
    xlmBalance: account?.xlmBalance ?? 0,
    exists: !!account,
    hasTrustline: account?.balance != null,
  };
}

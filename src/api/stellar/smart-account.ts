import { hex } from '@/api/item/card-crypto';
import type { PassSignature } from '@/hooks/use-item-nfi';

export type SmartAccountBalances = {
  address: string;
  balances: { USDC: number; EURC: number };
  xlmBalance: number;
  exists: boolean;
};

const apiUrl = () => {
  const url = process.env.EXPO_PUBLIC_VAULTPASS_API_URL?.replace(/\/$/, '');
  if (!url || (!/^https:\/\//.test(url) && !(__DEV__ && /^http:\/\//.test(url)))) {
    throw new Error('Set EXPO_PUBLIC_VAULTPASS_API_URL to the VaultPass account service.');
  }
  return url;
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = value as { error?: string };
    throw new Error(error.error || 'VaultPass account service is unavailable');
  }
  return value as T;
}

export async function accountChallenge(): Promise<{ digest: Uint8Array; digestHex: string; token: string }> {
  const { digest, token } = await post<{ digest: string; token: string }>('/challenge', {});
  if (!/^[0-9a-f]{64}$/i.test(digest) || !token) throw new Error('Invalid account challenge');
  return { digest: Uint8Array.from(digest.match(/../g) ?? [], (byte) => parseInt(byte, 16)), digestHex: digest, token };
}

export async function resolveSmartAccount(
  proof: PassSignature,
  challenge: { digestHex: string; token: string },
): Promise<SmartAccountBalances> {
  if (proof.publicKey.length !== 65 || proof.publicKey[0] !== 4) {
    throw new Error('The active ITEM KeyRing must contain a P-256 key.');
  }
  return post('/accounts/resolve', {
    digest: challenge.digestHex,
    token: challenge.token,
    publicKey: hex(proof.publicKey),
    signature: hex(proof.signature),
  });
}

export async function smartAccountBalances(publicKey: Uint8Array): Promise<SmartAccountBalances> {
  return post('/accounts/balances', { publicKey: hex(publicKey) });
}

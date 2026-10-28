import { ed25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/nist.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

export class CardSigningError extends Error {}

export const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export function parsePairingKey(value: string): Uint8Array {
  const clean = value.trim().replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) throw new CardSigningError('Enter the 64-character hexadecimal pairing key.');
  return Uint8Array.from({ length: 32 }, (_, index) => parseInt(clean.slice(index * 2, index * 2 + 2), 16));
}

export function challengeMessage(
  uid: string,
  purpose: 'sign-in' | 'fund',
  payload: string,
  nonce: Uint8Array,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(['VaultPass ITEM proof v1', uid, purpose, payload, hex(nonce)]));
}

/** Verify a card signature against its exported public key. The current P-256 card signs the supplied digest directly. */
export function verifyCardSignature(signature: Uint8Array, digest32: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length !== 64 || digest32.length !== 32) return false;
  try {
    if (publicKey.length === 32) return ed25519.verify(signature, digest32, publicKey, { zip215: false });
    if (![33, 65].includes(publicKey.length)) return false;
    return (
      p256.verify(signature, digest32, publicKey, { lowS: false }) ||
      secp256k1.verify(signature, digest32, publicKey, { lowS: false, prehash: true })
    );
  } catch {
    return false;
  }
}

/** Soroban's native P-256 verifier accepts only low-S signatures. Normalization does not require the private key. */
export function normalizeP256Signature(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) throw new CardSigningError('Expected a 64-byte P-256 signature.');
  return p256.Signature.fromCompact(signature).normalizeS().toCompactRawBytes();
}

export function samePublicKey(a: Uint8Array, b: string): boolean {
  return hex(a) === b;
}

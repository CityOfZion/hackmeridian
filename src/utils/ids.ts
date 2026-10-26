import { getRandomBytes } from 'expo-crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomHex(bytes: number) {
  return Array.from(getRandomBytes(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Short human-readable reference, e.g. `VP-8F21-A09C`. */
export function activityId() {
  const hex = randomHex(4).toUpperCase();
  return `VP-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Placeholder Stellar strkey with the right prefix and length; not checksummed. */
export function mockStrkey(prefix: 'G' | 'C') {
  return prefix + Array.from(getRandomBytes(55), (byte) => BASE32[byte % 32]).join('');
}

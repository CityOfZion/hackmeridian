import { getRandomBytes } from 'expo-crypto';

export function randomHex(bytes: number) {
  return Array.from(getRandomBytes(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

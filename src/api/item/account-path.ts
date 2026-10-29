/** 124 random bits after the Stellar namespace: no counter shared across phones. */
export function newAccountPath(random: Uint8Array): Uint8Array {
  if (random.length !== 16) throw new Error('Account creation needs 16 random bytes.');
  const path = new Uint8Array(24);
  const view = new DataView(path.buffer);
  view.setUint32(0, 0x8000002c);
  view.setUint32(4, 0x80000094);
  const entropy = new DataView(random.buffer, random.byteOffset, random.byteLength);
  for (let i = 0; i < 4; i++) view.setUint32(8 + i * 4, entropy.getUint32(i * 4) | 0x80000000);
  return path;
}

import {
  CryptoRegistryClient,
  KeyRingCacheClient,
  MicrokernelClient,
  type ItemSecureTunnel,
} from '@item-systems/item/mobile';
import { hex } from './card-crypto.ts';

/** Only published SDK operations. The card is supplied and configured by its issuer. */
export async function inspectOwnedKeys(tunnel: ItemSecureTunnel) {
  const client = new MicrokernelClient(tunnel);
  const owner = await client.uac.current();
  const masters = (await client.masterkeys.getStats()).filter(
    (m) => m.uid === owner.uid && !m.tunnelAnchor && !m.deprecated,
  );
  const rings: { ring: number; master: number; publicKey: string }[] = [];
  for (const master of masters)
    for (const ring of master.rings) {
      const key = await client.keyrings.exportPublicKey(ring);
      // P-256 is verified again when opening the account; 65-byte encoding alone does not establish its curve.
      if (key.length === 65 && key[0] === 4) {
        const publicKey = hex(key);
        if (rings.some((r) => r.publicKey === publicKey))
          throw new Error('Distinct keychains returned the same key. Card routing needs inspection.');
        rings.push({ ring, master: master.slot, publicKey });
      }
    }
  const engines = [];
  for (const slot of [...new Set([...Array.from({ length: 16 }, (_, i) => i), ...masters.map((m) => m.engine)])]) {
    try {
      const e = await new CryptoRegistryClient(tunnel).querySlot(slot);
      if (e.active && e.algorithm === 2 && e.capabilities & 2) engines.push(e.slot);
    } catch (e) {
      if (!(e instanceof Error && 'status' in e && [0x6a83, 0x6a88, 0x6a86].includes(Number(e.status)))) throw e;
    }
  }
  return { masters, rings, engines };
}
export async function deriveAccount(tunnel: ItemSecureTunnel, master: number, path: Uint8Array, engine: number) {
  if (path.length !== 24) throw new Error('Invalid account path.');
  const owned = await inspectOwnedKeys(tunnel);
  if (!owned.masters.some((m) => m.slot === master) || !owned.engines.includes(engine))
    throw new Error('Select an owned master and an available P-256 engine.');
  const client = new MicrokernelClient(tunnel);
  const key = await client.keyrings.derive(master, path, engine);
  const after = await client.getDiagnostics();
  if (owned.rings.some((r) => r.ring === after.currentRing))
    throw new Error('Account creation needs inspection; an existing keychain was returned.');
  const exported = await client.keyrings.exportPublicKey(after.currentRing);
  if (key.length !== 65 || key[0] !== 4 || exported.length !== key.length || !key.every((b, i) => b === exported[i]))
    throw new Error('Account creation needs inspection; keychain receipt did not match.');
  return { ring: after.currentRing, publicKey: hex(key) };
}
export async function setBankUri(tunnel: ItemSecureTunnel, uri: string) {
  if (!/^[a-z0-9.-]+\/[A-Za-z0-9/_-]*\?d=$/.test(uri) || new TextEncoder().encode(uri).length > 100)
    throw new Error('Use a host/path ending in ?d=, without https:// (up to 100 bytes).');
  await new KeyRingCacheClient(tunnel).setBaseUrl(uri);
}

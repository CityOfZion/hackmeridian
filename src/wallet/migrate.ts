import { loadCredential, pairedUids } from '@/api/item/card-signing';
import { cardAccountAddress } from '@/api/stellar/transfer-codec';

import { keyBytes } from './model';
import { readWallet, writeWallet } from './storage';

/** Old installs stored one public key per card. Keep those accounts and the original SecureStore credentials. */
export async function migrateWallet() {
  const data = await readWallet();
  if (data.accounts.length) return;
  for (const uid of await pairedUids()) {
    const credential = await loadCredential(uid);
    if (!credential || !/^04[0-9a-f]{128}$/.test(credential.publicKey)) continue;
    const publicKey = credential.publicKey;
    const verifiedAt = new Date(0).toISOString(); // The old format did not record a verification date.
    await writeWallet({
      type: 'enroll',
      account: { id: cardAccountAddress(keyBytes(publicKey)), cardUid: uid, publicKey, name: 'My account', verifiedAt },
      card: { uid, publicKey, name: 'My VaultPass', verifiedAt },
    });
  }
}

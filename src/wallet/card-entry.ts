import type { Issuance } from '../api/item/card-issuance';
import type { CardCredential, PinProfile } from '../api/item/card-auth';

/** Receipts take precedence over a remembered wallet or apparently ready card. */
export function cardEntryIntent(record: Issuance | null, credential: CardCredential | null, journal: string | null) {
  if (record && record.phase !== 'complete') return 'setup' as const;
  if (credential?.mode === 'pin' && credential.change) return 'pin-recovery' as const;
  if (journal) return 'setup' as const;
  return credential?.mode === 'pairing' ? ('legacy' as const) : ('inspect' as const);
}

export function entryPinProfile(
  record: Issuance | null,
  credential: CardCredential | null,
  slots: number[],
): PinProfile {
  if (record?.phase === 'complete')
    return { identityId: record.holder, credentialIdentityId: record.holder, credentialSlot: record.personalSlot! };
  if (credential?.mode === 'pin') return credential.profile;
  // Public PARAMS only selects a candidate. It never proves setup or authorizes a write.
  const slot = slots.includes(0) ? 0 : slots.length === 1 ? slots[0] : undefined;
  if (slot === undefined)
    throw new Error('Card access could not be identified. Use the access details from your bank.');
  return { identityId: 2, credentialIdentityId: 2, credentialSlot: slot };
}

type Ring = { ring: number; master: number; publicKey: string };
/** Never select an account from a different card or silently use a changed signing key. */
export function entryAccount<T extends Ring>(
  uid: string,
  rings: T[],
  preferred?: { cardUid: string; ring?: number; publicKey: string },
): T | undefined {
  if (preferred?.cardUid === uid) {
    const ring = rings.find((r) => r.ring === preferred.ring);
    if (ring && ring.publicKey !== preferred.publicKey)
      throw new Error('This account key changed. Review the card before opening it.');
    if (ring) return ring;
  }
  return rings.length === 1 ? rings[0] : undefined;
}

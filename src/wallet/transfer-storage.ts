import { validateIntent, type TransferIntent, type TransferRecord } from '../api/stellar/transfer-codec.ts';

export type SavedTransfer = { id: string; signature: string; intent: TransferIntent };
type Storage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
const storageKey = (id: string) => `item.transfer.${id}`;
export function parseSavedTransfer(value: string): SavedTransfer {
  const transfer = JSON.parse(value) as SavedTransfer;
  if (
    !transfer ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(transfer.id) ||
    !/^[0-9a-f]{128}$/.test(transfer.signature)
  )
    throw new Error('The saved payment could not be read. Reconcile it before sending another payment.');
  validateIntent(transfer.intent);
  return transfer;
}

/** Account-scoped secure receipts, with a checked, copy-before-delete migration from the old card-UID key. */
export function createTransferStorage(storage: Storage, status: (id: string) => Promise<TransferRecord>) {
  const save = async (account: string, transfer: SavedTransfer) => {
    const value = JSON.stringify(transfer);
    parseSavedTransfer(value);
    await storage.set(storageKey(account), value);
  };
  const clear = (account: string) => storage.remove(storageKey(account));
  const load = async (account: string, legacyUid?: string): Promise<SavedTransfer | null> => {
    const existing = await storage.get(storageKey(account));
    if (existing) return parseSavedTransfer(existing);
    if (!legacyUid) return null;
    const old = await storage.get(storageKey(legacyUid));
    if (!old) return null;
    const candidate = parseSavedTransfer(old);
    const record = await status(candidate.id);
    if (
      record.prepared.id !== candidate.id ||
      JSON.stringify(validateIntent(record.intent)) !== JSON.stringify(validateIntent(candidate.intent))
    )
      throw new Error('The saved payment status does not match its approved intent.');
    if (record.prepared.account !== account) return null;
    await save(account, candidate);
    await clear(legacyUid);
    return candidate;
  };
  return { save, clear, load };
}

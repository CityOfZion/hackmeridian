import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

import { hex } from '@/api/item/card-crypto';
import { accountServicePost } from './smart-account';
import { validatePreparedTransfer, type TransferIntent, type TransferRecord } from './transfer-codec';

export type SavedTransfer = { id: string; signature: string; intent: TransferIntent };
const storageKey = (uid: string) => `item.transfer.${uid}`;

/** Save before the first submit; a restart can resume the same authorization without another card tap. */
export const saveTransfer = (uid: string, transfer: SavedTransfer) =>
  setItemAsync(storageKey(uid), JSON.stringify(transfer), { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
export const clearTransfer = (uid: string) => deleteItemAsync(storageKey(uid));
export async function loadTransfer(uid: string): Promise<SavedTransfer | null> {
  const value = await getItemAsync(storageKey(uid));
  if (!value) return null;
  const transfer = JSON.parse(value) as SavedTransfer;
  if (!/^[0-9a-f-]{36}$/.test(transfer.id) || !/^[0-9a-f]{128}$/.test(transfer.signature) || !transfer.intent) {
    throw new Error('The saved payment could not be read. Reconcile it before sending another payment.');
  }
  return transfer;
}

export const prepareTransfer = (publicKey: Uint8Array, intent: TransferIntent) =>
  accountServicePost<TransferRecord>('/transfers/prepare', { publicKey: hex(publicKey), intent });
export const submitTransfer = (saved: SavedTransfer) =>
  accountServicePost<TransferRecord>('/transfers/submit', { id: saved.id, signature: saved.signature });
export const transferStatus = (id: string) => accountServicePost<TransferRecord>('/transfers/status', { id });

/** Independent ledger read bounds the relay's proposed approval lifetime. */
export async function validateTransferNow(record: TransferRecord, intent: TransferIntent, publicKey: Uint8Array) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let ledger: number;
  try {
    const response = await fetch('https://mainnet.sorobanrpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
      signal: controller.signal,
    });
    const body = await response.json();
    ledger = body?.result?.sequence;
    if (!response.ok || !Number.isSafeInteger(ledger))
      throw new Error('Cannot check the current Stellar ledger. Try again.');
  } finally {
    clearTimeout(timer);
  }
  validatePreparedTransfer(record.prepared, intent, publicKey, ledger);
  if (record.prepared.expirationLedger - ledger < 24)
    throw new Error('The approval is nearly expired. Review the transfer again.');
}

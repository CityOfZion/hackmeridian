import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TransferRecord } from '@/api/stellar/transfer-codec';

export type Receipt = TransferRecord & { recordedAt: string; note?: string };
const key = (account: string) => `vaultpass.receipts.${account}`;
let queue: Promise<unknown> = Promise.resolve();
export async function readReceipts(account: string): Promise<Receipt[]> {
  const records = JSON.parse((await AsyncStorage.getItem(key(account))) ?? '[]') as Receipt[];
  if (!Array.isArray(records) || records.some((r) => r.prepared?.account !== account))
    throw new Error('Saved payment history has an invalid account.');
  return records;
}
export function recordReceipt(record: TransferRecord, note?: string) {
  const next = queue
    .catch(() => undefined)
    .then(async () => {
      const records = await readReceipts(record.prepared.account);
      const previous = records.find((r) => r.prepared.id === record.prepared.id);
      const receipt = {
        ...record,
        recordedAt: previous?.recordedAt ?? new Date().toISOString(),
        note: note ?? previous?.note,
      };
      await AsyncStorage.setItem(
        key(record.prepared.account),
        JSON.stringify([receipt, ...records.filter((r) => r.prepared.id !== record.prepared.id)]),
      );
    });
  queue = next;
  return next;
}

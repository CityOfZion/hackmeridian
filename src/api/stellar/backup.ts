import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { accountServicePost, type AccountMembership } from './smart-account';
import { validateBackupIntent, type BackupIntent, type BackupRecord } from './backup-codec';
import { type WalletAccount, type WalletCard, validateAccount } from '@/wallet/model';

export type SavedBackup = {
  id: string;
  signature: string;
  intent: BackupIntent;
  card: WalletCard;
  source: WalletAccount;
};
export const backupStatus = (id: string) => accountServicePost<BackupRecord>('/backups/status', { id });
export const submitBackup = (saved: SavedBackup) =>
  accountServicePost<BackupRecord>('/backups/submit', { id: saved.id, signature: saved.signature });
export const backupMembership = (account: string, publicKey: string) =>
  accountServicePost<AccountMembership>('/accounts/membership', { account, publicKey });
function parseSaved(value: string, account: string): SavedBackup {
  const saved = JSON.parse(value) as SavedBackup;
  validateBackupIntent(saved.intent);
  validateAccount(saved.source);
  if (
    saved.intent.account !== account ||
    saved.source.id !== account ||
    saved.card.publicKey !== saved.intent.publicKey ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(saved.card.uid) ||
    !/^[0-9a-f-]{36}$/.test(saved.id) ||
    !/^[0-9a-f]{128}$/.test(saved.signature)
  )
    throw new Error('Cannot read the saved backup approval. Reconcile it before adding another backup.');
  return saved;
}
export async function saveBackup(saved: SavedBackup) {
  const value = JSON.stringify(saved);
  parseSaved(value, saved.source.id);
  await setItemAsync(`item.backup.${saved.source.id}`, value, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function loadBackup(account: string) {
  const value = await getItemAsync(`item.backup.${account}`);
  return value ? parseSaved(value, account) : null;
}

export const clearBackup = (account: string) => deleteItemAsync(`item.backup.${account}`);

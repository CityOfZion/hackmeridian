import { accountServicePost } from './smart-account';
import type { TransferAsset } from './transfer-codec';
import type { WalletAccount } from '@/wallet/model';

export type AccountEvent = {
  id: string;
  account: string;
  asset: TransferAsset;
  amount: string;
  from: string;
  to: string;
  direction: 'sent' | 'received';
  hash: string;
  ledger: number;
  date: string;
};
export type ActivityPage = {
  account: string;
  events: AccountEvent[];
  oldestLedger: number;
  latestLedger: number;
  startLedger: number;
  endLedger: number;
  cursor: string;
  hasMore: boolean;
};
export async function accountActivity(
  account: WalletAccount,
  cursor?: string,
  beforeLedger?: number,
): Promise<ActivityPage> {
  const page = await accountServicePost<ActivityPage>('/accounts/activity', {
    publicKey: account.publicKey,
    account: account.id,
    ...(cursor ? { cursor } : {}),
    ...(beforeLedger ? { beforeLedger } : {}),
  });
  if (
    page.account !== account.id ||
    !Array.isArray(page.events) ||
    page.events.some((event) => event.account !== account.id || (event.from !== account.id && event.to !== account.id))
  )
    throw new Error('Activity response belongs to a different account.');
  return page;
}

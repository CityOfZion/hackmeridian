import { createSelector } from '@reduxjs/toolkit';

import { MERCHANT_NAME } from '../constants';
import { isSameDay } from '../utils/format';
import { selectAllHolders } from './slices/holders-slice';
import { selectAllTransactions, type Transaction } from './slices/transactions-slice';
import type { RootState } from '.';

const selectHolderIdArg = (_state: RootState, holderId: string) => holderId;

export const selectHolderTransactions = createSelector(
  [selectAllTransactions, selectHolderIdArg],
  (transactions, holderId) => transactions.filter((tx) => tx.holderId === holderId),
);

export const selectSpentToday = createSelector([selectHolderTransactions], (transactions) => {
  const now = Date.now();
  return transactions
    .filter((tx) => tx.status === 'SETTLED' && isSameDay(tx.createdAt, now))
    .reduce((sum, tx) => sum + tx.amount, 0);
});

function summarize(transactions: Transaction[]) {
  const settled = transactions.filter((tx) => tx.status === 'SETTLED');
  return { volume: settled.reduce((sum, tx) => sum + tx.amount, 0), count: settled.length };
}

export const selectTodayTransactions = createSelector([selectAllTransactions], (transactions) => {
  const now = Date.now();
  return transactions.filter((tx) => isSameDay(tx.createdAt, now));
});

/** Settled volume across the whole network today. */
export const selectNetworkSettledToday = createSelector([selectTodayTransactions], summarize);

export const selectMerchantLedgerToday = createSelector([selectTodayTransactions], (transactions) =>
  transactions.filter((tx) => tx.merchant === MERCHANT_NAME),
);

export const selectMerchantSettledToday = createSelector([selectMerchantLedgerToday], summarize);

export const selectCardStateCounts = createSelector([selectAllHolders], (holders) => ({
  issued: holders.length,
  active: holders.filter((h) => h.state === 'ACTIVE').length,
  locked: holders.filter((h) => h.state === 'LOCKED').length,
  suspended: holders.filter((h) => h.state === 'SUSPENDED').length,
}));

import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import { MERCHANT_NAME } from '@/constants';

export type DeclineReason = 'CARD LOCKED' | 'CARD SUSPENDED' | 'OVER LIMIT' | 'NETWORK FROZEN' | 'MERCHANT DISABLED';

export type Transaction = {
  id: string;
  holderId: string;
  merchant: string;
  amount: number;
  createdAt: number;
  status: 'SETTLED' | 'DECLINED';
  reason?: DeclineReason;
  /** ITEM application UID read from the tapped NFI */
  nfiUid?: string;
};

const transactionsAdapter = createEntityAdapter<Transaction>({
  sortComparer: (a, b) => b.createdAt - a.createdAt,
});
const adapterSelectors = transactionsAdapter.getSelectors();

const HOUR_MS = 60 * 60 * 1000;
const now = Date.now();

const initialState = transactionsAdapter.setAll(transactionsAdapter.getInitialState(), [
  {
    id: 'VP-8F21-A09C',
    holderId: 'maya',
    merchant: MERCHANT_NAME,
    amount: 18.5,
    createdAt: now - 2 * HOUR_MS,
    status: 'SETTLED',
  },
  {
    id: 'VP-7D11-B83E',
    holderId: 'maya',
    merchant: 'North Market',
    amount: 6.25,
    createdAt: now - 29 * HOUR_MS,
    status: 'SETTLED',
  },
]);

export const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    transactionRecorded: transactionsAdapter.addOne,
  },
  selectors: {
    selectAllTransactions: adapterSelectors.selectAll,
    selectTransactionById: adapterSelectors.selectById,
  },
});

export const { transactionRecorded } = transactionsSlice.actions;
export const { selectAllTransactions, selectTransactionById } = transactionsSlice.selectors;

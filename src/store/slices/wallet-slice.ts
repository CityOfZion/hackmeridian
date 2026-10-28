import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { emptyWallet, type WalletChange } from '@/wallet/model';
import { readWallet, writeWallet } from '@/wallet/storage';

export const hydrateWallet = createAsyncThunk('wallet/hydrate', readWallet);
export const updateWallet = createAsyncThunk('wallet/update', (change: WalletChange) => writeWallet(change));

export const walletSlice = createSlice({
  name: 'wallet',
  initialState: { data: emptyWallet(), ready: false, locked: true, error: undefined as string | undefined },
  reducers: {
    walletLocked: (state) => {
      state.locked = true;
    },
    walletUnlocked: (state) => {
      state.locked = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateWallet.pending, (state) => {
      state.error = undefined;
    });
    builder.addCase(hydrateWallet.fulfilled, (state, action) => {
      state.data = action.payload;
      state.ready = true;
      state.locked = action.payload.appLock;
    });
    builder.addCase(hydrateWallet.rejected, (state, action) => {
      state.error = action.error.message;
    });
    builder.addCase(updateWallet.fulfilled, (state, action) => {
      state.data = action.payload;
    });
  },
  selectors: {
    selectWallet: (state) => state.data,
    selectWalletAccount: (state) => state.data.accounts.find((a) => a.id === state.data.selectedId),
  },
});
export const { walletLocked, walletUnlocked } = walletSlice.actions;
export const { selectWallet, selectWalletAccount } = walletSlice.selectors;

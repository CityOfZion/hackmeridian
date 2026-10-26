import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { MOCK_VAULT_BALANCE } from '@/constants';

/**
 * Mocked Spend Vault balance (USDC). Stands in for the Soroban vault until it is deployed; replace with a chain read
 * for the MVP. Lives for the app run.
 */
export const vaultSlice = createSlice({
  name: 'vault',
  initialState: { balance: MOCK_VAULT_BALANCE },
  reducers: {
    vaultDebited: (state, action: PayloadAction<number>) => {
      state.balance -= action.payload;
    },
  },
  selectors: {
    selectVaultBalance: (state) => state.balance,
  },
});

export const { vaultDebited } = vaultSlice.actions;
export const { selectVaultBalance } = vaultSlice.selectors;

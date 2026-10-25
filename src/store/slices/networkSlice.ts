import { createSlice } from '@reduxjs/toolkit';

type NetworkState = {
  frozen: boolean;
  merchantAcceptance: boolean;
};

const initialState: NetworkState = {
  frozen: false,
  merchantAcceptance: true,
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    freezeToggled: (state) => {
      state.frozen = !state.frozen;
    },
    merchantAcceptanceToggled: (state) => {
      state.merchantAcceptance = !state.merchantAcceptance;
    },
  },
  selectors: {
    selectNetworkFrozen: (state) => state.frozen,
    selectMerchantAcceptance: (state) => state.merchantAcceptance,
  },
});

export const { freezeToggled, merchantAcceptanceToggled } = networkSlice.actions;
export const { selectNetworkFrozen, selectMerchantAcceptance } = networkSlice.selectors;

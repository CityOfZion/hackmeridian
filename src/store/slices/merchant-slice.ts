import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '⌫';

const MAX_AMOUNT_LENGTH = 7;

type MerchantState = {
  /** Amount as typed on the keypad, e.g. "18.5". */
  draftAmount: string;
};

const initialState: MerchantState = {
  draftAmount: '',
};

export const merchantSlice = createSlice({
  name: 'merchant',
  initialState,
  reducers: {
    keypadPressed: (state, action: PayloadAction<KeypadKey>) => {
      const key = action.payload;
      if (key === '⌫') {
        state.draftAmount = state.draftAmount.slice(0, -1);
        return;
      }
      if (key === '.' && state.draftAmount.includes('.')) return;
      state.draftAmount = (state.draftAmount + key).replace(/^0+(?=\d)/, '').slice(0, MAX_AMOUNT_LENGTH);
    },
    draftAmountCleared: (state) => {
      state.draftAmount = '';
    },
  },
  selectors: {
    selectDraftAmount: (state) => state.draftAmount,
  },
});

export const { keypadPressed, draftAmountCleared } = merchantSlice.actions;
export const { selectDraftAmount } = merchantSlice.selectors;

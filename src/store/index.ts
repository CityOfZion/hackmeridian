import { combineSlices, configureStore, type Action, type ThunkAction } from '@reduxjs/toolkit';

import { holdersSlice } from './slices/holders-slice';
import { merchantSlice } from './slices/merchant-slice';
import { networkSlice } from './slices/network-slice';
import { transactionsSlice } from './slices/transactions-slice';

const rootReducer = combineSlices(holdersSlice, transactionsSlice, networkSlice, merchantSlice);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;

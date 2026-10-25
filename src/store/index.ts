import { combineSlices, configureStore, type Action, type ThunkAction } from '@reduxjs/toolkit';

import { holdersSlice } from './slices/holdersSlice';
import { merchantSlice } from './slices/merchantSlice';
import { networkSlice } from './slices/networkSlice';
import { transactionsSlice } from './slices/transactionsSlice';

const rootReducer = combineSlices(holdersSlice, transactionsSlice, networkSlice, merchantSlice);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;

import { combineSlices, configureStore, type Action, type ThunkAction } from '@reduxjs/toolkit';

import { vaultApi } from './api/vault-api';
import { sessionSlice } from './slices/session-slice';

const rootReducer = combineSlices(sessionSlice, vaultApi);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(vaultApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;

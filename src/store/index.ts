import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { cardsApi } from './api/cards-api';
import { sessionSlice } from './slices/session-slice';
import { vaultSlice } from './slices/vault-slice';

const rootReducer = combineSlices(sessionSlice, vaultSlice, cardsApi);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cardsApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];

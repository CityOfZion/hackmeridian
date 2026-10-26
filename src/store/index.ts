import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { cardsApi } from './api/cards-api';
import { vaultApi } from './api/vault-api';
import { sessionSlice } from './slices/session-slice';

const rootReducer = combineSlices(sessionSlice, cardsApi, vaultApi);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cardsApi.middleware, vaultApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];

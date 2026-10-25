import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { counterSlice } from './slices/counterSlice';

const rootReducer = combineSlices(counterSlice);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];

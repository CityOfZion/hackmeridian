import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Session } from '@/api/types';

type SessionState = { session?: Session };

const initialState: SessionState = {};

/** The signed-in user, opened by a Pass tap plus a biometric check. */
export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted: (state, action: PayloadAction<Session>) => {
      state.session = action.payload;
    },
    sessionEnded: (state) => {
      state.session = undefined;
    },
  },
  selectors: {
    selectSession: (state) => state.session,
  },
});

export const { sessionStarted, sessionEnded } = sessionSlice.actions;
export const { selectSession } = sessionSlice.selectors;

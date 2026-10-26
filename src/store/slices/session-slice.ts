import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type SessionState = {
  /** ITEM application UID of the Pass scanned on the first screen. */
  chipId?: string;
};

const initialState: SessionState = {};

/** The Pass the app is operating, opened by scanning it. */
export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted: (state, action: PayloadAction<string>) => {
      state.chipId = action.payload;
    },
    sessionEnded: (state) => {
      state.chipId = undefined;
    },
  },
  selectors: {
    selectChipId: (state) => state.chipId,
  },
});

export const { sessionStarted, sessionEnded } = sessionSlice.actions;
export const { selectChipId } = sessionSlice.selectors;

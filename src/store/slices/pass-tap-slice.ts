import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { TapStep } from '@/hooks/use-item-nfi';

type PassTapState = {
  /** `active` while the Pass is being read; `success`/`error` briefly after, until the modal is dismissed. */
  phase: 'idle' | 'active' | 'success' | 'error';
  /** What the tap is for, e.g. "Hold your Pass near the phone to sign the funding". */
  title: string;
  step?: TapStep;
  error?: string;
};

const initialState: PassTapState = { phase: 'idle', title: '' };

/** The Pass tap in progress, rendered by <PassTapModal> on Android (iOS shows its own NFC sheet). */
export const passTapSlice = createSlice({
  name: 'passTap',
  initialState,
  reducers: {
    tapStarted: (_state, action: PayloadAction<string>) => ({ phase: 'active', title: action.payload }),
    tapStepChanged: (state, action: PayloadAction<TapStep>) => {
      state.step = action.payload;
    },
    tapSucceeded: (state) => {
      state.phase = 'success';
    },
    tapFailed: (state, action: PayloadAction<string>) => {
      state.phase = 'error';
      state.error = action.payload;
    },
    tapDismissed: () => initialState,
  },
  selectors: {
    selectPassTap: (state) => state,
  },
});

export const { tapStarted, tapStepChanged, tapSucceeded, tapFailed, tapDismissed } = passTapSlice.actions;
export const { selectPassTap } = passTapSlice.selectors;

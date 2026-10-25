import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type CounterState = {
  value: number;
};

const initialState: CounterState = {
  value: 0,
};

export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
    reset: () => initialState,
  },
  selectors: {
    selectCount: (state) => state.value,
  },
});

export const { increment, decrement, incrementByAmount, reset } = counterSlice.actions;
export const { selectCount } = counterSlice.selectors;

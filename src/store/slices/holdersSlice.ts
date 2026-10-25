import { createEntityAdapter, createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_DAILY_LIMIT } from '../../constants';

export type CardState = 'ACTIVE' | 'LOCKED' | 'SUSPENDED';
export type CardDesign = 'a' | 'b' | 'c' | 'd' | 'e';

export const CARD_DESIGNS: CardDesign[] = ['a', 'b', 'c', 'd', 'e'];

export type Holder = {
  id: string;
  name: string;
  cardId: string;
  state: CardState;
  dailyLimit: number;
  design: CardDesign;
  account: string;
  balance: number;
};

const holdersAdapter = createEntityAdapter<Holder>();
const adapterSelectors = holdersAdapter.getSelectors();

const initialState = holdersAdapter.setAll(holdersAdapter.getInitialState(), [
  { id: 'maya', name: 'Maya Chen', cardId: 'NFI3-09F2-4A81', state: 'ACTIVE', dailyLimit: 150, design: 'a', account: 'GCT4…9QP7', balance: 250 },
  { id: 'liam', name: 'Liam Patel', cardId: 'NFI3-61B0-2C17', state: 'ACTIVE', dailyLimit: 250, design: 'b', account: 'GDL2…7HX4', balance: 410 },
  { id: 'sofia', name: 'Sofia Martins', cardId: 'NFI3-A442-91E3', state: 'SUSPENDED', dailyLimit: 100, design: 'c', account: 'GBQ9…3MZ1', balance: 75 },
]);

export const holdersSlice = createSlice({
  name: 'holders',
  initialState,
  reducers: {
    cardStateChanged: (state, action: PayloadAction<{ id: string; state: CardState }>) => {
      holdersAdapter.updateOne(state, { id: action.payload.id, changes: { state: action.payload.state } });
    },
    dailyLimitChanged: (state, action: PayloadAction<{ id: string; dailyLimit: number }>) => {
      holdersAdapter.updateOne(state, { id: action.payload.id, changes: { dailyLimit: action.payload.dailyLimit } });
    },
    designChanged: (state, action: PayloadAction<{ id: string; design: CardDesign }>) => {
      holdersAdapter.updateOne(state, { id: action.payload.id, changes: { design: action.payload.design } });
    },
    balanceDebited: (state, action: PayloadAction<{ id: string; amount: number }>) => {
      const holder = state.entities[action.payload.id];
      if (holder) holder.balance -= action.payload.amount;
    },
    cardIssued: {
      reducer: holdersAdapter.addOne,
      prepare: (input: { name: string; cardId: string; design: CardDesign }) => ({
        payload: {
          ...input,
          id: nanoid(),
          state: 'ACTIVE' as const,
          dailyLimit: DEFAULT_DAILY_LIMIT,
          account: 'Pending binding',
          balance: 0,
        },
      }),
    },
  },
  selectors: {
    selectAllHolders: adapterSelectors.selectAll,
    selectHolderById: adapterSelectors.selectById,
  },
});

export const { cardStateChanged, dailyLimitChanged, designChanged, balanceDebited, cardIssued } = holdersSlice.actions;
export const { selectAllHolders, selectHolderById } = holdersSlice.selectors;

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import { createBunqCard, getBunqCard, listBunqCards, setBunqCardLimit } from '@/api/bunq/cards';
import type { ApiError, Card, CardDesign } from '@/api/types';
import { CARD_LABEL_MAX_LENGTH, MAX_CARDS } from '@/constants';

import { call } from './call';

/** The Pass's bunq virtual cards, straight from bunq production (`@/api/bunq`). */
export const cardsApi = createApi({
  reducerPath: 'cardsApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['Cards'],
  endpoints: (build) => ({
    getCards: build.query<Card[], void>({
      queryFn: (args, { endpoint }) => call(endpoint, args, listBunqCards),
      providesTags: ['Cards'],
    }),
    createCard: build.mutation<Card, { label: string; design: CardDesign }>({
      queryFn: (args, { endpoint }) =>
        call(endpoint, args, async () => {
          const label = args.label.trim();
          if (!label || label.length > CARD_LABEL_MAX_LENGTH) {
            throw new Error(`Name the card in 1 to ${CARD_LABEL_MAX_LENGTH} characters.`);
          }
          if ((await listBunqCards()).length >= MAX_CARDS) throw new Error(`You can have up to ${MAX_CARDS} cards.`);
          return createBunqCard({ label, design: args.design });
        }),
      invalidatesTags: ['Cards'],
    }),
    /** Reload: raises the card's bunq `card_limit` by `amount`. */
    reloadCard: build.mutation<Card, { cardId: string; amount: number }>({
      queryFn: (args, { endpoint }) =>
        call(endpoint, args, async () => {
          const card = await getBunqCard(args.cardId);
          const loadedBalance = card.loadedBalance + args.amount;
          console.log(`[api] reload card ${card.id}: limit ${card.loadedBalance} → ${loadedBalance} EUR`);
          await setBunqCardLimit(card.id, loadedBalance);
          // bunq can accept the PUT and keep the old limit, so read it back before calling the reload done
          const updated = await getBunqCard(args.cardId);
          console.log(`[api] reload card ${card.id}: bunq now reports ${updated.loadedBalance} EUR`);
          if (Math.abs(updated.loadedBalance - loadedBalance) > 0.001) {
            throw new Error(
              `bunq accepted the new limit but the card still shows ${updated.loadedBalance.toFixed(2)} EUR (expected ${loadedBalance.toFixed(2)}).`,
            );
          }
          return updated;
        }),
      invalidatesTags: ['Cards'],
    }),
  }),
});

export const { useGetCardsQuery, useCreateCardMutation, useReloadCardMutation } = cardsApi;

/** Message of an RTK Query error from this API, for inline error text. */
export function apiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

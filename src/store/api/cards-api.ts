import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import { createBunqCard, getBunqCard, listBunqCards, setBunqCardLimit } from '@/api/bunq/cards';
import type { ApiError, Card, CardDesign } from '@/api/types';
import { CARD_LABEL_MAX_LENGTH, MAX_CARDS } from '@/constants';

/**
 * Resolves a bunq call into RTK Query's `{ data } | { error }` shape. Failures are printed to the Metro terminal in
 * development; `console.log` rather than `console.error`, so LogBox doesn't cover the screen's own error text.
 */
async function call<T>(
  endpoint: string,
  args: unknown,
  request: () => Promise<T>,
): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await request() };
  } catch (error) {
    if (__DEV__) console.log(`[api] ${endpoint} failed`, args ?? '', error);
    return { error: { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' } };
  }
}

/** The Pass's bunq virtual cards, straight from the bunq sandbox (`@/api/bunq`). */
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
          await setBunqCardLimit(card.id, loadedBalance);
          return { ...card, loadedBalance };
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

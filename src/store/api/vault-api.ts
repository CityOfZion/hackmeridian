import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import { loadPassAccount, type PassAccount } from '@/api/stellar/account';
import { quoteFund } from '@/api/stellar/payment';
import type { ApiError } from '@/api/types';
import type { PayAsset } from '@/constants';

import { call } from './call';

/** The Pass's vault: its Stellar account with its EURC and USDC, and what a funding costs, read from Horizon. */
export const vaultApi = createApi({
  reducerPath: 'vaultApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['Vault'],
  endpoints: (build) => ({
    /** Keyed by the session's chip ID. */
    getVault: build.query<PassAccount, string>({
      queryFn: (chipId, { endpoint }) => call(endpoint, chipId, () => loadPassAccount(chipId)),
      providesTags: ['Vault'],
    }),
    /** What a funding of `amount` EURC costs paid with `payWith` (1:1 for EURC; Stellar's exchange for USDC). */
    getFundQuote: build.query<{ sourceAmount: number }, { amount: number; payWith: PayAsset }>({
      queryFn: (args, { endpoint }) =>
        call(endpoint, args, async () => ({ sourceAmount: (await quoteFund(args.amount, args.payWith)).sourceAmount })),
      keepUnusedDataFor: 30,
    }),
  }),
});

export const { useGetVaultQuery, useGetFundQuoteQuery } = vaultApi;

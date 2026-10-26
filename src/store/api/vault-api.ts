import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import { loadPassAccount, type PassAccount } from '@/api/stellar/account';
import type { ApiError } from '@/api/types';

import { call } from './call';

/** The Pass's vault: its Stellar account and EURC balance, read from Horizon. */
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
  }),
});

export const { useGetVaultQuery } = vaultApi;

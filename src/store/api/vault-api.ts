import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import * as server from '@/api/mock-server';
import type { Activity, ApiError, Session, TapProof, TapResult, VaultOverview } from '@/api/types';

/** Resolves a mock-server call into RTK Query's `{ data } | { error }` shape. */
async function call<T>(request: () => Promise<T>): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await request() };
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' } };
  }
}

/**
 * COZ backend API. Every endpoint answers from `@/api/mock-server` for now; once the backend exists, swap
 * `fakeBaseQuery` for `fetchBaseQuery({ baseUrl })` and each `queryFn` for a `query` with the spec's method and path.
 */
export const vaultApi = createApi({
  reducerPath: 'vaultApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['Vault'],
  endpoints: (build) => ({
    authTap: build.mutation<TapResult, TapProof>({
      queryFn: (proof) => call(() => server.authTap(proof)),
    }),
    passkeyRegister: build.mutation<Session, { tapToken: string; chipId: string; name: string }>({
      queryFn: (body) => call(() => server.passkeyRegister(body)),
    }),
    passkeyVerify: build.mutation<Session, { tapToken: string; chipId: string }>({
      queryFn: (body) => call(() => server.passkeyVerify(body)),
    }),
    getVault: build.query<VaultOverview, { userId: string }>({
      queryFn: (params) => call(() => server.getVault(params)),
      providesTags: ['Vault'],
    }),
    reload: build.mutation<Activity, { userId: string; amount: number; tapToken: string }>({
      queryFn: (body) => call(() => server.reload(body)),
      invalidatesTags: ['Vault'],
    }),
    requestWithdraw: build.mutation<
      Activity,
      { userId: string; amount: number; destination: string; tapToken: string }
    >({
      queryFn: (body) => call(() => server.requestWithdraw(body)),
      invalidatesTags: ['Vault'],
    }),
  }),
});

export const {
  useAuthTapMutation,
  usePasskeyRegisterMutation,
  usePasskeyVerifyMutation,
  useGetVaultQuery,
  useReloadMutation,
  useRequestWithdrawMutation,
} = vaultApi;

/** Message of an RTK Query error from this API, for inline error text. */
export function apiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

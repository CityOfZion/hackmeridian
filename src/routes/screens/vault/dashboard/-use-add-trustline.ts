import { useState } from 'react';

import { passPublicKey } from '@/api/stellar/account';
import { buildUsdcTrustline, submitPassTransaction } from '@/api/stellar/payment';
import { usePassTap } from '@/hooks/use-pass-tap';
import { apiErrorMessage } from '@/store/api/cards-api';
import { vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';

/**
 * Adds the USDC trustline the Pass's Stellar account needs before it can hold or send USDC: the Pass signs a
 * `changeTrust`, and the vault is refetched once it is in a closed ledger.
 */
export function useAddTrustline(chipId: string) {
  const dispatch = useAppDispatch();
  const { signWithPass, isTapping, error, setError } = usePassTap();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTrustline = async () => {
    setError(undefined);
    try {
      const trustline = await buildUsdcTrustline(await passPublicKey(chipId));
      const signed = await signWithPass('Hold your Pass near the phone to add USDC', trustline.hash, chipId);
      if (!signed) return;
      setIsSubmitting(true);
      await submitPassTransaction(trustline, signed.signature);
      dispatch(vaultApi.util.invalidateTags(['Vault']));
    } catch (trustlineError) {
      setError(apiErrorMessage(trustlineError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addTrustline, isTapping, isSubmitting, error };
}

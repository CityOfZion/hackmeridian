import { useState } from 'react';

import { passPublicKey } from '@/api/stellar/account';
import { buildEurcTrustline, submitPassTransaction } from '@/api/stellar/payment';
import { usePassTap } from '@/hooks/use-pass-tap';
import i18n from '@/i18n';
import { apiErrorMessage } from '@/store/api/cards-api';
import { vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';

/**
 * Adds the EURC trustline the Pass's Stellar account needs before it can hold or send EURC: the Pass signs a
 * `changeTrust`, and the vault is refetched once it is in a closed ledger.
 */
export function useAddTrustline(chipId: string) {
  const dispatch = useAppDispatch();
  const { signWithPass, isTapping, error, setError } = usePassTap();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTrustline = async () => {
    setError(undefined);
    try {
      const trustline = await buildEurcTrustline(await passPublicKey(chipId));
      const signed = await signWithPass(i18n.t('screens:vault.dashboard.trustlinePrompt'), trustline.hash, chipId);
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

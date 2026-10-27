import { useState } from 'react';

import { passPublicKey } from '@/api/stellar/account';
import { buildTrustline, submitPassTransaction } from '@/api/stellar/payment';
import type { PayAsset } from '@/constants';
import { usePassTap } from '@/hooks/use-pass-tap';
import i18n from '@/i18n';
import { apiErrorMessage } from '@/store/api/cards-api';
import { vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';

/**
 * Adds the trustline the Pass's Stellar account needs before it can hold or pay with an asset (EURC or USDC): the Pass
 * signs a `changeTrust`, and the vault is refetched once it is in a closed ledger.
 */
export function useAddTrustline(chipId: string) {
  const dispatch = useAppDispatch();
  const { signWithPass, isTapping, error, setError } = usePassTap();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Which asset's trustline is being added, for the button labels
  const [pending, setPending] = useState<PayAsset>();

  const addTrustline = async (code: PayAsset) => {
    setError(undefined);
    setPending(code);
    try {
      const trustline = await buildTrustline(await passPublicKey(chipId), code);
      const signed = await signWithPass(
        i18n.t('screens:vault.dashboard.trustlinePrompt', { asset: code }),
        trustline.hash,
        chipId,
      );
      if (!signed) return;
      setIsSubmitting(true);
      await submitPassTransaction(trustline, signed.signature);
      dispatch(vaultApi.util.invalidateTags(['Vault']));
    } catch (trustlineError) {
      setError(apiErrorMessage(trustlineError));
    } finally {
      setIsSubmitting(false);
      setPending(undefined);
    }
  };

  return { addTrustline, pending, isTapping, isSubmitting, error };
}

import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { passPublicKey } from '@/api/stellar/account';
import { buildFundPayment, submitPassTransaction } from '@/api/stellar/payment';
import { NfcRings } from '@/components/nfc/nfc-rings';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { CARD_ASSET_CODE, FUND_SLIPPAGE } from '@/constants';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery, useFundCardMutation } from '@/store/api/cards-api';
import { useGetFundQuoteQuery, vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';
import { formatAmount } from '@/utils/format';

import type { TVaultConfirmScreenParams } from './types';

type Step = 'signing' | 'paying' | 'funding';

/**
 * Confirms a fund: the Pass signs a payment of exactly `amount` EURC to the receiver, paid with EURC or with USDC
 * converted on Stellar's exchange (a path payment). Once it is
 * successful in a closed ledger, the card's bunq limit rises by the amount.
 */
export function VaultConfirmScreen({ route }: StaticScreenProps<TVaultConfirmScreenParams>) {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const chipId = useRequiredChipId();
  const { cardId, amount } = route.params;
  // Deep links may leave it out: pay with EURC then
  const payWith = route.params.payWith ?? CARD_ASSET_CODE;
  const converts = payWith !== CARD_ASSET_CODE;
  const { signWithPass, isTapping, error, setError } = usePassTap();
  const { data: cards } = useGetCardsQuery();
  const [fundCard] = useFundCardMutation();
  const [step, setStep] = useState<Step>();
  // Set once the payment is on-chain, so a retry after a bunq failure doesn't pay twice
  const [paidHash, setPaidHash] = useState<string>();
  // Indicative: buildFundPayment quotes again right before the tap and caps the spend at that quote + FUND_SLIPPAGE
  const quote = useGetFundQuoteQuery(paidHash || !converts ? skipToken : { amount, payWith });
  const busy = isTapping || step !== undefined;

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);

  const confirm = async () => {
    setError(undefined);
    try {
      let txHash = paidHash;
      if (!txHash) {
        setStep('signing');
        const publicKey = await passPublicKey(chipId);
        const payment = await buildFundPayment({ publicKey, amount, cardId, payWith });
        const signature = (await signWithPass(t('vault.confirm.tapPrompt'), payment.hash, chipId))?.signature;
        if (!signature) return;

        setStep('paying');
        txHash = await submitPassTransaction(payment, signature);
        setPaidHash(txHash);
        // The vault balance is on-chain: refetch it now that the payment is in a ledger
        dispatch(vaultApi.util.invalidateTags(['Vault']));
      }

      setStep('funding');
      try {
        await fundCard({ cardId, amount }).unwrap();
      } catch (fundError) {
        setError(t('vault.confirm.paidNotFunded', { reason: apiErrorMessage(fundError) }));
        return;
      }
      navigation.dispatch(StackActions.replace('(screens)/vault/result', { cardId, amount, txHash }));
    } catch (confirmError) {
      setError(apiErrorMessage(confirmError));
    } finally {
      setStep(undefined);
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{t('vault.confirm.eyebrow')}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{t('vault.confirm.title')}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        {/* Leaving mid-payment would drop the paid state that keeps a retry from paying twice */}
        {!busy && <ScreenLayout.BackButton />}
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-4">
          <NfcRings />
          <Eyebrow>{busy ? t('vault.confirm.confirming') : t('vault.confirm.waiting')}</Eyebrow>
          <Money amount={amount} size="xl" unit={CARD_ASSET_CODE} className="mt-2.5 font-outfit-semibold" />
          <AppText className="mt-2 text-center text-sm text-muted">
            {converts
              ? t('vault.confirm.instructionsConvert', { vault: payWith, asset: CARD_ASSET_CODE })
              : t('vault.confirm.instructions')}
          </AppText>
        </View>
        <InfoRows
          rows={[
            { label: t('vault.confirm.from'), value: t('vault.confirm.fromValue') },
            { label: t('vault.confirm.to'), value: card ? `${card.label.toUpperCase()} · •••• ${card.last4}` : '…' },
            { label: t('vault.confirm.amount'), value: `${formatAmount(amount)} ${CARD_ASSET_CODE}` },
            {
              label: t('vault.confirm.pay'),
              value: !converts
                ? `${formatAmount(amount)} ${payWith}`
                : quote.data
                  ? t('vault.confirm.payValue', {
                      cost: formatAmount(quote.data.sourceAmount),
                      max: formatAmount(quote.data.sourceAmount * (1 + FUND_SLIPPAGE)),
                      asset: payWith,
                    })
                  : '…',
            },
          ]}
        />
        {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label={
            step
              ? t(`vault.confirm.steps.${step}`)
              : paidHash
                ? t('vault.confirm.retry')
                : t('vault.confirm.tapToConfirm')
          }
          disabled={busy}
          onPress={confirm}
        />
        <Button
          variant="secondary"
          label={t('common:actions.cancel')}
          disabled={busy}
          onPress={() => navigation.goBack()}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

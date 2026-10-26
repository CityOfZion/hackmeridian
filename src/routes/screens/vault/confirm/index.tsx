import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { loadCredential } from '@/api/item/card-signing';
import { buildReloadPayment, submitReloadPayment } from '@/api/stellar/payment';
import { NfcRings } from '@/components/nfc/nfc-rings';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { ASSET_CODE } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery, useReloadCardMutation } from '@/store/api/cards-api';
import { useAppDispatch } from '@/store/hooks';
import { vaultDebited } from '@/store/slices/vault-slice';
import { formatAmount } from '@/utils/format';

import type { TVaultConfirmScreenParams } from './types';

type Step = 'signing' | 'paying' | 'reloading';

const STEP_LABELS: Record<Step, string> = {
  signing: 'Hold your Pass still…',
  paying: 'Confirming on Stellar…',
  reloading: 'Reloading card…',
};

/**
 * Confirms a reload: the Pass signs a USDC payment to the receiver on Stellar, then Face ID. Once the payment is
 * successful in a closed ledger, the card's bunq limit rises by the amount.
 */
export function VaultConfirmScreen({ route }: StaticScreenProps<TVaultConfirmScreenParams>) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const chipId = useRequiredChipId();
  const { cardId, amount } = route.params;
  const { signWithPass, isTapping, error, setError } = usePassTap();
  const { data: cards } = useGetCardsQuery();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [reloadCard] = useReloadCardMutation();
  const [step, setStep] = useState<Step>();
  // Set once the payment is on-chain, so a retry after a bunq failure doesn't pay twice
  const [paidHash, setPaidHash] = useState<string>();
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
        const payment = await buildReloadPayment({ publicKey, amount, cardId });
        const signature = (await signWithPass('Hold your Pass near the phone to sign the reload', payment.hash, chipId))
          ?.signature;
        if (!signature) return;
        if (!(await confirmWithBiometrics(`Confirm reload: ${formatAmount(amount)} ${ASSET_CODE}`))) return;

        setStep('paying');
        txHash = await submitReloadPayment(payment, signature);
        setPaidHash(txHash);
      }

      setStep('reloading');
      try {
        await reloadCard({ cardId, amount }).unwrap();
      } catch (reloadError) {
        setError(`Paid on Stellar, but bunq did not raise the limit: ${apiErrorMessage(reloadError)} Retry to reload.`);
        return;
      }
      dispatch(vaultDebited(amount));
      navigation.dispatch(StackActions.replace('(screens)/vault/result', { cardId, amount, txHash }));
    } catch (confirmError) {
      setError(confirmError instanceof BiometricError ? confirmError.message : apiErrorMessage(confirmError));
    } finally {
      setStep(undefined);
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>RELOAD</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Confirm reload</ScreenLayout.Title>
        </ScreenLayout.Heading>
        {/* Leaving mid-payment would drop the paid state that keeps a retry from paying twice */}
        {!busy && <ScreenLayout.BackButton />}
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-4">
          <NfcRings />
          <Eyebrow>{busy ? 'CONFIRMING' : 'WAITING FOR YOUR PASS'}</Eyebrow>
          <Money amount={amount} size="xl" className="mt-2.5 font-outfit-semibold" />
          <AppText className="mt-2 text-center text-sm text-muted">
            Tap your Pass to sign the payment on Stellar, then confirm with Face ID.
          </AppText>
        </View>
        <InfoRows
          rows={[
            { label: 'FROM', value: 'YOUR PASS · STELLAR' },
            { label: 'TO', value: card ? `${card.label.toUpperCase()} · •••• ${card.last4}` : '…' },
            { label: 'AMOUNT', value: `${formatAmount(amount)} ${ASSET_CODE}` },
          ]}
        />
        {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label={step ? STEP_LABELS[step] : paidHash ? 'Retry card reload' : 'Tap Pass to confirm'}
          disabled={busy}
          onPress={confirm}
        />
        <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => navigation.goBack()} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

/** The Ed25519 key pinned for this Pass at sign-in: the Stellar account the reload is paid from. */
async function passPublicKey(chipId: string): Promise<Uint8Array> {
  const credential = await loadCredential(chipId);
  if (!credential) throw new Error('Sign in with this Pass again to reload.');
  return Uint8Array.from(credential.publicKey.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

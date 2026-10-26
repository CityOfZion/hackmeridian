import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import type { TapResult } from '@/api/types';
import { NfcRings } from '@/components/nfc/nfc-rings';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { ASSET_CODE } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useRequiredSession } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useReloadMutation, useRequestWithdrawMutation } from '@/store/api/vault-api';
import { formatAmount, shortAddress } from '@/utils/format';

import type { TVaultConfirmScreenParams } from './types';

/** Two factors for anything that moves money: a fresh tap of the signed-in Pass, then Face ID. */
export function VaultConfirmScreen({ route }: StaticScreenProps<TVaultConfirmScreenParams>) {
  const navigation = useNavigation();
  const session = useRequiredSession();
  const params = route.params;
  const { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable } = usePassTap();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [reload] = useReloadMutation();
  const [requestWithdraw] = useRequestWithdrawMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = isTapping || isSubmitting;

  if (!session) return null;

  const title = params.action === 'reload' ? 'Confirm reload' : 'Confirm withdrawal';

  const confirm = async (tap: TapResult | null) => {
    if (!tap) return;
    if (tap.chipId !== session.chipId) {
      setError('This is not the Pass you signed in with.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!(await confirmWithBiometrics(`${title}: ${formatAmount(params.amount)} ${ASSET_CODE}`))) return;
      const activity =
        params.action === 'reload'
          ? await reload({ userId: session.userId, amount: params.amount, tapToken: tap.tapToken }).unwrap()
          : await requestWithdraw({
              userId: session.userId,
              amount: params.amount,
              destination: params.destination,
              tapToken: tap.tapToken,
            }).unwrap();
      navigation.dispatch(StackActions.replace('(screens)/vault/result', { activityId: activity.id }));
    } catch (confirmError) {
      setError(confirmError instanceof BiometricError ? confirmError.message : apiErrorMessage(confirmError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{params.action === 'reload' ? 'RELOAD' : 'WITHDRAW'}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{title}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-4">
          <NfcRings />
          <Eyebrow>{busy ? 'CONFIRMING' : 'WAITING FOR YOUR PASS'}</Eyebrow>
          <Money amount={params.amount} size="xl" className="mt-2.5 font-outfit-semibold" />
          <AppText className="mt-2 text-center text-sm text-muted">Tap your Pass, then confirm with Face ID.</AppText>
        </View>
        <InfoRows
          rows={
            params.action === 'reload'
              ? [
                  { label: 'PAY WITH', value: 'MERCURYO · EUR' },
                  { label: 'RECEIVE', value: `${formatAmount(params.amount)} ${ASSET_CODE}` },
                  { label: 'THEN', value: 'DEPOSIT TO VAULT' },
                ]
              : [
                  { label: 'TO', value: shortAddress(params.destination) },
                  { label: 'AMOUNT', value: `${formatAmount(params.amount)} ${ASSET_CODE}` },
                  { label: 'EXECUTES', value: 'AFTER WITHDRAW DELAY' },
                ]
          }
        />
        {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {isNfiScanAvailable === false && __DEV__ ? (
          // No NFC reader (iOS simulator, emulators): tap with the signed-in chip ID.
          <Button
            icon="tap"
            label="Simulate tap"
            disabled={busy}
            onPress={async () => confirm(await simulateTap(session.chipId))}
          />
        ) : (
          <Button
            icon="tap"
            label={busy ? 'Confirming…' : 'Tap Pass to confirm'}
            disabled={busy || !isNfiScanAvailable}
            onPress={async () => confirm(await tapPass(`Hold your Pass near the phone to ${title.toLowerCase()}`))}
          />
        )}
        <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => navigation.goBack()} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

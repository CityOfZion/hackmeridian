import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { NfcRings } from '@/components/nfc/nfc-rings';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { ASSET_CODE, DEV_CHIP_ID } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery, useReloadCardMutation } from '@/store/api/cards-api';
import { useAppDispatch } from '@/store/hooks';
import { vaultDebited } from '@/store/slices/vault-slice';
import { formatAmount } from '@/utils/format';

import type { TVaultConfirmScreenParams } from './types';

/**
 * Confirms a card reload with the spec's two factors: a fresh tap of the scanned Pass, then Face ID (standing in for
 * the passkey). Then the card's bunq limit rises.
 */
export function VaultConfirmScreen({ route }: StaticScreenProps<TVaultConfirmScreenParams>) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const chipId = useRequiredChipId();
  const { cardId, amount } = route.params;
  const { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable } = usePassTap();
  const { data: cards } = useGetCardsQuery();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [reloadCard] = useReloadCardMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = isTapping || isSubmitting;

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);

  const confirm = async (tappedChipId: string | null) => {
    if (!tappedChipId) return;
    if (tappedChipId !== chipId) {
      setError('This is not the Pass you scanned.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!(await confirmWithBiometrics(`Confirm reload: ${formatAmount(amount)} ${ASSET_CODE}`))) return;
      await reloadCard({ cardId, amount }).unwrap();
      dispatch(vaultDebited(amount));
      navigation.dispatch(StackActions.replace('(screens)/vault/result', { cardId, amount }));
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
          <ScreenLayout.Eyebrow>RELOAD</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Confirm reload</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-4">
          <NfcRings />
          <Eyebrow>{busy ? 'CONFIRMING' : 'WAITING FOR YOUR PASS'}</Eyebrow>
          <Money amount={amount} size="xl" className="mt-2.5 font-outfit-semibold" />
          <AppText className="mt-2 text-center text-sm text-muted">Tap your Pass, then confirm with Face ID.</AppText>
        </View>
        <InfoRows
          rows={[
            { label: 'FROM', value: 'SPEND VAULT' },
            { label: 'TO', value: card ? `${card.label.toUpperCase()} · •••• ${card.last4}` : '…' },
            { label: 'AMOUNT', value: `${formatAmount(amount)} ${ASSET_CODE}` },
          ]}
        />
        {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label={isTapping ? 'Hold your Pass still…' : busy ? 'Confirming…' : 'Tap Pass to confirm'}
          disabled={busy}
          onPress={async () => confirm(await tapPass('Hold your Pass near the phone to confirm the reload'))}
        />
        {(chipId === DEV_CHIP_ID || (isNfiScanAvailable === false && __DEV__)) && (
          // Opened with "Simulate scan", or no NFC reader (iOS simulator, emulators): tap with the scanned chip ID.
          <Button
            variant="secondary"
            label="Simulate scan"
            disabled={busy}
            onPress={async () => confirm(await simulateTap(chipId))}
          />
        )}
        <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => navigation.goBack()} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

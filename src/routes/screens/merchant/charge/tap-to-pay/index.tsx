import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { ScreenLayout } from '@/layouts/screen-layout';
import { CURRENT_HOLDER_ID, MERCHANT_NAME } from '@/constants';
import { NfiScanError, useScanItemNfi } from '@/hooks/use-item-nfi';
import { useAppDispatch } from '@/store/hooks';
import { draftAmountCleared } from '@/store/slices/merchant-slice';
import { chargeCard } from '@/store/thunks/payments';
import { formatUsdc } from '@/utils/format';

import { NfcRings } from './-nfc-rings';
import type { TMerchantChargeTapToPayScreenParams } from './types';

export function MerchantChargeTapToPayScreen({ route }: StaticScreenProps<TMerchantChargeTapToPayScreenParams>) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { amount } = route.params;
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>();

  const charge = (nfiUid?: string) => {
    // The demo terminal always charges the Card Holder role's account.
    const transaction = dispatch(chargeCard({ holderId: CURRENT_HOLDER_ID, amount, nfiUid }));
    dispatch(draftAmountCleared());
    navigation.dispatch(StackActions.replace('(screens)/merchant/charge/result', { transactionId: transaction.id }));
  };

  const scan = async () => {
    setError(undefined);
    setIsScanning(true);

    try {
      const card = await scanItemNfi(`Hold the NFI near the device to pay ${formatUsdc(amount)} USDC`);
      if (card) charge(card.uid);
    } catch (scanError) {
      setError(scanError instanceof NfiScanError ? scanError.message : 'Could not read the card.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{MERCHANT_NAME.toUpperCase()}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Ready for tap</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-6">
          <NfcRings />
          <Eyebrow>{isScanning ? 'READING CARD' : 'TERMINAL ARMED'}</Eyebrow>
          <AppText className="my-2.5 text-center font-outfit-semibold text-4xl leading-none tracking-tight">
            Ask customer to tap card
          </AppText>
          <Money amount={amount} size="lg" className="font-outfit-semibold" />
          <AppText className="mt-2 text-sm text-muted">Hold the card near the top of this device.</AppText>
          {error && <AppText className="mt-4 text-center text-sm text-danger">{error}</AppText>}
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {isNfiScanAvailable === false && __DEV__ ? (
          // No NFC reader (iOS simulator, emulators): keep the flow testable without a card.
          <Button label="Simulate card tap" onPress={() => charge()} />
        ) : (
          <Button label="Scan card" disabled={isScanning || !isNfiScanAvailable} onPress={scan} />
        )}
        <Button variant="secondary" label="Cancel" onPress={() => navigation.goBack()} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

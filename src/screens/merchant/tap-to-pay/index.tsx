import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { NfcRings } from './nfc-rings';
import { AppText, Eyebrow } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { Money } from '../../../components/ui/money';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { CURRENT_HOLDER_ID, MERCHANT_NAME } from '../../../constants';
import { useAppDispatch } from '../../../store/hooks';
import { draftAmountCleared } from '../../../store/slices/merchant-slice';
import { chargeCard } from '../../../store/thunks/payments';

type Props = StaticScreenProps<{ amount: number }>;

export function TapToPayScreen({ route }: Props) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { amount } = route.params;

  const simulateTap = () => {
    // The demo terminal always reads the Card Holder role's card.
    const transaction = dispatch(chargeCard({ holderId: CURRENT_HOLDER_ID, amount }));
    dispatch(draftAmountCleared());
    navigation.dispatch(StackActions.replace('PaymentResult', { transactionId: transaction.id }));
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
          <Eyebrow>TERMINAL ARMED</Eyebrow>
          <AppText className="my-2.5 text-center font-outfit-semibold text-4xl leading-none tracking-tight">
            Ask customer to tap card
          </AppText>
          <Money amount={amount} size="lg" className="font-outfit-semibold" />
          <AppText className="mt-2 text-sm text-muted">Hold the card near the top of this device.</AppText>
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button label="Simulate card tap" onPress={simulateTap} />
        <Button variant="secondary" label="Cancel" onPress={() => navigation.goBack()} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

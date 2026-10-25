import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { NfcRings } from '../../components/NfcRings';
import { AppText, Eyebrow } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { Screen } from '../../components/ui/Screen';
import { CURRENT_HOLDER_ID, MERCHANT_NAME } from '../../constants';
import { useAppDispatch } from '../../store/hooks';
import { draftAmountCleared } from '../../store/slices/merchantSlice';
import { chargeCard } from '../../store/thunks/payments';

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
    <Screen eyebrow={MERCHANT_NAME.toUpperCase()} title="Ready for tap" canGoBack>
      <View className="items-center pt-6">
        <NfcRings />
        <Eyebrow>TERMINAL ARMED</Eyebrow>
        <AppText className="my-2.5 text-center font-outfit-semibold text-[34px] leading-[34px] tracking-[-1px]">
          Ask customer to tap card
        </AppText>
        <Money amount={amount} size={28} className="font-outfit-semibold" />
        <AppText className="mb-6 mt-2 text-[13px] text-muted">Hold the card near the top of this device.</AppText>
      </View>
      <View className="gap-2.5">
        <Button label="Simulate card tap" onPress={simulateTap} />
        <Button variant="secondary" label="Cancel" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

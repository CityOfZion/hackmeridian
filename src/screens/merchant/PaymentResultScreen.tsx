import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { AppText, Eyebrow } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { InfoRows } from '../../components/ui/InfoRows';
import { Money } from '../../components/ui/Money';
import { ResultBadge } from '../../components/ui/ResultBadge';
import { Screen } from '../../components/ui/Screen';
import { StatusPill } from '../../components/ui/StatusPill';
import { MERCHANT_NAME } from '../../constants';
import { useAppSelector } from '../../store/hooks';
import { selectTransactionById } from '../../store/slices/transactionsSlice';
import { formatClock } from '../../utils/format';

type Props = StaticScreenProps<{ transactionId: string }>;

export function PaymentResultScreen({ route }: Props) {
  const navigation = useNavigation();
  const transaction = useAppSelector((state) => selectTransactionById(state, route.params.transactionId));
  const success = transaction.status === 'SETTLED';

  return (
    <Screen eyebrow={MERCHANT_NAME.toUpperCase()} title="Payment result">
      <View className="items-center pt-8">
        <ResultBadge icon={success ? 'check' : 'close'} tone={success ? 'success' : 'danger'} />
        <Eyebrow>{success ? 'AUTHORIZATION CONFIRMED' : 'PAYMENT REFUSED'}</Eyebrow>
        <AppText className="my-2.5 font-outfit-semibold text-[34px] tracking-[-1px]">
          {success ? 'Payment accepted' : 'Payment declined'}
        </AppText>
        <Money amount={transaction.amount} size={28} className="font-outfit-semibold" />
        {!success && <StatusPill value={transaction.reason ?? 'DECLINED'} className="mt-3 self-center" />}
      </View>
      <InfoRows
        rows={[
          { label: 'MERCHANT', value: transaction.merchant.toUpperCase() },
          { label: 'TIME', value: formatClock(transaction.createdAt) },
          { label: 'TRANSACTION', value: transaction.id },
        ]}
      />
      <Button label="New charge" onPress={() => navigation.dispatch(StackActions.popToTop())} />
    </Screen>
  );
}

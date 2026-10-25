import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { AppText, Eyebrow } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { InfoRows } from '../../../components/ui/info-rows';
import { Money } from '../../../components/ui/money';
import { ResultBadge } from '../../../components/ui/result-badge';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { StatusPill } from '../../../components/ui/status-pill';
import { MERCHANT_NAME } from '../../../constants';
import { useAppSelector } from '../../../store/hooks';
import { selectTransactionById } from '../../../store/slices/transactions-slice';
import { formatClock } from '../../../utils/format';

type Props = StaticScreenProps<{ transactionId: string }>;

export function PaymentResultScreen({ route }: Props) {
  const navigation = useNavigation();
  const transaction = useAppSelector((state) => selectTransactionById(state, route.params.transactionId));
  const success = transaction.status === 'SETTLED';

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{MERCHANT_NAME.toUpperCase()}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Payment result</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-8">
          <ResultBadge icon={success ? 'check' : 'close'} tone={success ? 'success' : 'danger'} />
          <Eyebrow>{success ? 'AUTHORIZATION CONFIRMED' : 'PAYMENT REFUSED'}</Eyebrow>
          <AppText className="my-2.5 font-outfit-semibold text-4xl tracking-tight">
            {success ? 'Payment accepted' : 'Payment declined'}
          </AppText>
          <Money amount={transaction.amount} size="lg" className="font-outfit-semibold" />
          {!success && <StatusPill value={transaction.reason ?? 'DECLINED'} className="mt-3 self-center" />}
        </View>
        <InfoRows
          rows={[
            { label: 'MERCHANT', value: transaction.merchant.toUpperCase() },
            { label: 'TIME', value: formatClock(transaction.createdAt) },
            { label: 'TRANSACTION', value: transaction.id },
          ]}
        />
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button label="New charge" onPress={() => navigation.dispatch(StackActions.popToTop())} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}

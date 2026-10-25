import { View } from 'react-native';

import { TransactionRow } from '../../../components/rows/transaction-row';
import { AppText } from '../../../components/ui/app-text';
import { Money } from '../../../components/ui/money';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { SectionTitle } from '../../../components/ui/section-title';
import { MERCHANT_NAME } from '../../../constants';
import { useAppSelector } from '../../../store/hooks';
import { selectMerchantLedgerToday, selectMerchantSettledToday } from '../../../store/selectors';
import { pluralize } from '../../../utils/format';

export function SummaryScreen() {
  const ledger = useAppSelector(selectMerchantLedgerToday);
  const settled = useAppSelector(selectMerchantSettledToday);

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{MERCHANT_NAME.toUpperCase()}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Today's summary</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-1.5 rounded-lg bg-brass px-5 py-6.5">
          <AppText className="text-2xs tracking-widest text-[#332f0b]">ACCEPTED VOLUME</AppText>
          <Money
            amount={settled.volume}
            size="2xl"
            className="font-outfit-semibold tracking-tighter text-[#111]"
            unitClassName="text-[#111]"
          />
          <AppText className="text-sm text-[#332f0b]">{pluralize(settled.count, 'accepted payment')}</AppText>
        </View>
        <SectionTitle title="Payment ledger" />
        <View className="border-t border-[#444]">
          {ledger.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
          {ledger.length === 0 && (
            <AppText className="py-6 text-center text-sm text-muted">No payments yet today.</AppText>
          )}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}

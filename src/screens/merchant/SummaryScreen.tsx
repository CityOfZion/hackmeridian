import { View } from 'react-native';

import { TransactionRow } from '../../components/rows/TransactionRow';
import { AppText } from '../../components/ui/AppText';
import { Money } from '../../components/ui/Money';
import { Screen } from '../../components/ui/Screen';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { MERCHANT_NAME } from '../../constants';
import { useAppSelector } from '../../store/hooks';
import { selectMerchantLedgerToday, selectMerchantSettledToday } from '../../store/selectors';
import { pluralize } from '../../utils/format';

export function SummaryScreen() {
  const ledger = useAppSelector(selectMerchantLedgerToday);
  const settled = useAppSelector(selectMerchantSettledToday);

  return (
    <Screen eyebrow={MERCHANT_NAME.toUpperCase()} title="Today's summary">
      <View className="gap-1.5 rounded-lg bg-brass px-5 py-[26px]">
        <AppText className="text-[10px] tracking-[1px] text-[#332f0b]">ACCEPTED VOLUME</AppText>
        <Money amount={settled.volume} size={44} className="font-outfit-semibold tracking-[-2px] text-[#111]" unitClassName="text-[#111]" />
        <AppText className="text-[13px] text-[#332f0b]">{pluralize(settled.count, 'accepted payment')}</AppText>
      </View>
      <SectionTitle title="Payment ledger" />
      <View className="border-t border-[#444]">
        {ledger.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))}
        {ledger.length === 0 && <AppText className="py-6 text-center text-[13px] text-muted">No payments yet today.</AppText>}
      </View>
    </Screen>
  );
}

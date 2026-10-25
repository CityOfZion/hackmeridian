import { View } from 'react-native';

import { TransactionRow } from '../../components/rows/TransactionRow';
import { AppText } from '../../components/ui/AppText';
import { Screen } from '../../components/ui/Screen';
import { StatusPill } from '../../components/ui/StatusPill';
import { useCurrentHolder } from '../../hooks/useCurrentHolder';
import { pluralize } from '../../utils/format';

export function ActivityScreen() {
  const { transactions } = useCurrentHolder();

  return (
    <Screen eyebrow="CARD HOLDER" title="Transactions">
      <View className="mb-[18px] flex-row items-center justify-between">
        <StatusPill value="ALL ACTIVITY" />
        <AppText className="text-[9px] text-[#777]">{pluralize(transactions.length, 'record')}</AppText>
      </View>
      <View className="border-t border-[#444]">
        {transactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))}
      </View>
    </Screen>
  );
}

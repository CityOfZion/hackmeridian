import { View } from 'react-native';

import { TransactionRow } from '@/components/rows/transaction-row';
import { AppText } from '@/components/ui/app-text';
import { ScreenLayout } from '@/layouts/screen-layout';
import { StatusPill } from '@/components/ui/status-pill';
import { useCurrentHolder } from '@/hooks/use-current-holder';
import { pluralize } from '@/utils/format';

export function CardHolderActivityScreen() {
  const { transactions } = useCurrentHolder();

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>CARD HOLDER</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Transactions</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-4.5 flex-row items-center justify-between">
          <StatusPill value="ALL ACTIVITY" />
          <AppText className="text-3xs text-[#777]">{pluralize(transactions.length, 'record')}</AppText>
        </View>
        <View className="border-t border-[#444]">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}

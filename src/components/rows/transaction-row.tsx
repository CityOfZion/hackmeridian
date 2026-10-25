import { View } from 'react-native';

import type { Transaction } from '@/store/slices/transactions-slice';
import { cn } from '@/utils/cn';
import { formatTransactionTime, formatUsdc } from '@/utils/format';
import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const settled = transaction.status === 'SETTLED';
  return (
    <View className="flex-row items-center gap-3 border-b border-[#333] py-3.5">
      <View
        className={cn('size-8.5 items-center justify-center rounded-full', settled ? 'bg-[#17241d]' : 'bg-[#28191a]')}
      >
        <Icon name={settled ? 'check' : 'close'} color={settled ? '#65ac80' : '#c25b5b'} />
      </View>
      <View className="min-w-0 flex-1">
        <AppText className="text-sm">{transaction.merchant}</AppText>
        <AppText className="mt-1.25 text-2xs text-[#777]">
          {formatTransactionTime(transaction.createdAt)} · {transaction.id}
        </AppText>
        {transaction.reason && <StatusPill value={transaction.reason} className="mt-1.75" />}
      </View>
      <AppText className="text-xs">
        {settled ? '-' : ''}
        {formatUsdc(transaction.amount)}
      </AppText>
    </View>
  );
}

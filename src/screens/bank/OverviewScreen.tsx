import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { FeedRow } from '../../components/rows/FeedRow';
import { AppText } from '../../components/ui/AppText';
import { Money } from '../../components/ui/Money';
import { Screen } from '../../components/ui/Screen';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAppSelector } from '../../store/hooks';
import { selectCardStateCounts, selectNetworkSettledToday } from '../../store/selectors';
import { selectAllTransactions } from '../../store/slices/transactionsSlice';
import { cn } from '../../utils/cn';
import { formatAge, formatUsdc, pluralize } from '../../utils/format';

const FEED_SIZE = 4;

export function OverviewScreen() {
  const navigation = useNavigation();
  const settledToday = useAppSelector(selectNetworkSettledToday);
  const counts = useAppSelector(selectCardStateCounts);
  const recent = useAppSelector(selectAllTransactions).slice(0, FEED_SIZE);

  const metrics = [
    { label: 'ISSUED', value: counts.issued },
    { label: 'ACTIVE', value: counts.active },
    { label: 'LOCKED', value: counts.locked },
    { label: 'SUSPENDED', value: counts.suspended },
  ];

  return (
    <Screen eyebrow="BANK OWNER" title="Network overview">
      <View className="mb-6 gap-1.5 rounded-[9px] bg-brass px-5 py-[26px]">
        <AppText className="text-[10px] tracking-[1px] text-black">SETTLED TODAY</AppText>
        <Money amount={settledToday.volume} size={44} className="font-outfit-semibold tracking-[-2px] text-black" unitClassName="text-black" />
        <AppText className="text-[13px] text-black">{pluralize(settledToday.count, 'accepted payment')}</AppText>
      </View>

      <View className="flex-row flex-wrap border-y border-[#343434]">
        {metrics.map((metric, index) => (
          <View
            key={metric.label}
            className={cn(
              'w-1/2 py-5',
              index % 2 === 0 ? 'border-r border-[#343434]' : 'pl-5',
              index < 2 && 'border-b border-[#343434]',
            )}
          >
            <AppText className="text-[10px] text-muted">{metric.label}</AppText>
            <AppText className="mt-1.5 text-[32px] tracking-[-1px]">{metric.value}</AppText>
          </View>
        ))}
      </View>

      <SectionTitle
        title="Recent activity"
        action="View cards"
        onActionPress={() => navigation.navigate('Bank', { screen: 'Cards' })}
      />
      <View className="border-t border-[#444]">
        {recent.map((tx) => (
          <FeedRow
            key={tx.id}
            icon={tx.status === 'SETTLED' ? 'check' : 'close'}
            title={tx.status === 'SETTLED' ? 'Payment settled' : `Payment declined · ${tx.reason}`}
            meta={`${tx.merchant} · ${formatUsdc(tx.amount)} USDC`}
            time={formatAge(tx.createdAt)}
          />
        ))}
      </View>
    </Screen>
  );
}

import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { FeedRow } from '../../../components/rows/feed-row';
import { AppText } from '../../../components/ui/app-text';
import { Money } from '../../../components/ui/money';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { SectionTitle } from '../../../components/ui/section-title';
import { useAppSelector } from '../../../store/hooks';
import { selectCardStateCounts, selectNetworkSettledToday } from '../../../store/selectors';
import { selectAllTransactions } from '../../../store/slices/transactions-slice';
import { cn } from '../../../utils/cn';
import { formatAge, formatUsdc, pluralize } from '../../../utils/format';

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
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>BANK OWNER</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Network overview</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-6 gap-1.5 rounded-lg bg-brass px-5 py-6.5">
          <AppText className="text-2xs tracking-widest text-black">SETTLED TODAY</AppText>
          <Money amount={settledToday.volume} size="2xl" className="font-outfit-semibold tracking-tighter text-black" unitClassName="text-black" />
          <AppText className="text-sm text-black">{pluralize(settledToday.count, 'accepted payment')}</AppText>
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
              <AppText className="text-2xs text-muted">{metric.label}</AppText>
              <AppText className="mt-1.5 text-3xl tracking-tight">{metric.value}</AppText>
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
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}

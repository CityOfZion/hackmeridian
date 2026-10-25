import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { PhysicalCard } from '../../../components/card/physical-card';
import { TransactionRow } from '../../../components/rows/transaction-row';
import { AppText } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { Money } from '../../../components/ui/money';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { SectionTitle } from '../../../components/ui/section-title';
import { useCurrentHolder } from '../../../hooks/use-current-holder';
import { formatUsdc, greeting } from '../../../utils/format';

export function CardHomeScreen() {
  const navigation = useNavigation();
  const { holder, spentToday, remainingToday, transactions } = useCurrentHolder();
  const locked = holder.state === 'LOCKED';
  const firstName = holder.name.split(' ')[0];
  const progress = holder.dailyLimit > 0 ? Math.min(100, (spentToday / holder.dailyLimit) * 100) : 0;

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>CARD HOLDER</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{`${greeting()}, ${firstName}`}</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <PhysicalCard state={holder.state} design={holder.design} />

        <View className="flex-row items-end justify-between py-5.5">
          <View>
            <AppText className="text-2xs tracking-widest text-muted">AVAILABLE BALANCE</AppText>
            <Money amount={holder.balance} size="md" className="mt-1.25" />
          </View>
          <AppText className="text-3xs">{holder.account}</AppText>
        </View>

        <View className="border border-line bg-panel p-3.75">
          <View className="flex-row justify-between">
            <AppText className="text-2xs tracking-widest text-muted">TODAY'S SPEND</AppText>
            <AppText className="font-outfit-semibold text-xs">
              {formatUsdc(spentToday)} / {formatUsdc(holder.dailyLimit)}
            </AppText>
          </View>
          <View className="mb-2.25 mt-3.25 h-0.75 bg-[#303033]">
            <View className="h-full bg-brass" style={{ width: `${progress}%` }} />
          </View>
          <AppText className="text-2xs text-[#777]">{formatUsdc(remainingToday)} USDC remaining</AppText>
        </View>

        <View className="mt-3 flex-row gap-2.25">
          <Button
            className="flex-1"
            icon="lock"
            variant={locked ? 'primary' : 'secondary'}
            label={locked ? 'Unlock card' : 'Lock card'}
            disabled={holder.state === 'SUSPENDED'}
            onPress={() => navigation.navigate('LockCard')}
          />
          <Button
            className="flex-1"
            variant="secondary"
            label="Set limit"
            onPress={() => navigation.navigate('CardHolder', { screen: 'Card', params: { screen: 'SpendLimit' } })}
          />
        </View>
        {holder.state === 'SUSPENDED' && (
          <AppText className="mt-3 text-xs text-[#d37a7a]">Your bank has suspended this card. Contact your issuer to restore it.</AppText>
        )}

        <SectionTitle
          title="Recent transactions"
          action="View all"
          onActionPress={() => navigation.navigate('CardHolder', { screen: 'Activity' })}
        />
        {transactions[0] && <TransactionRow transaction={transactions[0]} />}
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}

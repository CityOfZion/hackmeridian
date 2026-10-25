import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { PhysicalCard } from '../../components/card/PhysicalCard';
import { TransactionRow } from '../../components/rows/TransactionRow';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { Screen } from '../../components/ui/Screen';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useCurrentHolder } from '../../hooks/useCurrentHolder';
import { formatUsdc, greeting } from '../../utils/format';

export function CardHomeScreen() {
  const navigation = useNavigation();
  const { holder, spentToday, remainingToday, transactions } = useCurrentHolder();
  const locked = holder.state === 'LOCKED';
  const firstName = holder.name.split(' ')[0];
  const progress = holder.dailyLimit > 0 ? Math.min(100, (spentToday / holder.dailyLimit) * 100) : 0;

  return (
    <Screen eyebrow="CARD HOLDER" title={`${greeting()}, ${firstName}`}>
      <PhysicalCard state={holder.state} design={holder.design} />

      <View className="flex-row items-end justify-between py-[22px]">
        <View>
          <AppText className="text-[10px] tracking-[1px] text-muted">AVAILABLE BALANCE</AppText>
          <Money amount={holder.balance} size={24} className="mt-[5px]" />
        </View>
        <AppText className="text-[9px]">{holder.account}</AppText>
      </View>

      <View className="border border-line bg-panel p-[15px]">
        <View className="flex-row justify-between">
          <AppText className="text-[10px] tracking-[1px] text-muted">TODAY'S SPEND</AppText>
          <AppText className="font-outfit-semibold text-[11px]">
            {formatUsdc(spentToday)} / {formatUsdc(holder.dailyLimit)}
          </AppText>
        </View>
        <View className="mb-[9px] mt-[13px] h-[3px] bg-[#303033]">
          <View className="h-full bg-brass" style={{ width: `${progress}%` }} />
        </View>
        <AppText className="text-[10px] text-[#777]">{formatUsdc(remainingToday)} USDC remaining</AppText>
      </View>

      <View className="mt-3 flex-row gap-[9px]">
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
        <AppText className="mt-3 text-[11px] text-[#d37a7a]">Your bank has suspended this card. Contact your issuer to restore it.</AppText>
      )}

      <SectionTitle
        title="Recent transactions"
        action="View all"
        onActionPress={() => navigation.navigate('CardHolder', { screen: 'Activity' })}
      />
      {transactions[0] && <TransactionRow transaction={transactions[0]} />}
    </Screen>
  );
}

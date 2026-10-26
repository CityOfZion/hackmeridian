import { View } from 'react-native';

import type { Activity, ActivityKind } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/utils/cn';
import { formatAmount, formatCountdown, formatTransactionTime, shortAddress } from '@/utils/format';

const kinds: Record<ActivityKind, { icon: IconName; title: string; sign: string }> = {
  buy: { icon: 'card', title: 'Bought with Mercuryo', sign: '' },
  deposit: { icon: 'down', title: 'Deposit to vault', sign: '+' },
  withdraw: { icon: 'up', title: 'Withdrawal', sign: '-' },
};

export function ActivityRow({ activity, now }: { activity: Activity; now: number }) {
  const kind = kinds[activity.kind];
  const pending = activity.status === 'pending';
  const detail =
    activity.kind === 'withdraw' && activity.destination
      ? `To ${shortAddress(activity.destination)}`
      : activity.kind === 'buy'
        ? activity.ref
        : activity.id;

  return (
    <View className="flex-row items-center gap-3 border-b border-[#333] py-3.5">
      <View
        className={cn(
          'size-8.5 items-center justify-center rounded-full',
          activity.status === 'failed' ? 'bg-[#28191a]' : pending ? 'bg-[#2a2614]' : 'bg-[#17241d]',
        )}
      >
        <Icon name={pending ? 'clock' : kind.icon} color={pending ? '#fbd51f' : '#65ac80'} />
      </View>
      <View className="min-w-0 flex-1">
        <AppText className="text-sm">{kind.title}</AppText>
        <AppText className="mt-1.25 text-2xs text-[#777]">
          {formatTransactionTime(activity.createdAt, now)} · {detail}
        </AppText>
        {pending && activity.availableAt && (
          <StatusPill value={`PENDING · ${formatCountdown(activity.availableAt, now)}`} className="mt-1.75" />
        )}
        {activity.status === 'failed' && <StatusPill value="FAILED" className="mt-1.75" />}
      </View>
      <AppText className={cn('text-xs', activity.kind === 'buy' && 'text-muted')}>
        {kind.sign}
        {formatAmount(activity.amount)}
      </AppText>
    </View>
  );
}

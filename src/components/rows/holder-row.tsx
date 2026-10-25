import { Pressable, View } from 'react-native';

import type { Holder } from '@/store/slices/holders-slice';
import { colors } from '@/theme/colors';
import { initials, shortCardId } from '@/utils/format';
import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';

export function HolderRow({ holder, onPress }: { holder: Holder; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-2.75 border-b border-[#333] py-3.75 active:opacity-70"
    >
      <View className="size-10 items-center justify-center bg-brass">
        <AppText className="text-xs text-[#111]">{initials(holder.name)}</AppText>
      </View>
      <View className="flex-1">
        <AppText>{holder.name}</AppText>
        <AppText className="mt-1.25 text-4xs text-[#777]">
          {shortCardId(holder.cardId)} · {holder.dailyLimit} USDC/DAY
        </AppText>
      </View>
      <StatusPill value={holder.state} className="self-center" />
      <Icon name="arrow" size={16} color={colors.paper} />
    </Pressable>
  );
}

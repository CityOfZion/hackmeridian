import { Pressable, View } from 'react-native';

import type { Holder } from '../../store/slices/holdersSlice';
import { colors } from '../../theme/colors';
import { initials, shortCardId } from '../../utils/format';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { StatusPill } from '../ui/StatusPill';

export function HolderRow({ holder, onPress }: { holder: Holder; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-[11px] border-b border-[#333] py-[15px] active:opacity-70"
    >
      <View className="size-10 items-center justify-center bg-brass">
        <AppText className="text-[11px] text-[#111]">{initials(holder.name)}</AppText>
      </View>
      <View className="flex-1">
        <AppText>{holder.name}</AppText>
        <AppText className="mt-[5px] text-[8px] text-[#777]">
          {shortCardId(holder.cardId)} · {holder.dailyLimit} USDC/DAY
        </AppText>
      </View>
      <StatusPill value={holder.state} className="self-center" />
      <Icon name="arrow" size={16} color={colors.paper} />
    </Pressable>
  );
}

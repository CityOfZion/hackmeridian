import { View } from 'react-native';

import { AppText } from '../ui/app-text';
import { Icon, type IconName } from '../ui/icon';

type Props = { icon: IconName; title: string; meta: string; time: string };

export function FeedRow({ icon, title, meta, time }: Props) {
  return (
    <View className="flex-row items-center gap-3 border-b border-[#333] py-3.5">
      <View className="size-10.5 items-center justify-center rounded-full bg-brass">
        <Icon name={icon} color="#111" />
      </View>
      <View className="min-w-0 flex-1">
        <AppText className="text-sm">{title}</AppText>
        <AppText className="mt-1.25 text-2xs text-[#777]">{meta}</AppText>
      </View>
      <AppText className="text-xs text-[#666]">{time}</AppText>
    </View>
  );
}

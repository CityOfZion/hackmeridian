import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  title: string;
  action?: string;
  onActionPress?: () => void;
};

export function SectionTitle({ title, action, onActionPress }: Props) {
  return (
    <View className="mb-3 mt-[34px] flex-row items-center justify-between">
      <AppText className="font-outfit-semibold text-[24px] leading-[24px] tracking-[-0.8px]">{title}</AppText>
      {action && (
        <Pressable
          onPress={onActionPress}
          className="flex-row items-center rounded-full border border-brass py-1.5 pl-2.5 pr-1.5 active:opacity-70"
        >
          <AppText className="text-[11px] text-brass">{action}</AppText>
          <Icon name="arrow" size={15} />
        </Pressable>
      )}
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type Props = {
  title: string;
  action?: string;
  actionIcon?: IconName;
  onActionPress?: () => void;
};

export function SectionTitle({ title, action, actionIcon = 'plus', onActionPress }: Props) {
  return (
    <View className="mt-8.5 mb-3 flex-row items-center justify-between">
      <AppText className="font-outfit-semibold text-2xl leading-none tracking-tight">{title}</AppText>
      {action && (
        <Pressable
          onPress={onActionPress}
          className="flex-row items-center rounded-full border border-brass py-1.5 pr-1.5 pl-2.5 active:opacity-70"
        >
          <AppText className="text-xs text-brass">{action}</AppText>
          <Icon name={actionIcon} size={15} />
        </Pressable>
      )}
    </View>
  );
}

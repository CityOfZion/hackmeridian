import { Pressable, View } from 'react-native';

import { cn } from '../../utils/cn';
import { AppText } from '../ui/AppText';

type Props = {
  title: string;
  value?: string;
  toggle?: { value: boolean; onChange: () => void };
};

export function SettingRow({ title, value, toggle }: Props) {
  return (
    <View className="min-h-[76px] flex-row items-center justify-between border-b border-[#444]">
      <View>
        <AppText className="text-[13px]">{title}</AppText>
        <AppText className="mt-[5px] text-[10px] text-[#777]">Network policy</AppText>
      </View>
      {toggle ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: toggle.value }}
          onPress={toggle.onChange}
          className={cn('h-6 w-[43px] rounded-full p-[3px]', toggle.value ? 'items-end bg-[#315c44]' : 'items-start bg-[#3a3a3e]')}
        >
          <View className="size-[18px] rounded-full bg-[#ddd]" />
        </Pressable>
      ) : (
        <AppText className="text-[10px] text-brass">{value}</AppText>
      )}
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { cn } from '@/utils/cn';
import { AppText } from '@/components/ui/app-text';

type Props = {
  title: string;
  value?: string;
  toggle?: { value: boolean; onChange: () => void };
};

export function SettingRow({ title, value, toggle }: Props) {
  return (
    <View className="min-h-19 flex-row items-center justify-between border-b border-[#444]">
      <View>
        <AppText className="text-sm">{title}</AppText>
        <AppText className="mt-1.25 text-2xs text-[#777]">Network policy</AppText>
      </View>
      {toggle ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: toggle.value }}
          onPress={toggle.onChange}
          className={cn(
            'h-6 w-10.75 rounded-full p-0.75',
            toggle.value ? 'items-end bg-[#315c44]' : 'items-start bg-[#3a3a3e]',
          )}
        >
          <View className="size-4.5 rounded-full bg-[#ddd]" />
        </Pressable>
      ) : (
        <AppText className="text-2xs text-brass">{value}</AppText>
      )}
    </View>
  );
}

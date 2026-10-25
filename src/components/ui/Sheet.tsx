import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '../../utils/cn';
import { AppText, Eyebrow } from './AppText';

type Props = {
  eyebrow: string;
  eyebrowClassName?: string;
  title: string;
  body: string;
  badge: ReactNode;
  children: ReactNode;
};

/** Confirmation dialog rendered by a transparent-modal route; tapping the backdrop dismisses it. */
export function Sheet({ eyebrow, eyebrowClassName, title, body, badge, children }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 justify-end px-3" style={{ paddingBottom: insets.bottom + 12 }}>
      <Pressable
        accessibilityLabel="Dismiss"
        className="absolute inset-0 bg-black/85"
        onPress={() => navigation.goBack()}
      />
      <View className="w-full max-w-[400px] self-center rounded-[26px] border border-brass bg-white px-6 pb-7 pt-[34px]">
        {badge}
        <Eyebrow className={cn('text-center text-[#615300]', eyebrowClassName)}>{eyebrow}</Eyebrow>
        <AppText className="m-2.5 text-center font-outfit-semibold text-[25px] text-black">{title}</AppText>
        <AppText className="mx-auto mb-6 max-w-[330px] text-center text-[13px] leading-[21px] text-[#959595]">{body}</AppText>
        <View className="gap-[9px]">{children}</View>
      </View>
    </View>
  );
}

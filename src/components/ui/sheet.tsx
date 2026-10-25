import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '../../utils/cn';
import { AppText, Eyebrow } from './app-text';

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

  return (
    <View className="flex-1 justify-end px-3 pb-safe-offset-3">
      <Pressable
        accessibilityLabel="Dismiss"
        className="absolute inset-0 bg-black/85"
        onPress={() => navigation.goBack()}
      />
      <View className="w-full max-w-100 self-center rounded-3xl border border-brass bg-white px-6 pt-8.5 pb-7">
        {badge}
        <Eyebrow className={cn('text-center text-[#615300]', eyebrowClassName)}>{eyebrow}</Eyebrow>
        <AppText className="m-2.5 text-center font-outfit-semibold text-2xl text-black">{title}</AppText>
        <AppText className="mx-auto mb-6 max-w-82.5 text-center text-sm leading-normal text-[#959595]">{body}</AppText>
        <View className="gap-2.25">{children}</View>
      </View>
    </View>
  );
}

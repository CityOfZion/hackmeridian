import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Eyebrow } from '@/components/ui/app-text';

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  badge: ReactNode;
  children: ReactNode;
};

/**
 * Bottom sheet for drawer routes (transparent modals): dark panel with a brass border, the same surface as the Pass
 * tap modal. Tapping the backdrop dismisses it.
 */
export function SheetLayout({ eyebrow, title, body, badge, children }: Props) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  return (
    // Top inset too: with the keyboard open the sheet can reach the status bar
    <View className="flex-1 justify-end px-3 pt-safe-offset-3 pb-safe-offset-3">
      <Pressable
        accessibilityLabel={t('actions.dismiss')}
        className="absolute inset-0 bg-black/85"
        onPress={() => navigation.goBack()}
      />
      {/* Shrinks and scrolls when the space left (e.g. above the keyboard) is shorter than the sheet */}
      <ScrollView
        className="w-full max-w-100 shrink grow-0 self-center rounded-3xl border border-brass bg-panel"
        contentContainerClassName="px-6 pt-8.5 pb-7"
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {badge}
        <Eyebrow className="text-center">{eyebrow}</Eyebrow>
        <AppText className="m-2.5 text-center font-outfit-semibold text-2xl text-paper">{title}</AppText>
        <AppText className="mx-auto mb-6 max-w-82.5 text-center text-sm leading-normal text-muted">{body}</AppText>
        <View className="gap-2.25">{children}</View>
      </ScrollView>
    </View>
  );
}

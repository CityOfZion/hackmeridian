import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { cn } from '../../utils/cn';
import { AppText, Eyebrow } from './AppText';
import { Icon } from './Icon';

type Props = {
  eyebrow: string;
  title: string;
  /** Show a back button that pops the current stack. */
  canGoBack?: boolean;
  onBack?: () => void;
  children: ReactNode;
  contentClassName?: string;
};

/** Scrollable page with the sticky eyebrow/title header used by every role screen. */
export function Screen({ eyebrow, title, canGoBack, onBack, children, contentClassName }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerClassName="pb-8"
      stickyHeaderIndices={[0]}
      keyboardShouldPersistTaps="handled"
    >
      <View
        className="mb-[22px] min-h-[126px] flex-row items-end justify-between border-b border-[#282828] bg-ink px-[22px] pb-[13px]"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-1 pr-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          <AppText className="mt-[5px] font-outfit-semibold text-[34px] leading-[34px] tracking-[-1.5px]">
            {title}
          </AppText>
        </View>
        {(canGoBack || onBack) && (
          <Pressable
            accessibilityLabel="Go back"
            onPress={handleBack}
            className="size-11 items-center justify-center rounded-full border border-paper active:opacity-70"
          >
            <Icon name="back" color={colors.paper} />
          </Pressable>
        )}
      </View>
      <View className={cn('px-[22px]', contentClassName)}>{children}</View>
    </ScrollView>
  );
}

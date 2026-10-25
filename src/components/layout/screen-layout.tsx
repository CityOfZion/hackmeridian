import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ScrollViewProps, type TextProps } from 'react-native';

import { colors } from '../../theme/colors';
import { cn } from '../../utils/cn';
import { AppText, Eyebrow as EyebrowText } from '../ui/app-text';
import { Icon } from '../ui/icon';

type SlotProps = { children: ReactNode; className?: string };

/** Full-screen container. Compose it with Header, Body and Footer. */
function Root({ children, className }: SlotProps) {
  return <View className={cn('flex-1 bg-ink', className)}>{children}</View>;
}

/** Fixed top bar; owns the top safe-area inset. Put a Heading and optional actions inside. */
function Header({ children, className }: SlotProps) {
  return (
    <View
      className={cn(
        'min-h-31.5 flex-row items-end justify-between border-b border-[#282828] bg-ink px-5.5 pb-3.25 pt-safe-offset-3',
        className,
      )}
    >
      {children}
    </View>
  );
}

/** Text block on the left of the Header (Eyebrow + Title). */
function Heading({ children, className }: SlotProps) {
  return <View className={cn('flex-1 pr-3', className)}>{children}</View>;
}

function Eyebrow(props: TextProps) {
  return <EyebrowText {...props} />;
}

function Title({ className, ...props }: TextProps) {
  return (
    <AppText
      accessibilityRole="header"
      className={cn('mt-1.25 font-outfit-semibold text-4xl leading-none tracking-tighter', className)}
      {...props}
    />
  );
}

/** Round back button for the Header. Pops the current stack unless onPress is given. */
function BackButton({ onPress }: { onPress?: () => void }) {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => navigation.goBack())}
      className="size-11 items-center justify-center rounded-full border border-paper active:opacity-70"
    >
      <Icon name="back" color={colors.paper} />
    </Pressable>
  );
}

/** Scrollable content area with the standard page gutters. Accepts any ScrollView prop. */
function Body({ children, contentContainerClassName, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={cn('px-5.5 pb-8 pt-5.5', contentContainerClassName)}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/** Actions pinned below the Body, e.g. the screen's primary button. */
function Footer({ children, className }: SlotProps) {
  return <View className={cn('gap-2.5 border-t border-[#282828] bg-ink px-5.5 py-4', className)}>{children}</View>;
}

export const ScreenLayout = Object.assign(Root, { Header, Heading, Eyebrow, Title, BackButton, Body, Footer });

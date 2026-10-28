import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { cn } from '@/utils/cn';

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-4 rounded-3xl border border-[#303033] bg-[#151517] p-5', className)}>{children}</View>
  );
}
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <AppText accessibilityRole="header" className="font-outfit-semibold text-lg">
      {children}
    </AppText>
  );
}
export function Muted({ children }: { children: ReactNode }) {
  return <AppText className="text-sm leading-5 text-muted">{children}</AppText>;
}
export function Choice({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'min-h-16 gap-1 rounded-2xl border p-4 active:opacity-70',
        selected ? 'border-brass bg-[#252313]' : 'border-[#39393d] bg-[#19191c]',
      )}
    >
      <AppText className="font-outfit-semibold text-base">
        {title}
        {selected ? '  ✓' : ''}
      </AppText>
      {detail && <Muted>{detail}</Muted>}
    </Pressable>
  );
}

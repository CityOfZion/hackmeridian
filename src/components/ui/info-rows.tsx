import { View } from 'react-native';

import { cn } from '@/utils/cn';
import { AppText } from './app-text';

export type InfoRow = { label: string; value: string };

/** Bordered label/value table (the "evidence" block in the design). */
export function InfoRows({ rows, className }: { rows: InfoRow[]; className?: string }) {
  return (
    <View className={cn('my-4.5 overflow-hidden rounded-lg border border-[#444]', className)}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          className={cn(
            'flex-row items-center justify-between p-3.75',
            index < rows.length - 1 && 'border-b border-[#333]',
          )}
        >
          <AppText className="text-3xs tracking-widest text-[#777]">{row.label}</AppText>
          <AppText className="font-outfit-medium text-3xs text-[#ccc]">{row.value}</AppText>
        </View>
      ))}
    </View>
  );
}

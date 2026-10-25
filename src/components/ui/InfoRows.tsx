import { View } from 'react-native';

import { cn } from '../../utils/cn';
import { AppText } from './AppText';

export type InfoRow = { label: string; value: string };

/** Bordered label/value table (the "evidence" block in the design). */
export function InfoRows({ rows, className }: { rows: InfoRow[]; className?: string }) {
  return (
    <View className={cn('my-[18px] overflow-hidden rounded-lg border border-[#444]', className)}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          className={cn(
            'flex-row items-center justify-between p-[15px]',
            index < rows.length - 1 && 'border-b border-[#333]',
          )}
        >
          <AppText className="text-[9px] tracking-[0.9px] text-[#777]">{row.label}</AppText>
          <AppText className="font-outfit-medium text-[9px] text-[#ccc]">{row.value}</AppText>
        </View>
      ))}
    </View>
  );
}

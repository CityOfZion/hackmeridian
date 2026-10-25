import { View } from 'react-native';

import { AppText } from '../../../components/ui/app-text';
import { cn } from '../../../utils/cn';

export function ProcessRail({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View className="mt-1 mb-3.5 flex-row items-center justify-center">
      {[1, 2, 3].map((n) => (
        <View key={n} className="flex-row items-center">
          {n > 1 && <View className="h-px w-10 bg-[#333]" />}
          <View
            className={cn(
              'size-6.5 items-center justify-center border border-[#333]',
              n === step && 'border-brass bg-brass',
            )}
          >
            <AppText className={cn('text-3xs text-[#666]', n === step && 'text-[#111]')}>{n}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

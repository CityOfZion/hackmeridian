import { View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { cn } from '@/utils/cn';

export function CardSetupProgress({ step }: { step: number }) {
  return (
    <View accessibilityLabel={`Step ${step} of 4`} className="flex-row gap-2">
      {['Scan', 'PIN', 'Keys', 'Account'].map((label, index) => (
        <View key={label} className="flex-1 gap-2">
          <View className={cn('h-1 rounded-full', index < step ? 'bg-brass' : 'bg-line')} />
          <AppText className={cn('text-xs', index + 1 === step ? 'text-paper' : 'text-muted')}>
            {index + 1 < step ? '✓' : index + 1} {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

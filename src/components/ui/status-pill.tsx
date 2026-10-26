import { View } from 'react-native';

import { cn } from '@/utils/cn';
import { AppText } from './app-text';

type Tone = 'positive' | 'negative' | 'neutral';

const POSITIVE = ['ACTIVE', 'SETTLED', 'VERIFIED'];
const NEGATIVE = ['FROZEN', 'FAILED', 'REVOKED'];

const tones: Record<Tone, { container: string; dot: string; label: string }> = {
  positive: { container: 'border-[#2f6249] bg-[#17241d]', dot: 'bg-success', label: 'text-[#79b898]' },
  negative: { container: 'border-[#613838] bg-[#281919]', dot: 'bg-danger', label: 'text-[#d37a7a]' },
  neutral: { container: 'border-[#494940] bg-[#242424]', dot: 'bg-[#aaa]', label: 'text-[#aaa]' },
};

function toneFor(value: string): Tone {
  if (POSITIVE.includes(value)) return 'positive';
  if (NEGATIVE.includes(value)) return 'negative';
  return 'neutral';
}

export function StatusPill({ value, className }: { value: string; className?: string }) {
  const tone = tones[toneFor(value)];
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border px-2 py-1',
        tone.container,
        className,
      )}
    >
      <View className={cn('size-1.25 rounded-full', tone.dot)} />
      <AppText className={cn('text-4xs tracking-widest', tone.label)}>{value}</AppText>
    </View>
  );
}

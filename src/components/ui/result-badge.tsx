import { View } from 'react-native';

import { cn } from '@/utils/cn';
import { Icon, type IconName } from './icon';

type Tone = 'success' | 'brass';

const tones: Record<Tone, { container: string; icon: string }> = {
  success: { container: 'border-[#3d7657] bg-[#14231b]', icon: '#65af82' },
  brass: { container: 'border-brass bg-brass', icon: '#080808' },
};

type Props = { icon: IconName; tone: Tone; round?: boolean };

/** Large square/round icon used at the top of result states and sheets. */
export function ResultBadge({ icon, tone, round = false }: Props) {
  const t = tones[tone];
  return (
    <View
      className={cn('mx-auto mb-6 size-20.5 items-center justify-center border', round && 'rounded-full', t.container)}
    >
      <Icon name={icon} size={42} color={t.icon} />
    </View>
  );
}

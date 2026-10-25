import { Pressable, View } from 'react-native';

import { CARD_DESIGNS, type CardDesign } from '../../store/slices/holdersSlice';
import { cn } from '../../utils/cn';
import { AppText } from '../ui/AppText';
import { PhysicalCard } from './PhysicalCard';

type Props = {
  label: string;
  value: CardDesign;
  onChange: (design: CardDesign) => void;
  className?: string;
};

export function CardDesignPicker({ label, value, onChange, className }: Props) {
  return (
    <View className={className}>
      <AppText className="mb-[9px] text-[9px] tracking-[0.9px] text-[#888]">{label}</AppText>
      <View className="flex-row gap-1.5">
        {CARD_DESIGNS.map((design) => (
          <Pressable
            key={design}
            accessibilityRole="button"
            accessibilityState={{ selected: value === design }}
            accessibilityLabel={`Card face ${design.toUpperCase()}`}
            onPress={() => onChange(design)}
            className={cn('flex-1 border p-[2px]', value === design ? 'border-brass' : 'border-[#2d2d30]')}
          >
            <PhysicalCard state="ACTIVE" design={design} compact />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
